import { api } from "./client";
import type { DailySales, FavoriteCopy, OperationPlan } from "./types";

export const getOperationPlans = () => api.get<OperationPlan[]>("/operation-plans");

export const getOperationPlan = (id: number) =>
  api.get<OperationPlan>(`/operation-plans/${id}`);

export const confirmOperationPlan = (id: number) =>
  api.post<OperationPlan>(`/operation-plans/${id}/confirm`);

export const rejectOperationPlan = (id: number) =>
  api.post<OperationPlan>(`/operation-plans/${id}/reject`);

export const exportOperationPlan = (id: number, platform: string) =>
  api.get<{ platform: string; content: string }>(
    `/operation-plans/${id}/export?platform=${encodeURIComponent(platform)}`
  );

export const listFavoriteCopies = () => api.get<FavoriteCopy[]>("/favorite-copies");

export const createFavoriteCopy = (body: {
  label: string;
  content: string;
  tags?: string;
  sourcePlanId?: number;
}) => api.post<FavoriteCopy>("/favorite-copies", body);

export const deleteFavoriteCopy = (id: number) =>
  api.delete(`/favorite-copies/${id}`);

export const listDailySales = (productId?: number) =>
  api.get<DailySales[]>(
    `/daily-sales${productId != null ? `?productId=${productId}` : ""}`
  );
