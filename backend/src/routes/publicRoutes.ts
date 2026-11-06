import { Router } from "express";
import { health, settings } from "../controllers/publicController.ts";

export const router = Router();
router.get("/api/health", health);
router.get("/api/settings", settings);
