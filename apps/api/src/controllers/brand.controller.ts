import type { RequestHandler } from "express";
import {
  brandIdParamsSchema,
  createBrandSchema,
  updateBrandSchema,
} from "../schemas/brand.schema.js";
import * as brandService from "../services/brand.service.js";

export const list: RequestHandler = async (request, response) => {
  const brands = await brandService.listBrands(request.auth!.workspaceId);
  response.json({ data: brands });
};

export const create: RequestHandler = async (request, response) => {
  const input = createBrandSchema.parse(request.body);
  const brand = await brandService.createBrand(request.auth!.workspaceId, input);
  response.status(201).json({ data: brand });
};

export const update: RequestHandler = async (request, response) => {
  const { brandId } = brandIdParamsSchema.parse(request.params);
  const input = updateBrandSchema.parse(request.body);
  const brand = await brandService.updateBrand(request.auth!.workspaceId, brandId, input);
  response.json({ data: brand });
};
