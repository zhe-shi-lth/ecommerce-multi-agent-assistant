from __future__ import annotations

import base64
import hashlib
import mimetypes
from pathlib import Path
from urllib.parse import urlparse

import httpx

MEDIA_ROOT = Path(__file__).resolve().parents[2] / "data" / "media"


def persist_media(source: str, asset_type: str) -> str:
    if source.startswith("/agent/media/"):
        return source
    content_type: str | None = None
    if source.startswith("data:"):
        header, encoded = source.split(",", 1)
        content_type = header[5:].split(";", 1)[0]
        data = base64.b64decode(encoded)
    else:
        response = httpx.get(source, timeout=120.0, follow_redirects=True)
        response.raise_for_status()
        data = response.content
        content_type = response.headers.get("content-type", "").split(";", 1)[0] or None
    ext = mimetypes.guess_extension(content_type or "") or Path(urlparse(source).path).suffix
    if not ext:
        ext = ".mp4" if asset_type == "video" else ".png"
    digest = hashlib.sha256(data).hexdigest()
    folder = MEDIA_ROOT / asset_type
    folder.mkdir(parents=True, exist_ok=True)
    name = f"{digest}{ext}"
    target = folder / name
    if not target.exists():
        target.write_bytes(data)
    return f"/agent/media/{asset_type}/{name}"
