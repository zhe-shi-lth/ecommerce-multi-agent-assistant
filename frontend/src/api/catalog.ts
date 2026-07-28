import { agentApi } from "./client";

// 厂家+模型目录（后端 model_catalog 暴露），前端据此渲染下拉。
// 每个模型条目携带派生 base_url（已知厂家只读），杜绝手填错配。
export interface CatalogModel {
  id: string;
  label: string;
  kind?: string; // video 专用：t2v / i2v / edit
}

export interface VendorEntry {
  label: string;
  api_style: string;
  base_url: string;
  models: CatalogModel[];
}

// capability -> vendor -> VendorEntry
export type ModelCatalog = Record<string, Record<string, VendorEntry>>;

export const getCatalog = () => agentApi.get<ModelCatalog>("/ecommerce/model-catalog");
