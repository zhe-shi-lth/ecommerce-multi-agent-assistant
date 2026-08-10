// 把异常转成面向最终用户的中文文案，杜绝「Error: ...」「Failed to fetch」这类编程报错外泄。
// 后端经 client.ts 已把 4xx 可读原因放在 Error.message 里（如「请求失败 500」「Token 已失效」），
// 这里主要做清洗与少量网络/兜底映射。

export function errMsg(e: unknown): string {
  const raw = e instanceof Error ? e.message : typeof e === "string" ? e : "";
  const clean = raw.replace(/^Error:\s*/i, "").trim();
  if (!clean) return "操作未完成，请稍后重试";

  // 网络层失败（fetch 抛出的非 HTTP 异常）
  if (/failed to fetch|networkerror|network request failed/i.test(clean)) {
    return "网络连接异常，请检查网络后重试";
  }
  // 后端已给出可读原因（含状态码或中文说明）直接复用
  return clean;
}
