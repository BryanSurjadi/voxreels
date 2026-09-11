import { prisma } from "../config/prisma.js";

export function findDefaultBrand(workspaceId: string) {
  return prisma.brand.findFirst({
    where: { workspaceId },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
}

export function findBrand(workspaceId: string, brandId: string) {
  return prisma.brand.findFirst({
    where: { id: brandId, workspaceId },
    select: { id: true },
  });
}

export function findAll(workspaceId: string) {
  return prisma.project.findMany({
    where: { workspaceId },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      topic: true,
      status: true,
      targetDurationSeconds: true,
      brand: { select: { id: true, name: true, slug: true } },
      _count: { select: { scriptVersions: true, mediaAssets: true, exports: true } },
      createdAt: true,
      updatedAt: true,
    },
  });
}

export function findById(workspaceId: string, projectId: string) {
  return prisma.project.findFirst({
    where: { id: projectId, workspaceId },
    include: {
      brand: { select: { id: true, name: true, slug: true } },
      scriptVersions: {
        orderBy: { version: "desc" },
        include: { beats: { orderBy: { order: "asc" } } },
      },
      mediaAssets: { orderBy: { createdAt: "desc" } },
      timelines: { orderBy: { version: "desc" } },
      exports: { orderBy: { createdAt: "desc" } },
    },
  });
}

export function create(input: {
  workspaceId: string;
  brandId: string;
  createdById: string;
  name: string;
  topic: string;
  goal?: string;
  offer?: string;
  callToAction?: string;
  targetDurationSeconds?: number;
}) {
  return prisma.project.create({ data: input });
}

export function update(
  workspaceId: string,
  projectId: string,
  data: {
    brandId?: string;
    name?: string;
    topic?: string;
    goal?: string;
    offer?: string;
    callToAction?: string;
    targetDurationSeconds?: number;
    status?: string;
  },
) {
  return prisma.project.updateMany({
    where: { id: projectId, workspaceId },
    data,
  });
}
