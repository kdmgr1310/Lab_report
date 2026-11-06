import type { Request, Response } from "express";
import { db } from "../db.ts";
import { getOrder, orderQuery, type Order } from "../model.ts";
import { deliveryDetails, logEvent } from "../services/reportService.ts";
import { pathParam, streamPdf } from "./requestContext.ts";

export async function listOwnDoctorReports(req: Request, res: Response) {
  const doctorId = req.session.staffUser?.doctorId;
  if (!doctorId) return res.status(403).json({ error: "This doctor account is not linked to a clinician profile." });
  const reports = db.prepare(`${orderQuery}
    JOIN doctor_patient_access a ON a.doctor_id = o.doctor_id
      AND a.patient_id = o.patient_id AND a.revoked_at IS NULL
    WHERE o.doctor_id = ? AND o.created_at >= datetime('now', '-90 days')
    ORDER BY o.created_at DESC`)
    .all(doctorId) as Order[];
  res.json(reports.map(deliveryDetails));
}

export async function getOwnDoctorReportPdf(req: Request, res: Response) {
  const doctorId = req.session.staffUser?.doctorId;
  if (!doctorId) return res.status(403).json({ error: "This doctor account is not linked to a clinician profile." });
  const orderId = pathParam(req, "id");
  const allowed = db.prepare(`
    SELECT o.id FROM orders o
    JOIN doctor_patient_access a ON a.doctor_id = o.doctor_id
      AND a.patient_id = o.patient_id AND a.revoked_at IS NULL
    WHERE o.id = ? AND o.doctor_id = ?
      AND o.created_at >= datetime('now', '-90 days')
      AND o.status = 'ready'
  `).get(orderId, doctorId);
  if (!allowed) return res.status(404).json({ error: "Report not found." });
  const order = getOrder(orderId);
  if (!order) return res.status(404).json({ error: "Report not found." });
  logEvent(`doctor:${req.session.staffUser?.id}`, "doctor_report_pdf_downloaded", order.id, "Authorized doctor downloaded report");
  streamPdf(res, order);
}
