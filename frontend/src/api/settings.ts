import { agentApi, api } from "./client";
import type { Json } from "./types";

// 设置中心（Python 服务持久化到 settings.json）。
export const getSettings = () => agentApi.get<Json>("/ecommerce/settings");
export const saveSettings = (body: Json) =>
  agentApi.put<Json>("/ecommerce/settings", body);
export interface StorePlatformConfigView {platform:string;configured:boolean;enabled:boolean;credentialFields:string[];updatedAt:string|null}
export const getStorePlatformConfigs=()=>api.get<StorePlatformConfigView[]>("/store-platform-configs");
export const saveStorePlatformConfig=(platform:string,credentials:Record<string,string>,enabled:boolean)=>api.put<StorePlatformConfigView>(`/store-platform-configs/${platform}`,{credentials,enabled});

// 各能力当前是否可用（纯本地判定：部署开关 + 设置中心 + 是否填 Key，不发网络请求）。
export const getCapabilities = () =>
  agentApi.get<{
    llm: { available: boolean; reason: string };
    monitor: { available: boolean; reason: string };
  }>("/ecommerce/capabilities");
