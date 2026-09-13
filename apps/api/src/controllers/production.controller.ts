import type { RequestHandler } from "express";
import { projectIdParamsSchema } from "../schemas/project.schema.js";
import { addTimelineItemSchema, brollGenerationSchema, mediaParamsSchema, timelineParamsSchema, updateTimelineSchema, voiceGenerationSchema } from "../schemas/production.schema.js";
import * as productionService from "../services/production.service.js";

export const generateVoice: RequestHandler = async (request, response) => {
  const { projectId } = projectIdParamsSchema.parse(request.params);
  const result = await productionService.generateVoice(request.auth!.workspaceId, projectId, voiceGenerationSchema.parse(request.body ?? {}));
  response.status(201).json({ data: result });
};

export const generateBroll: RequestHandler = async (request, response) => {
  const { projectId } = projectIdParamsSchema.parse(request.params);
  const result = await productionService.generateBroll(request.auth!.workspaceId, projectId, brollGenerationSchema.parse(request.body ?? {}));
  response.status(201).json({ data: result });
};

export const initializeTimeline: RequestHandler = async (request, response) => {
  const { projectId } = projectIdParamsSchema.parse(request.params);
  response.status(201).json({ data: await productionService.initializeTimeline(request.auth!.workspaceId, projectId) });
};

export const updateTimeline: RequestHandler = async (request, response) => {
  const { projectId, timelineId } = timelineParamsSchema.parse(request.params);
  const { items } = updateTimelineSchema.parse(request.body);
  response.json({ data: await productionService.updateTimeline(request.auth!.workspaceId, projectId, timelineId, items) });
};

export const addTimelineItem: RequestHandler = async (request, response) => {
  const { projectId, timelineId } = timelineParamsSchema.parse(request.params);
  response.status(201).json({ data: await productionService.addTimelineItem(request.auth!.workspaceId, projectId, timelineId, addTimelineItemSchema.parse(request.body)) });
};

export const uploadMedia: RequestHandler = async (request, response) => {
  const { projectId } = projectIdParamsSchema.parse(request.params);
  const fileName = typeof request.headers["x-file-name"] === "string" ? decodeURIComponent(request.headers["x-file-name"]) : "Uploaded media";
  const mimeType = request.headers["content-type"]?.split(";")[0] ?? "";
  if (!Buffer.isBuffer(request.body)) throw new Error("Media body was not parsed");
  response.status(201).json({ data: await productionService.uploadMedia(request.auth!.workspaceId, projectId, request.body, fileName, mimeType) });
};

export const exportProject: RequestHandler = async (request, response) => {
  const { projectId } = projectIdParamsSchema.parse(request.params);
  response.status(201).json({ data: await productionService.exportProject(request.auth!.workspaceId, projectId) });
};

function media(kind: "voice" | "broll"): RequestHandler {
  return async (request, response) => {
    const { projectId, mediaId } = mediaParamsSchema.parse(request.params);
    const result = await productionService.getMedia(request.auth!.workspaceId, projectId, mediaId, kind);
    response.type(result.mimeType).send(result.data);
  };
}

export const voiceMedia = media("voice");
export const brollMedia = media("broll");
