import { api } from "./client";
import type { Json } from "./types";

export interface PlatformTask {
  id: number;
  idempotencyKey: string;
  actionType: string;
  entityType: string;
  entityId: number;
  platform: string;
  status: string;
  requestJson: Record<string, Json>;
  responseJson?: Record<string, Json> | null;
  attemptCount: number;
  maxAttempts: number;
  lastError?: string | null;
  nextRetryAt?: string | null;
  externalSucceededAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export const getPlatformTasks = (entityType: string, entityId: number) =>
  api.get<PlatformTask[]>(
    `/platform-tasks?entityType=${encodeURIComponent(entityType)}&entityId=${entityId}`,
  );

export const retryPlatformTask = (id: number) =>
  api.post<PlatformTask>(`/platform-tasks/${id}/retry`, {}, { silent: true });
