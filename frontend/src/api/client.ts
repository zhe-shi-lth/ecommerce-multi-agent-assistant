// 轻量 fetch 封装：开发期经 Vite proxy 走相对前缀（/api 或 /agent），无需写死后端地址。
async function requestWithPrefix<T>(prefix: string, path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("Accept", "application/json");
  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(`${prefix}${path}`, { ...init, headers });
  if (!res.ok) {
    // 优先提取后端在 4xx body 里给出的可读原因（error/message/auditMessage），
    // 命中时直接作为错误消息（不含状态码、无前缀），更适合直接展示给最终用户。
    let statusText = `请求失败 ${res.status}`;
    let friendly: string | null = null;
    try {
      const body = await res.text();
      if (body) {
        try {
          const parsed = JSON.parse(body);
          friendly = parsed.error || parsed.message || parsed.auditMessage || null;
          if (!friendly) statusText += `: ${body}`;
        } catch {
          statusText += `: ${body}`;
        }
      }
    } catch {
      /* 忽略读取异常，使用状态码兜底 */
    }
    throw new Error(friendly ?? statusText);
  }
  return (await res.json()) as T;
}

export const api = {
  get: <T>(path: string) => requestWithPrefix<T>("/api", path),
  post: <T>(path: string, body?: unknown) =>
    requestWithPrefix<T>("/api", path, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) =>
    requestWithPrefix<T>("/api", path, { method: "PUT", body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => requestWithPrefix<T>("/api", path, { method: "DELETE" }),
};

// 指向 Python 编排服务的接口（线1上架流水线等）
export const agentApi = {
  get: <T>(path: string) => requestWithPrefix<T>("/agent", path),
  post: <T>(path: string, body?: unknown) =>
    requestWithPrefix<T>("/agent", path, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) =>
    requestWithPrefix<T>("/agent", path, { method: "PUT", body: body ? JSON.stringify(body) : undefined }),
  delete: <T>(path: string) => requestWithPrefix<T>("/agent", path, { method: "DELETE" }),
};
