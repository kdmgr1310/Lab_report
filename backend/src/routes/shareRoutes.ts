import { Router } from "express";
import { postApiShareTokenOtp, postApiShareTokenVerify, getApiShareTokenReport, getApiShareTokenPdf, postApiShareTokenFlagSummary } from "../controllers/shareController.ts";

export const router = Router();

router.post("/api/share/:token/otp", postApiShareTokenOtp);
router.post("/api/share/:token/verify", postApiShareTokenVerify);
router.get("/api/share/:token/report", getApiShareTokenReport);
router.get("/api/share/:token/pdf", getApiShareTokenPdf);
router.post("/api/share/:token/flag-summary", postApiShareTokenFlagSummary);
