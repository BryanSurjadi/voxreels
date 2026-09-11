import { Router } from "express";
import * as brandController from "../controllers/brand.controller.js";
import { requireAuth } from "../middlewares/auth.middleware.js";

export const brandsRouter = Router();

brandsRouter.get("/", requireAuth, brandController.list);
