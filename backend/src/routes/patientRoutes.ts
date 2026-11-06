import { Router } from "express";
import { getApiPatientOrders, getApiPatientOrdersId, postApiOrdersIdFlagSummary, getApiPatientOrdersIdPdf } from "../controllers/patientController.ts";
import { requirePatient } from "../middleware/roles.ts";

export const router = Router();

router.get("/api/patient/orders", requirePatient, getApiPatientOrders);
router.get("/api/patient/orders/:id", requirePatient, getApiPatientOrdersId);
router.post("/api/orders/:id/flag-summary", requirePatient, postApiOrdersIdFlagSummary);
router.get("/api/patient/orders/:id/pdf", requirePatient, getApiPatientOrdersIdPdf);
