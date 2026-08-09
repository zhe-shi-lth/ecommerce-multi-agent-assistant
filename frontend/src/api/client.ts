// 轻量 fetch 封装：开发期经 Vite proxy 走相对前缀（/api 或 /agent），无需写死后端地址。
import { clearToken, getToken } from "../auth";
import { emitAppError } from "./errorBus";

async function requestWithPrefix<T>(
  prefix: string,
  path: string,
  init?: RequestInit,
  opts?: { silent?: boolean },
): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("Accept", "application/json");
  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  // 携带后端签发的 JWT（Bearer），用于 Java 与 Python 双侧鉴权。
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  const res = await fetch(`${prefix}${path}`, { ...init, headers });
  if (!res.ok) {
    // 令牌失效（过期/无效）：清空本地状态并跳回登录页（登录接口本身的 401 不跳转，留待页面提示）。
    if (res.status === 401 && !path.includes("/auth/login")) {
      clearToken();
      window.location.href = "/login";
    }
    // 优先提取后端在 4xx body 里给出的可读原因（error/message/auditMessage），
    // 命中时直接作为错误消息（不含状态码、无前缀），更适合直接展示给最终用户。
    let statusText = `请求失败 ${res.status}`;
    let friendly: string | null = null;
    try {
      const body = await res.text();
      if (body) {
        try {
          const parsed = JSON.parse(body);
          // detail 为 FastAPI 422/HTTPException 的标准字段（后端 ConfigError 处理器返回 {"detail": 中文原因}）。
          friendly = parsed.detail || parsed.error || parsed.message || parsed.auditMessage || null;
          if (!friendly) statusText += `: ${body}`;
        } catch {
          statusText += `: ${body}`;
        }
      }
    } catch {
      /* 忽略读取异常，使用状态码兜底 */
    }
    // 非 401（401 已跳登录）统一以居中弹窗提示最终用户，不再静默。
    // silent=true 时由调用方自行处理错误（如表单内联提示），不再弹全局弹窗，避免重复弹窗。
    if (res.status !== 401 && !opts?.silent) {
      emitAppError(friendly ?? statusText);
    }
    throw new Error(friendly ?? statusText);
  }
  // 204 No Content 或空响应体：不解析 JSON（如 DELETE 删除接口返回空体），
  // 否则 res.json() 会对空串抛 "Unexpected end of JSON input"。
  if (res.status === 204) return undefined as T;
  const len = res.headers.get("content-length");
  const hasBody = len == null || len !== "0";
  if (!hasBody) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  get: <T>(path: string, opts?: { silent?: boolean }) => requestWithPrefix<T>("/api", path, undefined, opts),
  post: <T>(path: string, body?: unknown, opts?: { silent?: boolean }) =>
    requestWithPrefix<T>("/api", path, { method: "POST", body: body ? JSON.stringify(body) : undefined }, opts),
  put: <T>(path: string, body?: unknown, opts?: { silent?: boolean }) =>
    requestWithPrefix<T>("/api", path, { method: "PUT", body: body ? JSON.stringify(body) : undefined }, opts),
  delete: <T>(path: string, opts?: { silent?: boolean }) =>
    requestWithPrefix<T>("/api", path, { method: "DELETE" }, opts),
};

// 指向 Python 编排服务的接口（上架流水线等）
export const agentApi = {
  get: <T>(path: string, opts?: { silent?: boolean }) => requestWithPrefix<T>("/agent", path, undefined, opts),
  post: <T>(path: string, body?: unknown, opts?: { silent?: boolean }) =>
    requestWithPrefix<T>("/agent", path, { method: "POST", body: body ? JSON.stringify(body) : undefined }, opts),
  put: <T>(path: string, body?: unknown, opts?: { silent?: boolean }) =>
    requestWithPrefix<T>("/agent", path, { method: "PUT", body: body ? JSON.stringify(body) : undefined }, opts),
  delete: <T>(path: string, opts?: { silent?: boolean }) =>
    requestWithPrefix<T>("/agent", path, { method: "DELETE" }, opts),
};
