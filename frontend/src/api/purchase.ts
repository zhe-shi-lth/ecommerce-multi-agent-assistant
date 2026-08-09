import { api } from "./client";
import type { PurchaseOrder, StockInResult } from "./types";

// 采购补货（线2 库存处理工作台）API。
export const getPurchaseOrders = (status?: string) =>
  api.get<PurchaseOrder[]>(`/purchase-orders${status ? `?status=${encodeURIComponent(status)}` : ""}`);

// 由「待确认补货建议」确认生成采购单（初始态 CREATED=待采购）。
export const createPurchaseOrder = (body: { productId: number; quantity: number; supplier?: string; note?: string }) =>
  api.post<PurchaseOrder>("/purchase-orders", body, { silent: true });

// 待采购 → 已下单
export const markOrdered = (id: number) =>
  api.post<PurchaseOrder>(`/purchase-orders/${id}/mark-ordered`, {}, { silent: true });

// 已下单 → 待入库
export const markInbound = (id: number) =>
  api.post<PurchaseOrder>(`/purchase-orders/${id}/mark-inbound`, {}, { silent: true });

// 待入库 → 已入库：增加库存并触发该商品缺货订单重新判定，返回重判统计。
export const stockIn = (id: number) =>
  api.post<StockInResult>(`/purchase-orders/${id}/stock-in`, {}, { silent: true });
