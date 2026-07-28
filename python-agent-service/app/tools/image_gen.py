"""出图（文生图 / 图生图）适配器工厂 —— 每个厂家走各自的官方 SDK，不使用 OpenAI 兼容 shim。

- qwen（阿里云 DashScope / 通义千问 qwen-image）：
  - 文生图：dashscope.ImageSynthesis.call（官方文生图接口）
  - 图生图：dashscope.MultiModalConversation.call（官方图像编辑接口，messages 内传底图+提示词）
- openai（OpenAI GPT-Image / DALL·E）：openai 官方 SDK 的 client.images.generate / client.images.edit
- google（Gemini / Nano Banana，Imagen 已弃用）：google-genai 的 client.interactions.create
- stability（Stable Diffusion）：Stability 官方 REST（无维护中的 Python SDK，按官方文档直接用 HTTP）
- custom：用户自定义 OpenAI 兼容端点（直接转发，不借用已知厂家配置）

设计原则（与全局一致）：
- 出图卡片的 Key / model / base_url **只来自本卡片**（`resolve_image_credentials`），不借用其他卡片、不读 .env。
- 配置缺失（无 Key / 无 base_url）→ 直接抛 `ConfigError`；已配好但 API 报错 → 原样抛异常。
- 不静默占位、不降级到其他厂家。某厂家官方接口不支持的能力如实报错。
"""
from __future__ import annotations

import base64
import binascii
import io
import re
from abc import ABC, abstractmethod
from typing import List

import httpx

from app.errors import ConfigError
from app.settings_store import get_settings, resolve_image_credentials

_DATA_URL_RE = re.compile(r"^data:(?P<mime>[\w/+]+);base64,(?P<b64>.+)$", re.DOTALL)


def _data_url_parts(data_url: str) -> tuple[bytes, str]:
    """把 base64 data URL 拆成 (原始字节, mime)。图生图前端上传的通常是 data URL。"""
    m = _DATA_URL_RE.match(data_url.strip())
    if not m:
        raise ConfigError("图生图底图不是合法的 base64 data URL")
    mime = m.group("mime")
    try:
        raw = base64.b64decode(m.group("b64"), validate=True)
    except (binascii.Error, ValueError) as e:
        raise ConfigError("图生图底图 base64 解码失败") from e
    return raw, (mime if "/" in mime else "image/png")


class ImageGenerator(ABC):
    @abstractmethod
    def generate_image(self, prompt: str, size: str = "1024*1024", n: int = 1) -> List[str]:
        """文生图：返回图片 URL / data URL 列表。"""
        raise NotImplementedError

    @abstractmethod
    def generate_image_edit(
        self,
        prompt: str,
        base_image_url: str,
        size: str = "1024*1024",
        n: int = 1,
        ref_strength: float = 0.4,
    ) -> List[str]:
        """图生图：以 base_image_url 为底图，prompt 为修改目标，返回结果列表。"""
        raise NotImplementedError


