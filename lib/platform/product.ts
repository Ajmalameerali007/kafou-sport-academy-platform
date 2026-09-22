import { api } from "./client";
export type ProductRow = Record<string, unknown>;
export type ProductData = Record<string, ProductRow[]>;
export const productCommand = <T = ProductRow>(
  action: string,
  data: unknown,
  key = crypto.randomUUID(),
) => api<T>("product", { action, data, key });
export const productService = {
  read: () => api<ProductData>("product"),
  command: productCommand,
};
