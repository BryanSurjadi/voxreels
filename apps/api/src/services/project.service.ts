import { AppError } from "../middlewares/error.middleware.js";
import * as projectRepository from "../repositories/project.repository.js";
import type {
  CreateProjectInput,
  UpdateProjectInput,
} from "../schemas/project.schema.js";

export function listProjects(workspaceId: string) {
  return projectRepository.findAll(workspaceId);
}

export async function getProject(workspaceId: string, projectId: string) {
  const project = await projectRepository.findById(workspaceId, projectId);
  if (!project) throw new AppError(404, "PROJECT_NOT_FOUND", "Project not found");
  return project;
}

export async function createProject(
  workspaceId: string,
  userId: string,
  input: CreateProjectInput,
) {
  const brand = input.brandId
    ? await projectRepository.findBrand(workspaceId, input.brandId)
    : await projectRepository.findDefaultBrand(workspaceId);

  if (!brand) {
    throw new AppError(400, "BRAND_REQUIRED", "Create a brand before creating a project");
  }

  const name = input.name ?? input.topic.slice(0, 80);
  return projectRepository.create({
    workspaceId,
    createdById: userId,
    brandId: brand.id,
    name,
    topic: input.topic,
    ...(input.goal !== undefined && { goal: input.goal }),
    ...(input.offer !== undefined && { offer: input.offer }),
    ...(input.callToAction !== undefined && { callToAction: input.callToAction }),
    ...(input.targetDurationSeconds !== undefined && {
      targetDurationSeconds: input.targetDurationSeconds,
    }),
  });
}

export async function updateProject(
  workspaceId: string,
  projectId: string,
  input: UpdateProjectInput,
) {
  await getProject(workspaceId, projectId);

  if (input.brandId && !(await projectRepository.findBrand(workspaceId, input.brandId))) {
    throw new AppError(400, "INVALID_BRAND", "Brand does not belong to this workspace");
  }

  await projectRepository.update(workspaceId, projectId, {
    ...(input.brandId !== undefined && { brandId: input.brandId }),
    ...(input.name !== undefined && { name: input.name }),
    ...(input.topic !== undefined && { topic: input.topic }),
    ...(input.goal !== undefined && { goal: input.goal }),
    ...(input.offer !== undefined && { offer: input.offer }),
    ...(input.callToAction !== undefined && { callToAction: input.callToAction }),
    ...(input.targetDurationSeconds !== undefined && {
      targetDurationSeconds: input.targetDurationSeconds,
    }),
    ...(input.status !== undefined && { status: input.status }),
  });
  return getProject(workspaceId, projectId);
}
