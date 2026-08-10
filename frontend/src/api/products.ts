import { api } from "./client";
import type { Product } from "./types";

export const getProducts = () => api.get<Product[]>("/products");

export interface CreateProductInput {
  name: string;
  category: string;
  description: string;
  costPrice: number;
  salePrice: number;
  targetAudience?: string;
  usageScenario?: string;
  status?: string;
  supplierId?: number | null;
}

export const createProduct = (input: CreateProductInput) =>
  api.post<Product>("/products", input);

// 编辑商品（PUT /products/{id}）。supplierId 传 null 表示清空供应商，不传则保留原值。
export const updateProduct = (id: number, input: CreateProductInput) =>
  api.put<Product>(`/products/${id}`, input);
