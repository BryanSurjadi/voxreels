import { randomUUID } from "node:crypto";
import { env } from "../config/env.js";
import { hashPassword, verifyPassword } from "../utils/password.js";
import {
  accessTokenLifetimeSeconds,
  hashToken,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../utils/tokens.js";
import { AppError } from "../middlewares/error.middleware.js";
import * as authRepository from "../repositories/auth.repository.js";
import type { LoginInput, RegistrationInput } from "../schemas/auth.schema.js";

type SessionUser = {
  id: string;
  email: string;
  displayName: string;
};

type SessionMembership = {
  workspaceId: string;
  role: "OWNER" | "MEMBER";
};

function workspaceSlug(displayName: string) {
  const base = displayName
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);

  return `${base || "workspace"}-${randomUUID().slice(0, 8)}`;
}

function userView(user: SessionUser) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
  };
}

async function createSession(user: SessionUser, membership: SessionMembership) {
  const accessToken = await signAccessToken({
    userId: user.id,
    workspaceId: membership.workspaceId,
    role: membership.role,
  });
  const refresh = await signRefreshToken(user.id, membership.workspaceId);

  await authRepository.createRefreshToken({
    userId: user.id,
    workspaceId: membership.workspaceId,
    tokenHash: hashToken(refresh.token),
    expiresAt: refresh.expiresAt,
  });

  return {
    user: userView(user),
    activeWorkspaceId: membership.workspaceId,
    role: membership.role,
    accessToken,
    refreshToken: refresh.token,
    expiresIn: accessTokenLifetimeSeconds,
  };
}

export async function register(input: RegistrationInput) {
  if (!env.ALLOW_REGISTRATION) {
    throw new AppError(403, "REGISTRATION_DISABLED", "Registration is disabled");
  }

  const existingUser = await authRepository.findUserByEmail(input.email);

  if (existingUser) {
    throw new AppError(409, "EMAIL_IN_USE", "An account already uses this email");
  }

  const passwordHash = await hashPassword(input.password);
  const result = await authRepository.createUserWithWorkspace({
    email: input.email,
    displayName: input.displayName,
    passwordHash,
    workspaceName: `${input.displayName}'s Workspace`,
    workspaceSlug: workspaceSlug(input.displayName),
    starterBrandName: "My Brand",
    starterBrandSlug: "my-brand",
  });

  return createSession(result.user, result.membership);
}

export async function login(input: LoginInput) {
  const user = await authRepository.findUserWithMembershipsByEmail(input.email);

  if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
    throw new AppError(401, "INVALID_CREDENTIALS", "Email or password is incorrect");
  }

  const membership = user.memberships[0];

  if (!membership) {
    throw new AppError(403, "NO_WORKSPACE", "This account does not belong to a workspace");
  }

  return createSession(user, membership);
}

export async function refreshSession(token: string) {
  let payload: Awaited<ReturnType<typeof verifyRefreshToken>>;

  try {
    payload = await verifyRefreshToken(token);
  } catch {
    throw new AppError(401, "INVALID_REFRESH_TOKEN", "The refresh token is invalid or expired");
  }

  const storedToken = await authRepository.findRefreshToken(hashToken(token));

  if (
    !storedToken ||
    storedToken.userId !== payload.userId ||
    (payload.workspaceId && storedToken.workspaceId !== payload.workspaceId) ||
    storedToken.revokedAt ||
    storedToken.expiresAt <= new Date()
  ) {
    if (storedToken?.revokedAt) {
      await authRepository.revokeAllActiveTokens(payload.userId);
    }

    throw new AppError(401, "INVALID_REFRESH_TOKEN", "The refresh token is invalid or expired");
  }

  const membership = await authRepository.findMembership(
    storedToken.userId,
    storedToken.workspaceId,
  );

  if (!membership) {
    throw new AppError(403, "WORKSPACE_ACCESS_REMOVED", "Workspace access has been removed");
  }

  const nextRefresh = await signRefreshToken(storedToken.userId, storedToken.workspaceId);
  const accessToken = await signAccessToken({
    userId: storedToken.userId,
    workspaceId: storedToken.workspaceId,
    role: membership.role,
  });

  const rotated = await authRepository.rotateRefreshToken({
    currentTokenId: storedToken.id,
    userId: storedToken.userId,
    workspaceId: storedToken.workspaceId,
    nextTokenHash: hashToken(nextRefresh.token),
    nextExpiresAt: nextRefresh.expiresAt,
  });

  if (!rotated) {
    throw new AppError(401, "INVALID_REFRESH_TOKEN", "The refresh token was already used");
  }

  return {
    accessToken,
    refreshToken: nextRefresh.token,
    expiresIn: accessTokenLifetimeSeconds,
  };
}

export async function logout(token: string | undefined) {
  if (!token) return;

  await authRepository.revokeToken(hashToken(token));
}

export async function getCurrentUser(userId: string, activeWorkspaceId: string) {
  const user = await authRepository.findUserWithWorkspaces(userId);

  if (!user) {
    throw new AppError(401, "UNAUTHORIZED", "The user no longer exists");
  }

  return {
    user: userView(user),
    activeWorkspaceId,
    workspaces: user.memberships.map((membership) => ({
      id: membership.workspace.id,
      name: membership.workspace.name,
      slug: membership.workspace.slug,
      role: membership.role,
    })),
  };
}

export async function switchWorkspace(userId: string, workspaceId: string) {
  const membership = await authRepository.findMembershipWithUser(userId, workspaceId);

  if (!membership) {
    throw new AppError(403, "WORKSPACE_FORBIDDEN", "You do not belong to this workspace");
  }

  return createSession(membership.user, membership);
}
