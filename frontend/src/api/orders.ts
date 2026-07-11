import { api } from "./client";
import type { Order } from "./types";

export const getOrders = () => api.get<Order[]>("/orders");
