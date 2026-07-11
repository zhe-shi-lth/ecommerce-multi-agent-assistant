import { api } from "./client";
import type { Inventory } from "./types";

export const getInventories = () => api.get<Inventory[]>("/inventories");
