from __future__ import annotations
import base64, hashlib, ipaddress, mimetypes, os, socket
from pathlib import Path
from urllib.parse import urlparse
import httpx
from app.errors import ConfigError

MEDIA_ROOT=Path(__file__).resolve().parents[2]/"data"/"media"
MAX_IMAGE_BYTES=int(os.getenv("MEDIA_MAX_IMAGE_BYTES",str(15*1024*1024)))
MAX_VIDEO_BYTES=int(os.getenv("MEDIA_MAX_VIDEO_BYTES",str(200*1024*1024)))
ALLOWED_IMAGE={"image/png","image/jpeg","image/webp","image/gif"}
ALLOWED_VIDEO={"video/mp4","video/webm","video/quicktime"}

def _validate_remote(url:str)->None:
    parsed=urlparse(url)
    if parsed.scheme!="https" or not parsed.hostname: raise ConfigError("媒体地址必须是有效的 HTTPS URL")
    allowed={x.strip().lower() for x in os.getenv("MEDIA_ALLOWED_HOSTS","").split(",") if x.strip()}
    host=parsed.hostname.lower()
    if allowed and not any(host==x or host.endswith("."+x) for x in allowed): raise ConfigError("媒体来源域名不在允许列表")
    try:
        for item in socket.getaddrinfo(host,parsed.port or 443,type=socket.SOCK_STREAM):
            ip=ipaddress.ip_address(item[4][0])
            if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast: raise ConfigError("禁止从内网或保留地址下载媒体")
    except socket.gaierror as exc: raise ConfigError("媒体来源域名无法解析") from exc

def _check_type(content_type:str|None,asset_type:str)->str:
    value=(content_type or "").lower()
    allowed=ALLOWED_VIDEO if asset_type=="video" else ALLOWED_IMAGE
    if value not in allowed: raise ConfigError(f"不支持的{asset_type}媒体类型：{value or '未知'}")
    return value

def persist_media(source:str,asset_type:str)->str:
    if asset_type not in {"image","video"}: raise ConfigError("媒体类型仅支持 image 或 video")
    if source.startswith("/agent/media/"): return source
    limit=MAX_VIDEO_BYTES if asset_type=="video" else MAX_IMAGE_BYTES
    content_type=None
    if source.startswith("data:"):
        try:
            header,encoded=source.split(",",1);content_type=_check_type(header[5:].split(";",1)[0],asset_type);data=base64.b64decode(encoded,validate=True)
        except (ValueError,base64.binascii.Error) as exc: raise ConfigError("媒体 data URL 格式无效") from exc
        if len(data)>limit: raise ConfigError("媒体文件超过大小限制")
    else:
        _validate_remote(source)
        with httpx.stream("GET",source,timeout=120.0,follow_redirects=False) as response:
            response.raise_for_status();content_type=_check_type(response.headers.get("content-type","").split(";",1)[0],asset_type)
            length=int(response.headers.get("content-length") or 0)
            if length>limit: raise ConfigError("媒体文件超过大小限制")
            chunks=[];size=0
            for chunk in response.iter_bytes():
                size+=len(chunk)
                if size>limit: raise ConfigError("媒体文件超过大小限制")
                chunks.append(chunk)
            data=b"".join(chunks)
    ext=mimetypes.guess_extension(content_type or "") or (".mp4" if asset_type=="video" else ".png")
    digest=hashlib.sha256(data).hexdigest();folder=MEDIA_ROOT/asset_type;folder.mkdir(parents=True,exist_ok=True);target=folder/f"{digest}{ext}"
    if not target.exists(): target.write_bytes(data)
    return f"/agent/media/{asset_type}/{target.name}"
