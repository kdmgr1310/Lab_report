import type { Request, Response } from "express";
import { randomInt, timingSafeEqual } from "node:crypto";
import { db } from "../db.ts";
import { deliveryDetails, hashToken, logEvent } from "../services/reportService.ts";
import { getVerifiedShareOrder, pathParam, shareOtpChallenges, streamPdf } from "./requestContext.ts";
import { maskMobile } from "../utils/mobile.ts";

export async function postApiShareTokenOtp(req: Request, res: Response) {
  const token = pathParam(req, "token");
  const delivery = db.prepare("SELECT d.*, o.id AS report_id FROM deliveries d JOIN orders o ON o.id = d.order_id WHERE d.link_hash = ?")
      .get(hashToken(token)) as { order_id: string; phone: string; expires_at: string } | undefined;
  if (!delivery || new Date(delivery.expires_at).getTime() < Date.now()) return res.status(410).json({ error: "This report link has expired. Ask the front desk for a new one." });
  const code = String(randomInt(100000, 1000000));
  shareOtpChallenges.set(token, { code, expiresAt: Date.now() + 5 * 60 * 1000, attempts: 0 });
  logEvent("patient", "share_otp_requested", delivery.order_id, `OTP requested for ${maskMobile(delivery.phone)}`);
  res.json({ sent: true, phone: maskMobile(delivery.phone), demoCode: process.env.NODE_ENV === "production" ? undefined : code });
}

export async function postApiShareTokenVerify(req: Request, res: Response) {
  const token = pathParam(req, "token");
  const challenge = shareOtpChallenges.get(token);
  if (!challenge || challenge.expiresAt < Date.now() || challenge.attempts >= 5) {
      shareOtpChallenges.delete(token);
      return res.status(401).json({ error: "That code has expired. Request a new one." });
    }
  challenge.attempts += 1;
  const expected = Buffer.from(challenge.code);
  const received = Buffer.from(String(req.body?.code ?? ""));
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return res.status(401).json({ error: "That code is not correct." });
  shareOtpChallenges.delete(token);
  const delivery = db.prepare("SELECT order_id FROM deliveries WHERE link_hash = ?").get(hashToken(token)) as { order_id: string } | undefined;
  if (!delivery) return res.status(410).json({ error: "This report link has expired." });
  req.session.shareAccess = { ...(req.session.shareAccess ?? {}), [token]: Date.now() + 15 * 60 * 1000 };
  logEvent("patient", "share_link_verified", delivery.order_id, "Report link verified with OTP");
  res.json({ ok: true });
}

export async function getApiShareTokenReport(req: Request, res: Response) {
  const order = getVerifiedShareOrder(req);
  if (!order) return res.status(401).json({ error: "Verify your mobile number to open this report." });
  logEvent("patient", "report_viewed", order.id, "Report opened through secure link");
  res.json(deliveryDetails(order));
}

export async function getApiShareTokenPdf(req: Request, res: Response) {
  const order = getVerifiedShareOrder(req);
  if (!order) return res.status(401).json({ error: "Verify your mobile number to download this report." });
  if (order.status !== "ready") return res.status(409).json({ error: "This report is not ready to download." });
  logEvent("patient", "report_pdf_downloaded", order.id, "Report PDF downloaded through secure link");
  streamPdf(res, order);
}

export async function postApiShareTokenFlagSummary(req: Request, res: Response) {
  const order = getVerifiedShareOrder(req);
  if (!order) return res.status(401).json({ error: "Verify your mobile number before flagging a summary." });
  if (order.critical || !order.summary_en) return res.status(409).json({ error: "This report has no summary available to flag." });
  const result = db.prepare(`
    UPDATE summary_reviews SET status = 'flagged', patient_flagged_at = ?
    WHERE order_id = ? AND status != 'reviewed'
  `).run(new Date().toISOString(), order.id);
  if (result.changes !== 1) return res.status(409).json({ error: "This summary is not available for feedback." });
  logEvent("patient", "summary_flagged", order.id, "Patient flagged the plain-language summary for review");
  res.json({ ok: true });
}
