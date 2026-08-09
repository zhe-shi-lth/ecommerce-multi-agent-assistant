import { agentApi } from "./client";

export type CapFeature = "llm" | "image" | "video";
export interface CapState {
  available: boolean;
  reason?: string;
}

// 模型能力（llm/image/video）+ 非模型能力（监控、订单地址复核、按平台的对接就绪状态）。
export type Capabilities = Record<CapFeature, CapState> & {
  monitor?: CapState;
  order_monitor?: CapState;
  platform_api?: Record<string, CapState>;
};

// 各模型功能当前是否可用（基于后端部署开关 + 运行时设置 + 是否填了 API Key）。
export const getCapabilities = () => agentApi.get<Capabilities>("/ecommerce/capabilities");
