import { agentApi } from "./client";
import type { Json } from "./types";

// 设置中心（Python 服务持久化到 settings.json）。
export const getSettings = () => agentApi.get<Json>("/ecommerce/settings");
export const saveSettings = (body: Json) =>
  agentApi.put<Json>("/ecommerce/settings", body);
