import { api } from "./client";
import type { AgentRun } from "./types";

export const getAgentRunsByPlan = (operationPlanId: number) =>
  api.get<AgentRun[]>(`/agent-runs/by-operation-plan/${operationPlanId}`);
