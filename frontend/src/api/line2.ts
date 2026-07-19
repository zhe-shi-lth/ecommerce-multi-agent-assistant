import { agentApi } from "./client";
import type { InventoryWarning } from "./types";

// 线2 智能库存预警：销售监控页根据可售天数(<5天)给出预警。
export const getInventoryWarnings = () =>
  agentApi.get<InventoryWarning[]>("/ecommerce/line2/inventory-warnings");
