import { agentApi } from "./client";
import type { Json } from "./types";

// 设置中心（Python 服务持久化到 settings.json）。
export const getSettings = () => agentApi.get<Json>("/ecommerce/settings");
export const saveSettings = (body: Json) =>
  agentApi.put<Json>("/ecommerce/settings", body);

// 各能力当前是否可用（纯本地判定：部署开关 + 设置中心 + 是否填 Key，不发网络请求）。
export const getCapabilities = () =>
  agentApi.get<{
    llm: { available: boolean; reason: string };
    monitor: { available: boolean; reason: string };
  }>("/ecommerce/capabilities");
