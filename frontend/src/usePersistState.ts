import { useState } from "react";

// 模块级单例：组件卸载（如切换其他 tab）后状态仍保留，重新挂载时自动恢复。
// 用于「新品上架」向导——中途切走再切回，应停留在原步骤而非重新开始。
// 仅持久化「业务进度/用户输入」类字段；loading/busy 等瞬态字段仍用普通 useState。
const store: Record<string, unknown> = {};

export function usePersistState<T>(
  key: string,
  initial: T | (() => T),
): [T, (value: T | ((prev: T) => T)) => void] {
  const [state, setState] = useState<T>(() => {
    if (key in store) return store[key] as T;
    const resolved = typeof initial === "function" ? (initial as () => T)() : initial;
    store[key] = resolved;
    return resolved;
  });

  const set = (value: T | ((prev: T) => T)) => {
    setState((prev) => {
      const next = typeof value === "function" ? (value as (p: T) => T)(prev) : value;
      store[key] = next;
      return next;
    });
  };

  return [state, set];
}

// 清空某前缀下的持久化状态（如「再上架一个」需要重置向导）。
export function clearPersistState(prefix?: string) {
  for (const k of Object.keys(store)) {
    if (!prefix || k.startsWith(prefix)) delete store[k];
  }
}
