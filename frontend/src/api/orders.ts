import { api } from "./client";
import type { InsufficientStockSummary, Order, RecheckAllResult } from "./types";

export const getOrders = () => api.get<Order[]>("/orders");

export const getOrder = (id: number) => api.get<Order>(`/orders/${id}`);

export const completeAddress = (id: number) =>
  api.post<Order>(`/orders/${id}/complete-address`, {}, { silent: true });

export const markPaid = (id: number) =>
  api.post<Order>(`/orders/${id}/mark-paid`, {}, { silent: true });

// 发货闭环：仅「可发货(READY_TO_SHIP)」或「发货失败(SHIPPING_FAILED)」可调；
// 后端回写平台发货 API：成功置 SHIPPED，失败置 SHIPPING_FAILED（保留原因，可重试）。
// body 携带商家选择的物流信息（logisticsCompany 必选，waybillNo 缺省后端自动生成），
// shippingFee 为本次「卖家 -> 买家」实际发货运费（与采购单进货运费严格区分）。
export const shipOrder = (
  id: number,
  body: { logisticsCompany: string; waybillNo?: string; shippingFee?: number | null; shippingFeeType?: string }
) => api.post<Order>(`/orders/${id}/ship`, body, { silent: true });

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

export const cancelOrder = (id: number, reason: string) =>
  api.post<Order>(`/orders/${id}/cancel`, { reason }, { silent: true });
