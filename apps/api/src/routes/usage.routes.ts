import { Router } from "express";
import { requireAuth } from "../middlewares/auth.middleware.js";
import { getUsage } from "../services/ai-quota.service.js";

export const usageRouter = Router();
usageRouter.get("/", requireAuth, async (request, response) => {
  response.json({ data: await getUsage(request.auth!.workspaceId) });
});
