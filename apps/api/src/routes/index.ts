import { Router } from "express";
import { authRouter } from "./auth.routes.js";
import { brandsRouter } from "./brand.routes.js";
import { healthRouter } from "./health.routes.js";
import { projectsRouter } from "./project.routes.js";
import { usageRouter } from "./usage.routes.js";

export const apiRouter = Router();

apiRouter.use("/health", healthRouter);
apiRouter.use("/auth", authRouter);
apiRouter.use("/brands", brandsRouter);
apiRouter.use("/projects", projectsRouter);
apiRouter.use("/usage", usageRouter);
