import { agentApi } from "./client";
import type { InventoryWarning } from "./types";

// 线2 智能库存预警：销售监控页根据可售天数(<5天)给出预警。
export const getInventoryWarnings = () =>
  agentApi.get<InventoryWarning[]>("/ecommerce/line2/inventory-warnings");

// 线2 闭环：对全部预警商品生成"补货计划清单"并落库（Java, line=LINE2_RESTOCK）。
export const generateRestockPlans = () =>
  agentApi.post<{
    generated: number;
    created: Array<{
      productId: number;
      productName: string;
      operationPlanId: number;
      suggestedRestockQuantity: number;
      restockPriority: string;
    }>;
    skipped: Array<{ productId: number; productName: string }>;
    failed: Array<{ productId: number; productName: string }>;
    error?: string;
  }>("/ecommerce/line2/generate-restock-plans");
