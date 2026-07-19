// 前端-only 模拟鉴权：令牌存于 localStorage，不牵涉后端。
const TOKEN_KEY = "ea_token";

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(value: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, value);
  } catch {
    /* 忽略隐私模式等存储异常 */
  }
}

export function clearToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* 忽略 */
  }
}

export function isAuthed(): boolean {
  return !!getToken();
}
