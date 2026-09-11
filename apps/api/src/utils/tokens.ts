import { createHash, randomUUID } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { env } from "../config/env.js";

export type AccessTokenPayload = {
  userId: string;
  workspaceId: string;
  role: "OWNER" | "MEMBER";
};

const accessSecret = new TextEncoder().encode(env.JWT_ACCESS_SECRET);
const refreshSecret = new TextEncoder().encode(env.JWT_REFRESH_SECRET);

export const accessTokenLifetimeSeconds = env.ACCESS_TOKEN_TTL_MINUTES * 60;
export const refreshTokenLifetimeMilliseconds =
  env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000;

export async function signAccessToken(payload: AccessTokenPayload) {
  return new SignJWT({
    workspaceId: payload.workspaceId,
    role: payload.role,
    type: "access",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.userId)
    .setIssuedAt()
    .setExpirationTime(`${env.ACCESS_TOKEN_TTL_MINUTES}m`)
    .sign(accessSecret);
}

export async function signRefreshToken(userId: string, workspaceId: string) {
  const tokenId = randomUUID();
  const expiresAt = new Date(Date.now() + refreshTokenLifetimeMilliseconds);
  const token = await new SignJWT({ type: "refresh", workspaceId })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setJti(tokenId)
    .setIssuedAt()
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(refreshSecret);

  return { token, expiresAt };
}

export async function verifyAccessToken(token: string): Promise<AccessTokenPayload> {
  const { payload } = await jwtVerify(token, accessSecret, {
    algorithms: ["HS256"],
  });

  if (
    payload.type !== "access" ||
    typeof payload.sub !== "string" ||
    typeof payload.workspaceId !== "string" ||
    (payload.role !== "OWNER" && payload.role !== "MEMBER")
  ) {
    throw new Error("Invalid access token");
  }

  return {
    userId: payload.sub,
    workspaceId: payload.workspaceId,
    role: payload.role,
  };
}

export async function verifyRefreshToken(token: string): Promise<{
  userId: string;
  workspaceId?: string;
}> {
  const { payload } = await jwtVerify(token, refreshSecret, {
    algorithms: ["HS256"],
  });

  if (payload.type !== "refresh" || typeof payload.sub !== "string") {
    throw new Error("Invalid refresh token");
  }

  return {
    userId: payload.sub,
    ...(typeof payload.workspaceId === "string"
      ? { workspaceId: payload.workspaceId }
      : {}),
  };
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
