import type { RequestHandler } from "express";
import { env } from "../config/env.js";
import { refreshTokenLifetimeMilliseconds } from "../utils/tokens.js";
import {
  loginSchema,
  registrationSchema,
  switchWorkspaceSchema,
} from "../schemas/auth.schema.js";
import * as authService from "../services/auth.service.js";

const REFRESH_COOKIE_NAME = "voxreels_refresh";
const refreshCookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/api/v1/auth",
  maxAge: refreshTokenLifetimeMilliseconds,
};

function setRefreshCookie(response: Parameters<RequestHandler>[1], token: string) {
  response.cookie(REFRESH_COOKIE_NAME, token, refreshCookieOptions);
}

export const register: RequestHandler = async (request, response) => {
  const result = await authService.register(registrationSchema.parse(request.body));
  setRefreshCookie(response, result.refreshToken);

  const { refreshToken: _refreshToken, ...data } = result;
  response.status(201).json({ data });
};

export const login: RequestHandler = async (request, response) => {
  const result = await authService.login(loginSchema.parse(request.body));
  setRefreshCookie(response, result.refreshToken);

  const { refreshToken: _refreshToken, ...data } = result;
  response.json({ data });
};

export const refresh: RequestHandler = async (request, response) => {
  const token = request.cookies[REFRESH_COOKIE_NAME] as string | undefined;

  if (!token) {
    response.status(401).json({
      error: { code: "REFRESH_REQUIRED", message: "A refresh token is required" },
    });
    return;
  }

  try {
    const result = await authService.refreshSession(token);
    setRefreshCookie(response, result.refreshToken);

    const { refreshToken: _refreshToken, ...data } = result;
    response.json({ data });
  } catch (error) {
    response.clearCookie(REFRESH_COOKIE_NAME, refreshCookieOptions);
    throw error;
  }
};

export const logout: RequestHandler = async (request, response) => {
  await authService.logout(request.cookies[REFRESH_COOKIE_NAME] as string | undefined);
  response.clearCookie(REFRESH_COOKIE_NAME, refreshCookieOptions);
  response.status(204).send();
};

export const me: RequestHandler = async (request, response) => {
  const data = await authService.getCurrentUser(
    request.auth!.userId,
    request.auth!.workspaceId,
  );
  response.json({ data });
};

export const switchWorkspace: RequestHandler = async (request, response) => {
  const input = switchWorkspaceSchema.parse(request.body);
  const result = await authService.switchWorkspace(request.auth!.userId, input.workspaceId);
  setRefreshCookie(response, result.refreshToken);

  const { refreshToken: _refreshToken, ...data } = result;
  response.json({ data });
};
