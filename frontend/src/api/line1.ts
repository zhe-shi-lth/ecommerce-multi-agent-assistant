import { agentApi } from "./client";
import type { Json } from "./types";

// 线1上架（目录优先）：勾选已有商品 + 选中平台，逐商品走 文案→图片→审批→落库。
export const generateProductPlan = (body: { product_id: number; platforms: string[] }) =>
  agentApi.post<Json>("/ecommerce/line1/product-plan", body);

export const generateImagePlan = (body: {
  product_id: number;
  platforms: string[];
  product_plan: Json;
  reference_image?: string;
}) => agentApi.post<Json>("/ecommerce/line1/image-plan", body);

// 落库（建运营计划挂到已有商品）。真实"发布到小红书"由 M3 接入。
export const finalizeListing = (body: {
  product_id: number;
  platforms: string[];
  product_plan: Json;
  image_plan: Json;
}) =>
  agentApi.post<{ ok: boolean; productId: number | null; operationPlanId: number | null }>(
    "/ecommerce/line1/finalize",
    body,
  );
