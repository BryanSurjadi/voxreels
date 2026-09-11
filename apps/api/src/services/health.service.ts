import * as healthRepository from "../repositories/health.repository.js";

export async function checkHealth() {
  try {
    await healthRepository.pingDatabase();
    return { status: "ok" as const, database: "connected" as const };
  } catch {
    return { status: "degraded" as const, database: "unavailable" as const };
  }
}
