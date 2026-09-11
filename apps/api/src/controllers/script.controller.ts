import type { RequestHandler } from "express";
import { projectIdParamsSchema } from "../schemas/project.schema.js";
import { generateScriptSchema } from "../schemas/script.schema.js";
import * as scriptService from "../services/script.service.js";

export const generate: RequestHandler = async (request, response) => {
  const { projectId } = projectIdParamsSchema.parse(request.params);
  const input = generateScriptSchema.parse(request.body ?? {});
  const script = await scriptService.generateScript(
    request.auth!.workspaceId,
    projectId,
    request.auth!.userId,
    input,
  );
  response.status(201).json({ data: script });
};
