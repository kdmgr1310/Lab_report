import type { Request, Response } from "express";
import { db } from "../db.ts";
import type { Order } from "../model.ts";
import { deliveryDetails, logEvent, nowIso } from "../services/reportService.ts";
import { pathParam } from "./requestContext.ts";

export async function getSummaryReviewQueue(_req: Request, res: Response) {
  const rows = db.prepare(`
    SELECT o.*, p.name AS patient_name, p.mobile, d.name AS doctor_name,
      EXISTS (SELECT 1 FROM report_pdfs rp WHERE rp.order_id = o.id) AS pdf_is_original,
      (SELECT status FROM deliveries WHERE order_id = o.id ORDER BY sent_at DESC LIMIT 1) AS delivery_status,
      (SELECT expires_at FROM deliveries WHERE order_id = o.id ORDER BY sent_at DESC LIMIT 1) AS expires_at,
      sr.status AS review_status, sr.generated_at, sr.patient_flagged_at
    FROM orders o
    JOIN patients p ON p.id = o.patient_id
    LEFT JOIN doctors d ON d.id = o.doctor_id
    JOIN summary_reviews sr ON sr.order_id = o.id
    WHERE sr.status IN ('pending', 'flagged')
    ORDER BY CASE sr.status WHEN 'flagged' THEN 0 ELSE 1 END, sr.generated_at ASC
  `).all() as Array<Order & { review_status: string; generated_at: string; patient_flagged_at: string | null }>;
  const weeklyReviewed = (db.prepare(`
    SELECT COUNT(*) AS count FROM summary_reviews
    WHERE status = 'reviewed' AND reviewed_at >= date('now', 'weekday 0', '-6 days')
  `).get() as { count: number }).count;
  res.json({
    items: rows.map((row) => ({
      ...deliveryDetails(row),
      review_status: row.review_status,
      generated_at: row.generated_at,
      patient_flagged_at: row.patient_flagged_at,
    })),
    weeklyReviewed,
    weeklyTarget: 50,
  });
}

export async function postSummaryReviewComplete(req: Request, res: Response) {
  const orderId = pathParam(req, "id");
  const staff = req.session.staffUser;
  if (!staff) return res.status(401).json({ error: "Please sign in to continue." });
  const result = db.prepare(`
    UPDATE summary_reviews
    SET status = 'reviewed', reviewed_at = ?, reviewer_staff_id = ?
    WHERE order_id = ? AND status IN ('pending', 'flagged')
  `).run(nowIso(), staff.id, orderId);
  if (result.changes === 0) {
    const exists = db.prepare("SELECT order_id FROM summary_reviews WHERE order_id = ?").get(orderId);
    return res.status(exists ? 409 : 404).json({ error: exists ? "This summary has already been reviewed." : "Summary review not found." });
  }
  logEvent(`${staff.role}:${staff.id}`, "summary_reviewed", orderId, "Pathologist marked summary reviewed");
  res.json({ ok: true });
}
