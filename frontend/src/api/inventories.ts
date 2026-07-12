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
