import { Router } from "express";
import { getApiAuthDemoAccounts, getApiAuthSession, postApiAuthRequestOtp, postApiAuthVerifyOtp, postApiAuthLogout, staffDemoLogin } from "../controllers/authController.ts";

export const router = Router();

router.post("/api/auth/request-otp", postApiAuthRequestOtp);
router.post("/api/auth/verify-otp", postApiAuthVerifyOtp);
router.get("/api/auth/session", getApiAuthSession);
router.get("/api/auth/demo-accounts", getApiAuthDemoAccounts);
router.post("/api/auth/logout", postApiAuthLogout);
router.post("/api/auth/demo-staff", staffDemoLogin);
