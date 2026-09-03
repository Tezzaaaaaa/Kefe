"""KEFE's single-model, self-hosted background remover.

Model: egeorcun/lucida (released v7 weights, loaded from Hugging Face).
The model is loaded once and reused for requests.
"""
from io import BytesIO
import os

import torch
from fastapi import FastAPI, File, HTTPException, UploadFile
from PIL import Image
from torchvision import transforms
from transformers import AutoModelForImageSegmentation

MODEL_ID = os.getenv("LUCIDA_MODEL_ID", "egeorcun/lucida")
MAX_IMAGE_BYTES = int(os.getenv("MAX_IMAGE_BYTES", str(22 * 1024 * 1024)))
INPUT_SIZE = 1024

app = FastAPI(title="KEFE Background Remover", docs_url=None, redoc_url=None)


def pick_device() -> torch.device:
    if torch.cuda.is_available():
        return torch.device("cuda")
    if getattr(torch.backends, "mps", None) and torch.backends.mps.is_available():
        return torch.device("mps")
    return torch.device("cpu")


DEVICE = pick_device()
MODEL = AutoModelForImageSegmentation.from_pretrained(
    MODEL_ID,
    trust_remote_code=True,
)
MODEL.to(DEVICE)
MODEL.eval()

PREPROCESS = transforms.Compose(
    [
        transforms.Resize((INPUT_SIZE, INPUT_SIZE)),
        transforms.ToTensor(),
        transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225]),
    ]
)


def remove_background(image: Image.Image) -> bytes:
    original = image.convert("RGB")
    tensor = PREPROCESS(original).unsqueeze(0).to(DEVICE)

    with torch.inference_mode():
        alpha = MODEL(tensor)[-1].sigmoid().cpu()[0, 0]

    alpha_image = transforms.ToPILImage()(alpha).resize(original.size, Image.Resampling.LANCZOS)
    rgba = original.convert("RGBA")
    rgba.putalpha(alpha_image)

    output = BytesIO()
    rgba.save(output, format="PNG", optimize=True)
    return output.getvalue()


@app.get("/health")
def health() -> dict:
    return {"ok": True, "model": MODEL_ID, "device": str(DEVICE)}


@app.post("/remove")
async def remove(file: UploadFile = File(...)) -> object:
    if file.content_type not in {"image/jpeg", "image/png", "image/webp"}:
        raise HTTPException(status_code=415, detail="Use a JPG, PNG, or WebP image.")

    data = await file.read(MAX_IMAGE_BYTES + 1)
    if not data:
        raise HTTPException(status_code=400, detail="No image data received.")
    if len(data) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=413, detail="Image is too large. Maximum size is 22 MB.")

    try:
        image = Image.open(BytesIO(data))
        image.load()
        result = remove_background(image)
    except Exception as exc:
        print(f"[lucida] processing failed: {exc}")
        raise HTTPException(status_code=422, detail="The image could not be processed.") from exc

    from fastapi.responses import Response

    return Response(
        content=result,
        media_type="image/png",
        headers={"Cache-Control": "no-store"},
    )
