import { Router } from "express";
import { router as authRoutes } from "./authRoutes.ts";
import { router as patientRoutes } from "./patientRoutes.ts";
import { router as shareRoutes } from "./shareRoutes.ts";
import { router as staffRoutes } from "./staffRoutes.ts";
import { router as publicRoutes } from "./publicRoutes.ts";
import { router as doctorRoutes } from "./doctorRoutes.ts";

export const router = Router();
router.use(publicRoutes, authRoutes, patientRoutes, shareRoutes, doctorRoutes, staffRoutes);
