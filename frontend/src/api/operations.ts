import { api } from "./client";
import type { DailySales, OperationPlan } from "./types";

export const getOperationPlans = () => api.get<OperationPlan[]>("/operation-plans");

export const getOperationPlan = (id: number) =>
  api.get<OperationPlan>(`/operation-plans/${id}`);

export const confirmOperationPlan = (id: number) =>
  api.post<OperationPlan>(`/operation-plans/${id}/confirm`);

export const rejectOperationPlan = (id: number) =>
  api.post<OperationPlan>(`/operation-plans/${id}/reject`);

export const unpublishOperationPlan = (id: number) =>
  api.post<OperationPlan>(`/operation-plans/${id}/unpublish`);

export const deleteOperationPlan = (id: number) =>
  api.delete(`/operation-plans/${id}`);

export const exportOperationPlan = (id: number, platform: string) =>
  api.get<{ platform: string; content: string }>(
    `/operation-plans/${id}/export?platform=${encodeURIComponent(platform)}`
  );

export const listDailySales = (productId?: number) =>
  api.get<DailySales[]>(
    `/daily-sales${productId != null ? `?productId=${productId}` : ""}`
  );
