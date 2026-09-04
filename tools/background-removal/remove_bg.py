#!/usr/bin/env python3
"""Local U2Net background-removal engine used by KEFE."""
import hashlib
import os
import ssl
import subprocess
import sys
import urllib.request

MODEL_URL = "https://github.com/danielgatis/rembg/releases/download/v0.0.0/u2net.onnx"
MODEL_MD5 = "60024c5c889badc19c04ad937298a77b"
MODEL_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "model")
MODEL_PATH = os.path.join(MODEL_DIR, "u2net.onnx")


def _ssl_context():
    try:
        import certifi
        return ssl.create_default_context(cafile=certifi.where())
    except Exception:
        return ssl.create_default_context()


def md5_of(path):
    digest = hashlib.md5()
    with open(path, "rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def ensure_model():
    os.makedirs(MODEL_DIR, exist_ok=True)
    if os.path.isfile(MODEL_PATH) and md5_of(MODEL_PATH) == MODEL_MD5:
        return MODEL_PATH

    tmp_path = MODEL_PATH + ".part"
    print("Downloading segmentation model (one-time, ~176MB)...", flush=True)
    try:
        with urllib.request.urlopen(_ssl_context_urlopen(MODEL_URL), context=_ssl_context()) as response, open(tmp_path, "wb") as handle:
            total = response.getheader("Content-Length")
            total = int(total) if total else None
            downloaded = 0
            while True:
                chunk = response.read(1024 * 1024)
                if not chunk:
                    break
                handle.write(chunk)
                downloaded += len(chunk)
                if total:
                    print(f"\r  {downloaded * 100 // total}%", end="", flush=True)
        print(flush=True)
    except Exception:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)
        raise

    if md5_of(tmp_path) != MODEL_MD5:
        os.remove(tmp_path)
        raise RuntimeError("Downloaded model failed checksum verification.")
    os.replace(tmp_path, MODEL_PATH)
    return MODEL_PATH


def _ssl_context_urlopen(url):
    # Kept as a tiny wrapper so tests can replace the downloader without
    # touching the model implementation.
    return url


def create_session():
    import onnxruntime as ort
    return ort.InferenceSession(ensure_model(), providers=["CPUExecutionProvider"])


def remove_background(session, img):
    import numpy as np
    from PIL import Image

    original_size = img.size
    resized = img.convert("RGB").resize((320, 320), Image.Resampling.LANCZOS)
    image_array = np.array(resized).astype(np.float64)
    image_array /= max(image_array.max(), 1e-6)

    mean = (0.485, 0.456, 0.406)
    std = (0.229, 0.224, 0.225)
    normalized = np.zeros((320, 320, 3))
    for channel in range(3):
        normalized[:, :, channel] = (image_array[:, :, channel] - mean[channel]) / std[channel]
    input_tensor = np.expand_dims(normalized.transpose((2, 0, 1)), 0).astype(np.float32)

    input_name = session.get_inputs()[0].name
    outputs = session.run(None, {input_name: input_tensor})
    prediction = outputs[0][:, 0, :, :]
    denominator = prediction.max() - prediction.min()
    if denominator > 0:
        prediction = (prediction - prediction.min()) / denominator
    else:
        prediction = prediction * 0
    mask = Image.fromarray((np.squeeze(prediction).clip(0, 1) * 255).astype("uint8"), mode="L")
    mask = mask.resize(original_size, Image.Resampling.LANCZOS)

    result = img.convert("RGBA")
    result.putalpha(mask)
    return result


def process_path(session, path, output_path=None):
    from PIL import Image

    if not os.path.isfile(path):
        raise FileNotFoundError(path)
    with Image.open(path) as image:
        result = remove_background(session, image)
    if output_path is None:
        base, _ = os.path.splitext(path)
        output_path = f"{base}-nobg.png"
    result.save(output_path, format="PNG")
    return output_path


def main():
    paths = [path for path in sys.argv[1:] if path.strip()]
    if not paths:
        print("Usage: remove_bg.py IMAGE [IMAGE ...]", file=sys.stderr)
        return 2
    session = create_session()
    failures = 0
    for path in paths:
        try:
            print(process_path(session, path))
        except Exception as exc:
            failures += 1
            print(f"ERROR: {path}: {exc}", file=sys.stderr)
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(main())
