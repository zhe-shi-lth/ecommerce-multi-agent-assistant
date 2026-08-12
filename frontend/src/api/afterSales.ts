import { api } from "./client";
import type { AfterSalesOrder } from "./types";

export const getAfterSales = (orderId: number) =>
  api.get<AfterSalesOrder[]>(`/after-sales?orderId=${orderId}`);

export const createAfterSale = (body: {
  orderId: number;
  type: "REFUND_ONLY" | "RETURN_REFUND";
  quantity: number;
  refundAmount: number;
  reason: string;
}) => api.post<AfterSalesOrder>("/after-sales", body, { silent: true });

export const approveAfterSaleRefund = (id: number) =>
  api.post<AfterSalesOrder>(`/after-sales/${id}/approve-refund`, {}, { silent: true });

export const rejectAfterSale = (id: number, reason: string) =>
  api.post<AfterSalesOrder>(`/after-sales/${id}/reject`, { reason }, { silent: true });

export const receiveAfterSaleReturn = (id: number, disposition: "RESTOCK" | "DAMAGED", note?: string) =>
  api.post<AfterSalesOrder>(`/after-sales/${id}/receive-return`, { disposition, note }, { silent: true });
