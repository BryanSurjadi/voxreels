import { prisma } from "../config/prisma.js";

export async function pingDatabase() {
  await prisma.$queryRaw`SELECT 1`;
}
