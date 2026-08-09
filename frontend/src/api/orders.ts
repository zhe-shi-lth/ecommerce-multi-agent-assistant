import { api } from "./client";
import type { Order } from "./types";

export const getOrders = () => api.get<Order[]>("/orders");

export const getOrder = (id: number) => api.get<Order>(`/orders/${id}`);

export const completeAddress = (id: number) =>
  api.post<Order>(`/orders/${id}/complete-address`, {}, { silent: true });
