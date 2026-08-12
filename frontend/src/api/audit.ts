import { api } from "./client";

export interface BusinessAuditLog {
  id: number;
  domain: string;
  entityType: string;
  entityId: number;
  action: string;
  beforeStatus?: string | null;
  afterStatus?: string | null;
  operator: string;
  detail?: string | null;
  createdAt: string;
}

export const getAuditLogs = (entityType: "ORDER" | "PURCHASE_ORDER", entityId: number) =>
  api.get<BusinessAuditLog[]>(
    `/audit-logs?entityType=${encodeURIComponent(entityType)}&entityId=${entityId}`,
  );
