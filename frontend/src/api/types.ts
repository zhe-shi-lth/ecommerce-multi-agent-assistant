// 与 Java 响应 DTO 对齐的类型定义（camelCase）。
// 注意：OperationPlan 的 *PlanJson 是 Python model_dump() 的 JSON，键为 snake_case。

export type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

export interface OperationPlan {
  id: number;
  traceId: string;
  productId: number;
  orderId: number;
  productPlanJson: Record<string, Json> | null;
  imagePlanJson: Record<string, Json> | null;
  inventoryPlanJson: Record<string, Json> | null;
  fulfillmentPlanJson: Record<string, Json> | null;
  finalSummary: string;
  manualReviewRequired: boolean;
  status: string;
  createdAt: string;
  updatedAt: string;
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
  quantity: number;
  status: string;
  addressComplete: boolean;
  paid: boolean;
  manualReviewRequired: boolean;
  fulfillmentSuggestionStatus: string;
  createdAt: string;
  updatedAt: string;
}
