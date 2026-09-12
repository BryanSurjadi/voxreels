import { randomUUID } from "node:crypto";
import { AppError } from "../middlewares/error.middleware.js";
import * as brandRepository from "../repositories/brand.repository.js";
import type { CreateBrandInput } from "../schemas/brand.schema.js";

export function listBrands(workspaceId: string) {
  return brandRepository.findAllByWorkspace(workspaceId);
}

function brandSlug(name: string) {
  const base = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);

  return `${base || "brand"}-${randomUUID().slice(0, 8)}`;
}

export function createBrand(workspaceId: string, input: CreateBrandInput) {
  return brandRepository.create(workspaceId, input.name, brandSlug(input.name));
}

export async function updateBrand(
  workspaceId: string,
  brandId: string,
  input: CreateBrandInput,
) {
  const brand = await brandRepository.update(workspaceId, brandId, input.name);
  if (!brand) throw new AppError(404, "BRAND_NOT_FOUND", "Brand not found");
  return brand;
}
