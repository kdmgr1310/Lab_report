import type { Request, Response } from "express";
import { db } from "../db.ts";
import { getOrder, orderQuery, type Order } from "../model.ts";
import { deliveryDetails, logEvent } from "../services/reportService.ts";
import { pathParam, streamPdf } from "./requestContext.ts";

export async function getApiPatientOrders(req: Request, res: Response) {
  const orders = db.prepare(`${orderQuery} WHERE p.mobile = ? ORDER BY o.created_at DESC`)
      .all(req.session.patientMobile) as Order[];
  res.json(orders.map(deliveryDetails));
}

export async function getApiPatientOrdersId(req: Request, res: Response) {
  const order = getOrder(pathParam(req, "id"));
  if (!order || order.mobile !== req.session.patientMobile) return res.status(404).json({ error: "Report not found." });
  if (order.status !== "ready") return res.status(409).json({ error: "This report is not ready yet." });
  logEvent("patient", "report_viewed", order.id, `Patient opened report ${order.id}`);
  res.json(deliveryDetails(order));
}

export async function postApiOrdersIdFlagSummary(req: Request, res: Response) {
  const order = getOrder(pathParam(req, "id"));
  if (!order || order.mobile !== req.session.patientMobile) return res.status(404).json({ error: "Report not found." });
  const result = db.prepare(`
    UPDATE summary_reviews SET status = 'flagged', patient_flagged_at = ?
    WHERE order_id = ? AND status != 'reviewed'
  `).run(new Date().toISOString(), order.id);
  if (result.changes !== 1) return res.status(409).json({ error: "This summary is not available for feedback." });
  logEvent("patient", "summary_flagged", order.id, "Patient flagged the plain-language summary for review");
  res.json({ ok: true });
}

export async function getApiPatientOrdersIdPdf(req: Request, res: Response) {
  const order = getOrder(pathParam(req, "id"));
  if (!order || order.mobile !== req.session.patientMobile) return res.status(404).json({ error: "Report not found." });
  if (order.status !== "ready") return res.status(409).json({ error: "This report is not ready to download." });
  logEvent("patient", "report_pdf_downloaded", order.id, "Patient downloaded report PDF");
  streamPdf(res, order);
}
