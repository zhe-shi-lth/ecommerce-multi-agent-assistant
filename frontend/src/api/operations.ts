import { api } from "./client";
import type { OperationPlan } from "./types";

export const getOperationPlans = () => api.get<OperationPlan[]>("/operation-plans");

export const getOperationPlan = (id: number) =>
  api.get<OperationPlan>(`/operation-plans/${id}`);
