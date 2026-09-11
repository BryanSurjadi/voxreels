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
