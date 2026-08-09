import { api } from "./client";

export interface SimulationResult {
  ordersCreated: number;
  inventoriesUpdated: number;
  dailySalesUpserted: number;
}

export interface SimulatePullInput {
  platform?: string;
  planIds: number[];
  days?: number;
  maxOrdersPerDay?: number;
  maxQty?: number;
}

// 订单来源：mock=本地模拟造数；real=平台开放 API 拉取。由部署开关 DATA_SOURCE 决定，页面只读展示。
export interface DataSourceInfo {
  source: "mock" | "real";
  platforms: string[]; // real 模式下已完成对接（凭证齐全）的平台
}

export const getDataSource = () =>
  api.get<DataSourceInfo>("/simulation/data-source", { silent: true });

// 拉取平台订单：mock 模式为本地造数，real 模式为真实平台 API；两侧写库路径完全一致。
export const simulatePull = (body: SimulatePullInput) =>
  api.post<SimulationResult>("/simulation/pull-orders", body);
