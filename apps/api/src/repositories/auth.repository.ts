import { prisma } from "../config/prisma.js";

export function findUserByEmail(email: string) {
  return prisma.user.findUnique({ where: { email } });
}

export function findUserWithMembershipsByEmail(email: string) {
  return prisma.user.findUnique({
    where: { email },
    include: {
      memberships: {
        orderBy: { createdAt: "asc" },
      },
    },
  });
}

export function createUserWithWorkspace(input: {
  email: string;
  displayName: string;
  passwordHash: string;
  workspaceName: string;
  workspaceSlug: string;
  starterBrandName: string;
  starterBrandSlug: string;
}) {
  return prisma.$transaction(async (transaction) => {
    const user = await transaction.user.create({
      data: {
        email: input.email,
        displayName: input.displayName,
        passwordHash: input.passwordHash,
      },
    });
    const workspace = await transaction.workspace.create({
      data: {
        name: input.workspaceName,
        slug: input.workspaceSlug,
      },
    });
    const membership = await transaction.workspaceMembership.create({
      data: {
        userId: user.id,
        workspaceId: workspace.id,
        role: "OWNER",
      },
    });

    await transaction.brand.create({
      data: {
        workspaceId: workspace.id,
        name: input.starterBrandName,
        slug: input.starterBrandSlug,
      },
    });

    return { user, membership };
  });
}

export function createRefreshToken(input: {
  userId: string;
  workspaceId: string;
  tokenHash: string;
  expiresAt: Date;
}) {
  return prisma.refreshToken.create({ data: input });
}

export function findRefreshToken(tokenHash: string) {
  return prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });
}

export function findMembership(userId: string, workspaceId: string) {
  return prisma.workspaceMembership.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
  });
}

export function findMembershipWithUser(userId: string, workspaceId: string) {
  return prisma.workspaceMembership.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
    include: { user: true },
  });
}

export function findUserWithWorkspaces(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    include: {
      memberships: {
        include: { workspace: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });
}

export function revokeAllActiveTokens(userId: string) {
  return prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export function revokeToken(tokenHash: string) {
  return prisma.refreshToken.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export function rotateRefreshToken(input: {
  currentTokenId: string;
  userId: string;
  workspaceId: string;
  nextTokenHash: string;
  nextExpiresAt: Date;
}) {
  return prisma.$transaction(async (transaction) => {
    const revoked = await transaction.refreshToken.updateMany({
      where: { id: input.currentTokenId, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    if (revoked.count !== 1) return false;

    await transaction.refreshToken.create({
      data: {
        userId: input.userId,
        workspaceId: input.workspaceId,
        tokenHash: input.nextTokenHash,
        expiresAt: input.nextExpiresAt,
      },
    });

    return true;
  });
}
