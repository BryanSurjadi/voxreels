import type { RequestHandler } from "express";
import {
  createProjectSchema,
  projectIdParamsSchema,
  updateProjectSchema,
} from "../schemas/project.schema.js";
import * as projectService from "../services/project.service.js";

export const list: RequestHandler = async (request, response) => {
  const projects = await projectService.listProjects(request.auth!.workspaceId);
  response.json({ data: projects });
};

export const get: RequestHandler = async (request, response) => {
  const { projectId } = projectIdParamsSchema.parse(request.params);
  const project = await projectService.getProject(request.auth!.workspaceId, projectId);
  response.json({ data: project });
};

export const create: RequestHandler = async (request, response) => {
  const input = createProjectSchema.parse(request.body);
  const project = await projectService.createProject(
    request.auth!.workspaceId,
    request.auth!.userId,
    input,
  );
  response.status(201).json({ data: project });
};

export const update: RequestHandler = async (request, response) => {
  const { projectId } = projectIdParamsSchema.parse(request.params);
  const input = updateProjectSchema.parse(request.body);
  const project = await projectService.updateProject(
    request.auth!.workspaceId,
    projectId,
    input,
  );
  response.json({ data: project });
};
