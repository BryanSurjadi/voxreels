import { prisma } from "../config/prisma.js";

export function findAllByWorkspace(workspaceId: string) {
  return prisma.brand.findMany({
    where: { workspaceId },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export function create(workspaceId: string, name: string, slug: string) {
  return prisma.brand.create({
    data: { workspaceId, name, slug },
    select: { id: true, name: true, slug: true, createdAt: true, updatedAt: true },
  });
}

export async function update(workspaceId: string, brandId: string, name: string) {
  const result = await prisma.brand.updateMany({
    where: { id: brandId, workspaceId },
    data: { name },
  });
  if (result.count === 0) return null;

  return prisma.brand.findUnique({
    where: { id: brandId },
    select: { id: true, name: true, slug: true, createdAt: true, updatedAt: true },
  });
}
