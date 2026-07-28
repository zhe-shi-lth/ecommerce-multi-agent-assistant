// 极简全局错误事件：后端非 2xx 经 api/client.ts 发出，App 顶层订阅后居中弹窗。
// 用 EventTarget 而非 window 全局事件，避免命名污染且类型友好。
const target = new EventTarget();
const EVENT = "app-error";

export function emitAppError(message: string): void {
  target.dispatchEvent(new CustomEvent<string>(EVENT, { detail: message }));
}

export function onAppError(handler: (message: string) => void): () => void {
  const listener = (e: Event) => handler((e as CustomEvent<string>).detail);
  target.addEventListener(EVENT, listener);
  return () => target.removeEventListener(EVENT, listener);
}