class DashScopeImageGenerator(ImageGenerator):
    """通义千问 qwen-image（阿里云 DashScope），走官方 SDK `MultiModalConversation.call`。

    官方文档（qwen-image 文生图 / 千问-图像编辑）：
    - 文生图与图生图统一用 `MultiModalConversation.call`（同步接口，result_format='message'）。
    - 文生图：messages=[{role:user, content:[{text: prompt}]}]
    - 图生图：messages=[{role:user, content:[{image: 底图}, {text: prompt}]}]
      底图可为 URL / Base64(data URL) / OSS 临时链接；本项目的图生图底图即前端上传的 data URL。
    - 支持参数：size（宽*高）、n、watermark、prompt_extend、negative_prompt；
      **没有** ref_strength / revision（图生图强度概念不适用于此接口）。
    - 返回统一结构：output.choices[0].message.content 为若干 {"image": url} 元素（链接 24h 有效）。
    Key / 模型只来自出图卡片，不借用其他卡片、不读 .env。
    """

    def __init__(self, api_key: str, model: str, edit_model: str) -> None:
        self._api_key = api_key
        self._model = model
        self._edit_model = edit_model

    @staticmethod
    def _detail(resp) -> str:
        parts = [f"status={getattr(resp, 'status_code', '?')}"]
        code = getattr(resp, "code", "") or ""
        msg = getattr(resp, "message", "") or ""
        if code:
            parts.append(f"code={code}")
        if msg:
            parts.append(f"message={msg}")
        return " ".join(parts)

    def _call(self, model: str, messages: list, size: str, n: int) -> List[str]:
        from dashscope import MultiModalConversation

        resp = MultiModalConversation.call(
            api_key=self._api_key,
            model=model,
            messages=messages,
            result_format="message",
            stream=False,
            n=n,
            size=size,
            watermark=False,
            prompt_extend=True,
        )
        if getattr(resp, "status_code", None) != 200:
            raise ConfigError(f"出图失败: {self._detail(resp)}")
        content = resp.output.choices[0].message.content
        urls: List[str] = []
        for c in content:
            if isinstance(c, dict) and c.get("image"):
                urls.append(c["image"])
        if not urls:
            raise ConfigError(f"出图返回为空（{self._detail(resp)}）")
        return urls

    def generate_image(self, prompt: str, size: str = "1024*1024", n: int = 1) -> List[str]:
        messages = [{"role": "user", "content": [{"text": prompt}]}]
        return self._call(self._model, messages, size, n)

    def generate_image_edit(
        self,
        prompt: str,
        base_image_url: str,
        size: str = "1024*1024",
        n: int = 1,
        ref_strength: float = 0.4,
    ) -> List[str]:
        # 注意：qwen-image 图生图接口不接受 ref_strength，强度由模型自行决定。
        messages = [{"role": "user", "content": [{"image": base_image_url}, {"text": prompt}]}]
        return self._call(self._edit_model, messages, size, n)


class OpenAIImageGenerator(ImageGenerator):
    """OpenAI 官方 SDK（client.images.generate / client.images.edit）。

    适用于 OpenAI 官方（GPT-Image / DALL·E）。图生图走 client.images.edit；
    GPT 图像模型返回 b64_json，DALL·E 返回 url，这里统一转成 data URL 返回。
    """

    def __init__(self, api_key: str, model: str, edit_model: str, base_url: str = "") -> None:
        from openai import OpenAI

        self._client = OpenAI(api_key=api_key, base_url=base_url or None)
        self._model = model
        self._edit_model = edit_model or model

    def _extract(self, resp) -> List[str]:
        urls: List[str] = []
        for item in resp.data:
            if getattr(item, "url", None):
                urls.append(item.url)
            elif getattr(item, "b64_json", None):
                urls.append(f"data:image/png;base64,{item.b64_json}")
        if not urls:
            raise ConfigError("OpenAI 出图返回为空")
        return urls

    def generate_image(self, prompt: str, size: str = "1024x1024", n: int = 1) -> List[str]:
        oai_size = size.replace("*", "x")
        resp = self._client.images.generate(model=self._model, prompt=prompt, n=n, size=oai_size)
        return self._extract(resp)

    def generate_image_edit(
        self,
        prompt: str,
        base_image_url: str,
        size: str = "1024x1024",
        n: int = 1,
        ref_strength: float = 0.4,
    ) -> List[str]:
        oai_size = size.replace("*", "x")
        raw, _mime = _data_url_parts(base_image_url)
        file_obj = io.BytesIO(raw)
        file_obj.name = "reference.png"
        resp = self._client.images.edit(
            model=self._edit_model, image=file_obj, prompt=prompt, n=n, size=oai_size
        )
        return self._extract(resp)


class GoogleImageGenerator(ImageGenerator):
    """Google 官方 SDK（google-genai 的 client.interactions.create）。

    Imagen 已弃用，统一走 Gemini / Nano Banana 模型；返回 base64 图像，转 data URL。
    需自行安装：uv add google-genai。
    """

    def __init__(self, api_key: str, model: str) -> None:
        from google import genai

        self._client = genai.Client(api_key=api_key)
        self._model = model

    @staticmethod
    def _to_data_url(inter) -> str:
        data = inter.output_image.data
        return f"data:image/png;base64,{data}"

    def generate_image(self, prompt: str, size: str = "1024x1024", n: int = 1) -> List[str]:
        inter = self._client.interactions.create(model=self._model, input=prompt)
        return [self._to_data_url(inter)]

    def generate_image_edit(
        self,
        prompt: str,
        base_image_url: str,
        size: str = "1024x1024",
        n: int = 1,
        ref_strength: float = 0.4,
    ) -> List[str]:
        raw, mime = _data_url_parts(base_image_url)
        b64 = base64.b64encode(raw).decode("utf-8")
        inter = self._client.interactions.create(
            model=self._model,
            input=[
                {"type": "text", "text": prompt},
                {"type": "image", "data": b64, "mime_type": mime},
            ],
        )
        return [self._to_data_url(inter)]


