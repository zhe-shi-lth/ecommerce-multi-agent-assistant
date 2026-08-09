import { api } from "./client";
import type { InsufficientStockSummary, Order, RecheckAllResult } from "./types";

export const getOrders = () => api.get<Order[]>("/orders");

export const getOrder = (id: number) => api.get<Order>(`/orders/${id}`);

export const completeAddress = (id: number) =>
  api.post<Order>(`/orders/${id}/complete-address`, {}, { silent: true });

export const markPaid = (id: number) =>
  api.post<Order>(`/orders/${id}/mark-paid`, {}, { silent: true });

// 发货闭环终态：仅「可发货(READY_TO_SHIP)」可发货；后端置 SHIPPED + 发货时间。
export const shipOrder = (id: number) =>
  api.post<Order>(`/orders/${id}/ship`, {}, { silent: true });

// 人工审核决议：对「需人工审核(NEEDS_REVIEW)」订单通过 / 驳回。
export const reviewOrder = (id: number, decision: "APPROVE" | "REJECT") =>
  api.post<Order>(`/orders/${id}/review`, { decision }, { silent: true });

// 库存补足后「重新判定」：仅「库存不足(INSUFFICIENT_STOCK)」订单可触发，手动闭环最后一步；
// 后端校验库存仍不足则 409（前端弹窗提示缺口），否则按事实翻回 READY_TO_SHIP 等。
export const recheckOrder = (id: number) =>
  api.post<Order>(`/orders/${id}/recheck`, {}, { silent: true });

// 库存不足订单按商品汇总（销售监控「库存不足订单」警告板块）：仅统计 INSUFFICIENT_STOCK 订单。
export const getInsufficientSummary = () =>
  api.get<InsufficientStockSummary[]>("/orders/insufficient-summary");

// 批量「重新判定」所有库存不足订单（订单 tab 顶部按钮）：补货完成后按当前库存重算状态（不改动库存），返回统计。
export const recheckAllOrders = () =>
  api.post<RecheckAllResult>("/orders/recheck-all", {}, { silent: true });

// 单商品「重新判定」（销售监控「库存不足订单」对应位置按钮）：补货完成后重算该商品库存不足订单状态，不改动库存。
export const recheckProductOrders = (productId: number) =>
  api.post<RecheckAllResult>(`/orders/recheck/${productId}`, {}, { silent: true });
