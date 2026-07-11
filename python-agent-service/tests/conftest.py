"""测试默认关闭真实 LLM，走规则路径，保证不依赖 Ollama 也能全绿。"""
import os

os.environ["LLM_ENABLED"] = "false"
