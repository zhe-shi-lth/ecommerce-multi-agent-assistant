import { api } from "./client";
import type { Supplier, SupplierInput } from "./types";

// 进货商家档案（主数据）API。
export const getSuppliers = () => api.get<Supplier[]>("/suppliers");

export const createSupplier = (input: SupplierInput) =>
  api.post<Supplier>("/suppliers", input);

export const updateSupplier = (id: number, input: SupplierInput) =>
  api.put<Supplier>(`/suppliers/${id}`, input);

export const deleteSupplier = (id: number) => api.delete<void>(`/suppliers/${id}`);
