import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client.js";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not configured");
}

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({ adapter });

async function main() {
  const workspace = await prisma.workspace.upsert({
    where: {
      slug: "bryan",
    },
    update: {
      name: "Bryan's Workspace",
    },
    create: {
      name: "Bryan's Workspace",
      slug: "bryan",
    },
  });

  const brands = await Promise.all([
    prisma.brand.upsert({
      where: {
        workspaceId_slug: {
          workspaceId: workspace.id,
          slug: "salon-murah-jakarta",
        },
      },
      update: {
        name: "Salon Murah Jakarta",
      },
      create: {
        workspaceId: workspace.id,
        name: "Salon Murah Jakarta",
        slug: "salon-murah-jakarta",
      },
    }),

    prisma.brand.upsert({
      where: {
        workspaceId_slug: {
          workspaceId: workspace.id,
          slug: "coe-studio",
        },
      },
      update: {
        name: "COE Studio",
      },
      create: {
        workspaceId: workspace.id,
        name: "COE Studio",
        slug: "coe-studio",
      },
    }),
  ]);

  console.log("Seed complete");
  console.log({
    workspace: workspace.name,
    brands: brands.map((brand) => brand.name),
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });