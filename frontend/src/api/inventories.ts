import { api } from "./client";
import type { Inventory } from "./types";

export const getInventories = () => api.get<Inventory[]>("/inventories");

export interface CreateInventoryInput {
  productId: number;
  currentStock: number;
  safeStockThreshold: number;
  reservedStock?: number;
  purchaseCycleDays?: number;
  salesLast7Days?: number;
}

export const createInventory = (input: CreateInventoryInput) =>
  api.post<Inventory>("/inventories", input);

// 补货/调整：整体更新某条库存记录（与 Java InventoryCreateRequest 对齐）。
export interface UpdateInventoryInput {
  productId: number;
  currentStock: number;
  safeStockThreshold: number;
  reservedStock?: number;
  purchaseCycleDays?: number;
  salesLast7Days?: number;
  inventoryStatus?: string;
}

export const updateInventory = (id: number, input: UpdateInventoryInput) =>
  api.put<Inventory>(`/inventories/${id}`, input);
