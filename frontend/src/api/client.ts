// 轻量 fetch 封装：开发期经 Vite proxy 走相对 /api，无需写死后端地址。
async function request<T>(path: string): Promise<T> {
  const res = await fetch(`/api${path}`, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`请求失败 ${res.status}: ${path}`);
  }
  return (await res.json()) as T;
}

export const api = {
  get: request,
};
