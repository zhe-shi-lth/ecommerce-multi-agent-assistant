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
}

export const createProduct = (input: CreateProductInput) =>
  api.post<Product>("/products", input);
