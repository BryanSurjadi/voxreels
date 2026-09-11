import type { RequestHandler } from "express";
import { verifyAccessToken } from "../utils/tokens.js";

export const requireAuth: RequestHandler = async (request, response, next) => {
  const authorization = request.header("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    response.status(401).json({
      error: { code: "UNAUTHORIZED", message: "A valid access token is required" },
    });
    return;
  }

  try {
    request.auth = await verifyAccessToken(authorization.slice(7));
    next();
  } catch {
    response.status(401).json({
      error: { code: "UNAUTHORIZED", message: "The access token is invalid or expired" },
    });
  }
};
