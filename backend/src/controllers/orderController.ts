import type { Request, Response } from "express";
import { db } from "../db.ts";
import { getOrder } from "../model.ts";
import { logEvent, nowIso, resendReport, signReport } from "../services/reportService.ts";

const orderIdFrom = (req: Request) => {
  const value = req.params.id;
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
};

export async function signOrder(req: Request, res: Response) {
  const staff = req.session.staffUser;
  const actor = staff ? `${staff.role}:${staff.id}` : "staff";
  const result = await signReport(orderIdFrom(req), actor);
  if (result.kind === "not_found") return res.status(404).json({ error: "Order not found." });
  if (result.kind === "already_signed") return res.status(409).json({ error: "This report is already signed." });
  if (result.kind === "cancelled") return res.status(409).json({ error: "Cancelled reports cannot be signed or delivered." });
  if (result.kind === "update_failed") return res.status(500).json({ error: "The report could not be signed." });
  return res.json({
    order: result.order,
    delivery: { link: result.link, expiresAt: result.expiresAt },
    critical: result.critical,
  });
}

export async function resendOrder(req: Request, res: Response) {
  const staff = req.session.staffUser;
  const actor = staff ? `${staff.role}:${staff.id}` : "staff";
  const result = resendReport(orderIdFrom(req), actor);
  if (result.kind === "not_found") return res.status(404).json({ error: "Order not found." });
  if (result.kind === "not_signed") return res.status(409).json({ error: "A link can only be sent after the report is signed." });
  return res.json({ link: result.link, expiresAt: result.expiresAt, phone: result.phone });
}

export async function uploadOrderPdf(req: Request, res: Response) {
  const orderId = orderIdFrom(req);
  const order = getOrder(orderId);
  if (!order) return res.status(404).json({ error: "Order not found." });
  if (!Buffer.isBuffer(req.body) || req.body.length < 5 || req.body.subarray(0, 5).toString() !== "%PDF-") {
    return res.status(400).json({ error: "Upload a valid PDF report." });
  }
  const staff = req.session.staffUser;
  if (!staff) return res.status(401).json({ error: "Please sign in to continue." });
  const rawName = req.get("x-file-name") || `${order.id}.pdf`;
  const fileName = rawName.split(/[\\/]/).pop()?.replace(/[^a-zA-Z0-9._-]/g, "_") || `${order.id}.pdf`;
  db.prepare(`
    INSERT INTO report_pdfs (order_id, file_name, file_data, uploaded_by, uploaded_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT (order_id) DO UPDATE SET
      file_name = excluded.file_name,
      file_data = excluded.file_data,
      uploaded_by = excluded.uploaded_by,
      uploaded_at = excluded.uploaded_at
  `).run(order.id, fileName, req.body, staff.id, nowIso());
  logEvent(`${staff.role}:${staff.id}`, "lis_pdf_uploaded", order.id, `Original LIS PDF uploaded as ${fileName}`);
  res.json({ ok: true, fileName });
}
