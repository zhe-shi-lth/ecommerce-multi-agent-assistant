import { api } from "./client";
import type { Product } from "./types";

export const getProducts = () => api.get<Product[]>("/products");
