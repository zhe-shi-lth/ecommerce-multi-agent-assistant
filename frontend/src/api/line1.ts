import { agentApi } from "./client";
import type { Json } from "./types";

// 线1上架（目录优先）：勾选已有商品 + 选中平台，逐商品走 出图→图片审批→文生文→审批→落库。
// 出图（image-plan）先于文案（product-plan）：图片按商品+备注（可选商品图做图生图）生成，
// 文案（文生文）按商品+备注生成，两者相互独立。
export const generateProductPlan = (body: {
  product_id: number;
  platforms: string[];
  notes?: string;
}) => agentApi.post<Json>("/ecommerce/line1/product-plan", body);

export const generateImagePlan = (body: {
  product_id: number;
  platforms: string[];
  reference_image?: string;
  notes?: string;
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
