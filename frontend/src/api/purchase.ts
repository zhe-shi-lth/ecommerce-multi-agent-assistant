import { api } from "./client";
import type { PurchaseOrder, PurchaseReceipt, StockInResult } from "./types";

// 采购补货（线2 库存处理工作台）API。
export const getPurchaseOrders = (status?: string) =>
  api.get<PurchaseOrder[]>(`/purchase-orders${status ? `?status=${encodeURIComponent(status)}` : ""}`);

// 发起采购申请（初始态 PENDING_APPROVAL=待审批）。
export const createPurchaseOrder = (body: {
  productId: number;
  quantity: number;
  supplierId?: number | null;
  unitCost?: number | null;
  purchaseShippingFee?: number | null;
  expectedArrivalAt?: string | null;
  note?: string;
}) => api.post<PurchaseOrder>("/purchase-orders", body, { silent: true });

// 待审批 → 待采购
export const approvePurchaseOrder = (id: number) =>
  api.post<PurchaseOrder>(`/purchase-orders/${id}/approve`, {}, { silent: true });

// 待审批 → 已驳回
export const rejectPurchaseOrder = (id: number) =>
  api.post<PurchaseOrder>(`/purchase-orders/${id}/reject`, {}, { silent: true });

// 待采购 → 已下单
export const markOrdered = (id: number) =>
  api.post<PurchaseOrder>(`/purchase-orders/${id}/mark-ordered`, {}, { silent: true });

// 已下单 → 待入库
export const markInbound = (id: number) =>
  api.post<PurchaseOrder>(`/purchase-orders/${id}/mark-inbound`, {}, { silent: true });

// 待入库 → 已入库：增加库存并触发该商品缺货订单重新判定，返回重判统计。
// body 可传实际入库数量与实际到货备注（支持「买 100 到 98」）。
export const stockIn = (id: number, body?: { receiptNo: string; actualQuantity?: number; note?: string }) =>
  api.post<StockInResult>(`/purchase-orders/${id}/stock-in`, body ?? {}, { silent: true });

export const getPurchaseReceipts = (id: number) =>
  api.get<PurchaseReceipt[]>(`/purchase-orders/${id}/receipts`);

export const cancelPurchaseOrder = (id: number, reason: string) =>
  api.post<PurchaseOrder>(`/purchase-orders/${id}/cancel`, { reason }, { silent: true });

export const closeShortPurchaseOrder = (id: number, reason: string) =>
  api.post<PurchaseOrder>(`/purchase-orders/${id}/close-short`, { reason }, { silent: true });
