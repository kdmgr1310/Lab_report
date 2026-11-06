import { Router } from "express";
import { getApiDashboard, getApiOrders, postApiImport, getApiDoctors, getApiDoctorsIdReports, getApiDeliveryReport, getApiAudit, getApiStaffOrdersIdPdf } from "../controllers/staffController.ts";
import { signOrder, resendOrder, uploadOrderPdf } from "../controllers/orderController.ts";
import { getSummaryReviewQueue, postSummaryReviewComplete } from "../controllers/summaryReviewController.ts";
import { completeCallbackTask, listOpenCallbackTasks } from "../controllers/callbackController.ts";
import { requireRole, requireStaff } from "../middleware/roles.ts";

export const router = Router();

router.get("/api/dashboard", requireStaff, getApiDashboard);
router.get("/api/callback-tasks", requireRole("admin", "pathologist", "frontdesk"), listOpenCallbackTasks);
router.post("/api/callback-tasks/:id/complete", requireRole("admin", "pathologist", "frontdesk"), completeCallbackTask);
router.get("/api/orders", requireStaff, getApiOrders);
router.post("/api/orders/:id/sign", requireRole("admin", "pathologist"), signOrder);
router.post("/api/orders/:id/resend", requireStaff, resendOrder);
router.post("/api/orders/:id/pdf", requireRole("admin", "pathologist"), uploadOrderPdf);
router.get("/api/pathologist/summary-reviews", requireRole("admin", "pathologist"), getSummaryReviewQueue);
router.post("/api/pathologist/summary-reviews/:id/review", requireRole("admin", "pathologist"), postSummaryReviewComplete);
router.post("/api/import", requireRole("admin", "frontdesk"), postApiImport);
router.get("/api/doctors", requireStaff, getApiDoctors);
router.get("/api/doctors/:id/reports", requireStaff, getApiDoctorsIdReports);
router.get("/api/delivery-report", requireStaff, getApiDeliveryReport);
router.get("/api/audit", requireStaff, getApiAudit);
router.get("/api/staff/orders/:id/pdf", requireStaff, getApiStaffOrdersIdPdf);
