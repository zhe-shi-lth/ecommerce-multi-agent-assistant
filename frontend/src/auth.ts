// 鉴权状态：令牌与角色存于 localStorage，令牌由后端签发（JWT）。
const TOKEN_KEY = "ea_token";
const ROLE_KEY = "ea_role";

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

export function getRole(): string | null {
  try {
    return localStorage.getItem(ROLE_KEY);
  } catch {
    return null;
  }
}

export function setRole(value: string): void {
  try {
    localStorage.setItem(ROLE_KEY, value);
  } catch {
    /* 忽略 */
  }
}

export function clearToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(ROLE_KEY);
  } catch {
    /* 忽略 */
  }
}

export function isAuthed(): boolean {
  return !!getToken();
}

export function isSuperAdmin(): boolean {
  return getRole() === "SUPER_ADMIN";
}
