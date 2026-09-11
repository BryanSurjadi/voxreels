import type { RequestHandler } from "express";
import * as brandService from "../services/brand.service.js";

export const list: RequestHandler = async (request, response) => {
  const brands = await brandService.listBrands(request.auth!.workspaceId);
  response.json({ data: brands });
};
