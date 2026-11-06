import { Router } from "express";
import { getOwnDoctorReportPdf, listOwnDoctorReports } from "../controllers/doctorController.ts";
import { requireRole } from "../middleware/roles.ts";

export const router = Router();

router.get("/api/doctor/reports", requireRole("doctor"), listOwnDoctorReports);
router.get("/api/doctor/orders/:id/pdf", requireRole("doctor"), getOwnDoctorReportPdf);
