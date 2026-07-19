import { agentApi } from "./client";

export type CapFeature = "llm" | "vision" | "image";
export type Capabilities = Record<CapFeature, { available: boolean; reason?: string }>;

// 各模型功能当前是否可用（基于后端部署开关 + 运行时设置 + 是否填了 API Key）。
export const getCapabilities = () => agentApi.get<Capabilities>("/ecommerce/capabilities");
