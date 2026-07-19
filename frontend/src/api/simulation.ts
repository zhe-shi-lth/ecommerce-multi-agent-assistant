import { api } from "./client";

export interface SimulationResult {
  ordersCreated: number;
  inventoriesUpdated: number;
  dailySalesUpserted: number;
}

export interface SimulatePullInput {
  platform: string;
  productIds: number[];
  days?: number;
  maxOrdersPerDay?: number;
  maxQty?: number;
}

// 平台订单模拟拉取（本地造数，不调用真实平台 API）：生成订单并联动扣库存、写日销。
export const simulatePull = (body: SimulatePullInput) =>
  api.post<SimulationResult>("/simulation/pull-orders", body);
