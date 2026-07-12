import { agentApi } from "./client";
import type { Json } from "./types";

export interface NewProductIdea {
  name: string;
  category: string;
  description: string;
  targetAudience?: string;
  usageScenario?: string;
}

// 线1上架：把用户想法交给商品规划 Agent，返回结构化文案
export const generateProductPlan = (idea: NewProductIdea) =>
  agentApi.post<Json>("/ecommerce/line1/product-plan", idea);

// 线1上架：基于想法+文案，生成图片创意方案
export const generateImagePlan = (idea: NewProductIdea, productPlan: Json) =>
  agentApi.post<Json>("/ecommerce/line1/image-plan", { idea, product_plan: productPlan });

// 线1上架：落库（先建商品，再建运营计划），返回新建 id
export const finalizeListing = (idea: NewProductIdea, productPlan: Json, imagePlan: Json) =>
  agentApi.post<{ ok: boolean; productId: number | null; operationPlanId: number | null }>(
    "/ecommerce/line1/finalize",
    { idea, product_plan: productPlan, image_plan: imagePlan },
  );
