"""统一配置/能力异常。

配置缺失、所选厂家不被支持、或能力未按要求启用时抛出，由 API 层统一转换为
422 中文可读错误返回给前端（不暴露内部栈）。语义上代表「用户侧配置问题」，
不是程序 bug，也不是瞬态网络错误。
"""


class ConfigError(RuntimeError):
    """配置缺失或所选厂家/能力不被支持时抛出。

    例如：页面选了某厂家但未填 API Key、出图卡片未启用、或某 OpenAI 兼容厂家
    不支持图生图。调用方（Agent / API）应让其向上传播，由 main.py 的异常处理器
    转成用户友好的报错，禁止偷偷降级或借用其他卡片的配置。
    """

    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.message = message
