// 与 Java 响应 DTO 对齐的类型定义（camelCase）。
// 注意：OperationPlan 的 *PlanJson 是 Python model_dump() 的 JSON，键为 snake_case。

export type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

export interface OperationPlan {
  id: number;
  traceId: string;
  productId: number;
  orderId: number;
  platform: string;
  productPlanJson: Record<string, Json> | null;
  imagePlanJson: Record<string, Json> | null;
  inventoryPlanJson: Record<string, Json> | null;
  fulfillmentPlanJson: Record<string, Json> | null;
  finalSummary: string;
  manualReviewRequired: boolean;
  status: string;
  confirmationStatus: string;
  confirmedAt: string | null;
  createdAt: string;
  updatedAt: string;
  auditPassed?: boolean | null;
  auditMessage?: string | null;
  line?: string | null;
}

export interface AgentRun {
  id: number;
  traceId: string;
  operationPlanId: number;
  agentName: string;
  inputJson: Record<string, Json> | null;
  outputJson: Record<string, Json> | null;
  status: string;
  durationMs: number | null;
  errorMessage: string | null;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface Category {
  id: number;
  name: string;
  createdAt: string;
}

export interface Product {
  id: number;
  name: string;
  category: string;
  description: string;
  costPrice: number;
  salePrice: number;
  targetAudience: string | null;
  usageScenario: string | null;
  status: string;
  supplierId?: number | null;
  supplierName?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Inventory {
  id: number;
  productId: number;
  currentStock: number;
  reservedStock: number;
  safeStockThreshold: number;
  purchaseCycleDays: number;
  salesLast7Days: number;
  inventoryStatus: string;
  createdAt: string;
  updatedAt: string;
}

export interface Order {
  id: number;
  productId: number;
  platform: string;
  // 平台侧订单号（可拿去平台后台核对同一笔订单）；老数据可能为空
  platformOrderId?: string;
  quantity: number;
  status: string;
  addressComplete: boolean;
  paid: boolean;
  manualReviewRequired: boolean;
  fulfillmentSuggestionStatus: string;
  // 待处理原因（仅 status=PENDING_ANALYSIS 有意义）：UNPAID / ADDRESS_INCOMPLETE / UNPAID_AND_ADDRESS
  pendingReason?: string | null;
  fulfillmentPlanJson?: Record<string, Json> | null;
  receiverName?: string | null;
  receiverPhone?: string | null;
  receiverProvince?: string | null;
  receiverCity?: string | null;
  receiverDistrict?: string | null;
  receiverDetail?: string | null;
  buyerNick?: string | null;
  payment?: number | string | null;
  postFee?: number | string | null;
  shippingFee?: number | string | null; // 发货运费（卖家 -> 买家，发货时手填）
  shippingFeeType?: string | null; // MANUAL / TEMPLATE
  costPriceSnapshot?: number | string | null; // 发货时商品成本价快照
  goodsCostSnapshot?: number | string | null; // 商品成本合计快照
  grossProfit?: number | string | null; // 预估毛利快照（发货成功时写入，历史不漂）
  logisticsCompany?: string | null;
  waybillNo?: string | null;
  encrypted?: boolean | null;
  shippedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DailySales {
  id: number;
  productId: number;
  platform: string;
  saleDate: string;
  revenue: number;
  units: number;
  orderCount: number;
}

// 线2 智能库存预警（销售监控页警告板块）
export interface InventoryWarning {
  productId: number;
  productName: string;
  currentStock: number;
  dailyDemand: number;
  adjustedDemand: number;
  eventMultiplier: number;
  activeEvents: string[];
  sellableDays: number | null;
  level: string;
  warnings: string[];
}

// 库存不足订单按商品汇总（销售监控页「库存不足订单」警告板块）
export interface InsufficientStockSummary {
  productId: number;
  productName: string;
  backlogQuantity: number; // 积压销量合计（INSUFFICIENT_STOCK 订单）
  orderCount: number; // 积压订单笔数
  currentStock: number; // 该商品当前库存
  shortQuantity: number; // 缺口 = max(0, backlogQuantity − currentStock)
}

// 批量「重新判定」库存不足订单的统计结果（订单 tab 按钮回执）
export interface RecheckAllResult {
  total: number; // 参与判定的 INSUFFICIENT_STOCK 订单数
  readyToShip: number; // 库存充足已翻回可发货的笔数
  stillInsufficient: number; // 库存仍不足、保持原状的笔数
  other: number; // 因未付款/地址不全翻回其他态的笔数
}

// 采购补货单（线2 库存处理工作台）
export interface PurchaseOrder {
  id: number;
  productId: number;
  quantity: number;
  supplierId?: number | null;
  supplierName?: string | null;
  status: string; // CREATED / ORDERED / INBOUND / STOCKED
  note?: string | null;
  // 成本核算字段（成本闭环）
  unitCost?: number | string | null; // 进货单价
  productAmount?: number | string | null; // 商品金额 = unitCost * quantity
  purchaseShippingFee?: number | string | null; // 进货运费（供应商 -> 仓库）
  totalCost?: number | string | null; // 总成本 = productAmount + purchaseShippingFee
  landedUnitCost?: number | string | null; // 单件综合成本 = totalCost / actualQuantity
  expectedArrivalAt?: string | null; // 预计到货时间
  actualQuantity?: number | null; // 实际入库数量（默认 = quantity）
  inboundNote?: string | null; // 入库备注（破损/少发说明）
  orderedAt?: string | null;
  inboundAt?: string | null;
  stockedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

// 进货商家档案（主数据）
export interface Supplier {
  id: number;
  name: string;
  contactName?: string | null;
  contactPhone?: string | null;
  address?: string | null;
  settlementType?: "MONTHLY" | "CASH" | "PREPAID" | null;
  leadTimeDays: number;
  status: "ACTIVE" | "DISABLED";
  remark?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierInput {
  name: string;
  contactName?: string | null;
  contactPhone?: string | null;
  address?: string | null;
  settlementType?: "MONTHLY" | "CASH" | "PREPAID" | null;
  leadTimeDays?: number;
  status?: "ACTIVE" | "DISABLED";
  remark?: string | null;
}

// 入库结果：本采购单 + 入库后触发的缺货订单重判统计
export interface StockInResult {
  purchaseOrder: PurchaseOrder;
  recheck: RecheckAllResult;
}
