import { Router } from "express";
import rateLimit from "express-rate-limit";
import * as projectController from "../controllers/project.controller.js";
import * as scriptController from "../controllers/script.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";

export const projectsRouter = Router();

projectsRouter.use(requireAuth);
const scriptGenerationLimiter = rateLimit({
  windowMs: 60_000,
  limit: 5,
  keyGenerator: (request) => request.auth!.userId,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: { code: "RATE_LIMITED", message: "Too many script generation requests" },
  },
});

projectsRouter.get("/", projectController.list);
projectsRouter.post("/", projectController.create);
projectsRouter.post(
  "/:projectId/scripts/generate",
  scriptGenerationLimiter,
  scriptController.generate,
);
projectsRouter.get("/:projectId", projectController.get);
projectsRouter.patch("/:projectId", projectController.update);
