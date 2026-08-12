import { api } from "./client";
import type { ProductListing } from "./types";

export const getProductListings = (productId?: number) =>
  api.get<ProductListing[]>(`/product-listings${productId ? `?productId=${productId}` : ""}`);
