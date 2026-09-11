import type { RequestHandler } from "express";
import * as healthService from "../services/health.service.js";

export const getHealth: RequestHandler = async (_request, response) => {
  const health = await healthService.checkHealth();
  response.status(health.status === "ok" ? 200 : 503).json({
    ...health,
    service: "voxreels-api",
  });
};