class StabilityImageGenerator(ImageGenerator):
    """Stability 官方 REST（v2beta）。无维护中的 Python SDK，按官方文档直接调用 HTTP。

    文生图：/v2beta/stable-image/generate/{ultra|sd3}
    图生图：/v2beta/stable-image/generate/sd3（mode=image-to-image）
    直接返回图片字节（accept: image/*），转 data URL。
    """

    def __init__(self, api_key: str, model: str, base_url: str) -> None:
        self._api_key = api_key
        self._model = model
        self._base_url = (base_url or "").rstrip("/")

    def _post(self, path: str, files: dict, data: dict) -> List[str]:
        resp = httpx.post(
            f"{self._base_url}/{path}",
            headers={"authorization": f"Bearer {self._api_key}", "accept": "image/*"},
            files=files,
            data=data,
            timeout=120.0,
        )
        if resp.status_code != 200:
            raise ConfigError(f"Stability 出图失败（HTTP {resp.status_code}）：{resp.text[:500]}")
        b64 = base64.b64encode(resp.content).decode("utf-8")
        return [f"data:image/png;base64,{b64}"]

    def generate_image(self, prompt: str, size: str = "1024x1024", n: int = 1) -> List[str]:
        family = "sd3" if self._model.startswith("sd3") else "ultra"
        return self._post(
            f"stable-image/generate/{family}",
            {"none": ""},
            {"prompt": prompt, "output_format": "png"},
        )

    def generate_image_edit(
        self,
        prompt: str,
        base_image_url: str,
        size: str = "1024x1024",
        n: int = 1,
        ref_strength: float = 0.4,
    ) -> List[str]:
        raw, mime = _data_url_parts(base_image_url)
        files = {"image": ("reference.png", raw, mime)}
        data = {
            "prompt": prompt,
            "mode": "image-to-image",
            "strength": str(ref_strength),
            "output_format": "png",
        }
        return self._post("stable-image/generate/sd3", files, data)


def get_image_generator() -> ImageGenerator:
    """按出图卡片 vendor 构造对应官方 SDK 适配器；配置缺失直接抛 ConfigError。

    调用方需先判断出图已启用（`image.enabled`）且不在离线模式；本函数假设需要真实出图。
    """
    vendor, base_url, api_key, model, edit_model = resolve_image_credentials()
    if not api_key:
        raise ConfigError("未填写出图 API Key（请在设置中心出图卡片填写）")
    if vendor == "qwen":
        # 阿里云 qwen-image：文生图 ImageSynthesis，图生图 MultiModalConversation（均为官方 SDK）
        return DashScopeImageGenerator(api_key=api_key, model=model, edit_model=edit_model)
    if vendor == "openai":
        if not base_url:
            raise ConfigError("未填写出图 base_url（OpenAI 兼容端点）")
        return OpenAIImageGenerator(api_key=api_key, model=model, edit_model=edit_model, base_url=base_url)
    if vendor == "google":
        return GoogleImageGenerator(api_key=api_key, model=model)
    if vendor == "stability":
        if not base_url:
            raise ConfigError("未填写出图 base_url（Stability 端点）")
        return StabilityImageGenerator(api_key=api_key, model=model, base_url=base_url)
    if vendor == "custom":
        if not base_url:
            raise ConfigError("未填写出图 base_url（自定义端点）")
        return OpenAIImageGenerator(api_key=api_key, model=model, edit_model=edit_model, base_url=base_url)
    raise ConfigError(f"不支持的出图厂家：{vendor}")
