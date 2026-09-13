import { Router, raw } from "express";
import rateLimit from "express-rate-limit";
import * as projectController from "../controllers/project.controller.js";
import * as scriptController from "../controllers/script.controller.js";
import * as productionController from "../controllers/production.controller.js";
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
const mediaGenerationLimiter = rateLimit({
  windowMs: 60_000,
  limit: 2,
  keyGenerator: (request) => request.auth!.userId,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: "RATE_LIMITED", message: "Wait a minute before generating more media" } },
});

projectsRouter.get("/", projectController.list);
projectsRouter.post("/", projectController.create);
projectsRouter.post(
  "/:projectId/scripts/generate",
  scriptGenerationLimiter,
  scriptController.generate,
);
projectsRouter.patch("/:projectId/scripts/:scriptVersionId", scriptController.update);
projectsRouter.post("/:projectId/scripts/:scriptVersionId/approve", scriptController.approve);
projectsRouter.post("/:projectId/voice/generate", mediaGenerationLimiter, productionController.generateVoice);
projectsRouter.post("/:projectId/broll/generate", mediaGenerationLimiter, productionController.generateBroll);
projectsRouter.get("/:projectId/voice/:mediaId", productionController.voiceMedia);
projectsRouter.get("/:projectId/broll/:mediaId", productionController.brollMedia);
projectsRouter.post("/:projectId/media", raw({ type: ["image/*", "audio/*", "video/*"], limit: "50mb" }), productionController.uploadMedia);
projectsRouter.post("/:projectId/timeline", productionController.initializeTimeline);
projectsRouter.patch("/:projectId/timeline/:timelineId", productionController.updateTimeline);
projectsRouter.post("/:projectId/timeline/:timelineId/items", productionController.addTimelineItem);
projectsRouter.post("/:projectId/export", productionController.exportProject);
projectsRouter.get("/:projectId", projectController.get);
projectsRouter.patch("/:projectId", projectController.update);
