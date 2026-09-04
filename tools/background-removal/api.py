#!/usr/bin/env python3
"""Small persistent HTTP API around the local U2Net engine for KEFE."""
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from io import BytesIO
import os

from remove_bg import create_session, remove_background

HOST = os.getenv("KEFE_BG_HOST", "127.0.0.1")
PORT = int(os.getenv("KEFE_BG_PORT", "8765"))
MAX_IMAGE_BYTES = 22 * 1024 * 1024
ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}
SESSION = None


def error_response(handler, status, message):
    body = ("{\"error\":\"" + message.replace("\\", "\\\\").replace('"', '\\"') + "\"}").encode()
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json")
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


class Handler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        print(f"[background-removal] {fmt % args}", flush=True)

    def do_GET(self):
        if self.path == "/health":
            body = b'{"ok":true,"service":"kefe-background-removal"}'
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        error_response(self, 404, "Not found.")

    def do_POST(self):
        if self.path != "/remove-background":
            error_response(self, 404, "Not found.")
            return

        content_type = self.headers.get("Content-Type", "").split(";", 1)[0].lower()
        if content_type not in ALLOWED_TYPES:
            error_response(self, 415, "Use a JPG, PNG, or WebP image.")
            return

        try:
            length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            length = 0
        if length <= 0:
            error_response(self, 400, "No image data received.")
            return
        if length > MAX_IMAGE_BYTES:
            error_response(self, 413, "Image is too large. Maximum size is 22 MB.")
            return

        payload = self.rfile.read(length)
        if len(payload) != length:
            error_response(self, 400, "Incomplete image payload.")
            return

        try:
            from PIL import Image
            image = Image.open(BytesIO(payload))
            result = remove_background(SESSION, image)
            output = BytesIO()
            result.save(output, format="PNG")
            body = output.getvalue()
        except Exception as exc:
            print(f"[background-removal] processing failed: {exc}", flush=True)
            error_response(self, 422, "The image could not be processed.")
            return

        self.send_response(200)
        self.send_header("Content-Type", "image/png")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def main():
    global SESSION
    SESSION = create_session()
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"KEFE background removal API listening on http://{HOST}:{PORT}", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
