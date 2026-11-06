import PDFDocument from "pdfkit";
import { existsSync } from "node:fs";
import type { Request, Response } from "express";
import { db } from "../db.ts";
import { getOrder, type Order } from "../model.ts";
import { hashToken } from "../services/reportService.ts";

type PdfFontSource = { path: string; family?: string };

function resolvePdfFont(envName: string, candidates: PdfFontSource[]) {
  const configuredPath = process.env[envName];
  if (configuredPath) {
    if (!existsSync(configuredPath)) throw new Error(`${envName} points to a font file that does not exist.`);
    return { path: configuredPath, family: process.env[`${envName}_FAMILY`] };
  }
  const source = candidates.find((candidate) => existsSync(candidate.path));
  if (!source) throw new Error(`A Unicode font is required for multilingual report PDFs. Configure ${envName}.`);
  return source;
}

function registerSummaryFonts(pdf: PDFKit.PDFDocument) {
  const telugu = resolvePdfFont("PDF_FONT_TELUGU", [
    { path: "/System/Library/Fonts/KohinoorTelugu.ttc", family: "KohinoorTelugu-Regular" },
    { path: "/System/Library/Fonts/Supplemental/Telugu Sangam MN.ttc", family: "TeluguSangamMN" },
    { path: "/usr/share/fonts/truetype/noto/NotoSansTelugu-Regular.ttf" },
    { path: "/usr/share/fonts/opentype/noto/NotoSansTelugu-Regular.ttf" },
    { path: "C:/Windows/Fonts/NotoSansTelugu-Regular.ttf" },
  ]);
  const hindi = resolvePdfFont("PDF_FONT_HINDI", [
    { path: "/System/Library/Fonts/Supplemental/Devanagari Sangam MN.ttc", family: "DevanagariSangamMN" },
    { path: "/System/Library/Fonts/Supplemental/ITFDevanagari.ttc", family: "ITFDevanagari" },
    { path: "/usr/share/fonts/truetype/noto/NotoSansDevanagari-Regular.ttf" },
    { path: "/usr/share/fonts/opentype/noto/NotoSansDevanagari-Regular.ttf" },
    { path: "C:/Windows/Fonts/NotoSansDevanagari-Regular.ttf" },
  ]);
  pdf.registerFont("SummaryTelugu", telugu.path, telugu.family);
  pdf.registerFont("SummaryHindi", hindi.path, hindi.family);
  pdf.font("SummaryTelugu").font("SummaryHindi").font("Helvetica");
}

export const otpChallenges = new Map<string, { code: string; expiresAt: number; attempts: number }>();
export const shareOtpChallenges = new Map<string, { code: string; expiresAt: number; attempts: number }>();

export const pathParam = (req: Request, key: string) => {
  const value = req.params[key];
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
};

export const getVerifiedShareOrder = (req: Request) => {
  const token = pathParam(req, "token");
  const accessExpiry = req.session.shareAccess?.[token];
  if (!accessExpiry || accessExpiry < Date.now()) return null;
  const delivery = db.prepare("SELECT order_id, expires_at FROM deliveries WHERE link_hash = ?")
    .get(hashToken(token)) as { order_id: string; expires_at: string } | undefined;
  if (!delivery || new Date(delivery.expires_at).getTime() < Date.now()) return null;
  return getOrder(delivery.order_id) ?? null;
};

export const streamPdf = (res: Response, order: Order) => {
  const uploaded = db.prepare("SELECT file_name, file_data FROM report_pdfs WHERE order_id = ?")
    .get(order.id) as { file_name: string; file_data: Buffer } | undefined;
  if (uploaded) {
    const safeFileName = uploaded.file_name.replace(/[^a-zA-Z0-9._-]/g, "_");
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${safeFileName}"`);
    res.setHeader("Content-Length", uploaded.file_data.length);
    res.end(uploaded.file_data);
    return;
  }
  const pdf = new PDFDocument({ size: "A4", margin: 52, info: { Title: `Lab report ${order.id}`, Author: "Swasthya Diagnostics" } });
  if (!order.critical && order.summary_en) registerSummaryFonts(pdf);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${order.id}.pdf"`);
  pdf.pipe(res);
  pdf.fontSize(22).fillColor("#14665e").text("SWASTHYA DIAGNOSTICS");
  pdf.moveDown(0.5).fontSize(10).fillColor("#64748b").text("Coastal Andhra Pradesh · Patient laboratory report");
  pdf.moveDown(1.5).fontSize(16).fillColor("#182a34").text("Laboratory report");
  pdf.moveDown(0.6).fontSize(11).fillColor("#334155")
    .text(`Order ID: ${order.id}`)
    .text(`Patient: ${order.patient_name}`)
    .text(`Referring doctor: ${order.doctor_name}`)
    .text(`Collected: ${new Date(order.created_at).toLocaleString("en-IN")}`)
    .text(`Signed: ${order.signed_at ? new Date(order.signed_at).toLocaleString("en-IN") : "Pending"}`);
  pdf.moveDown(1).fontSize(12).fillColor("#14665e").text("TEST RESULT");
  pdf.moveDown(0.5).fontSize(11).fillColor("#182a34")
    .text(`${order.parameter}: ${order.result} ${order.unit}`)
    .text(`Reference range: ${order.reference_range} ${order.unit}`)
    .text(`Status: ${order.critical ? "Critical — please contact your doctor" : order.status}`);
  if (!order.critical && order.summary_en) {
    pdf.moveDown(1).font("Helvetica-Bold").fontSize(12).fillColor("#14665e")
      .text("PLAIN-LANGUAGE SUMMARY · FOR GUIDANCE ONLY");
    pdf.moveDown(0.5).font("Helvetica-Bold").fontSize(10).fillColor("#334155").text("English");
    pdf.font("Helvetica").fontSize(10).text(order.summary_en, { lineGap: 2 });
    if (order.summary_te) {
      pdf.moveDown(0.5).font("SummaryTelugu").fontSize(10).fillColor("#334155").text("తెలుగు");
      pdf.font("SummaryTelugu").fontSize(10).text(order.summary_te, { lineGap: 2 });
    }
    if (order.summary_hi) {
      pdf.moveDown(0.5).font("SummaryHindi").fontSize(10).fillColor("#334155").text("हिन्दी");
      pdf.font("SummaryHindi").fontSize(10).text(order.summary_hi, { lineGap: 2 });
    }
    pdf.moveDown(0.5).font("Helvetica").fontSize(9).fillColor("#64748b")
      .text("This explanation is informational and does not replace the full report or medical advice.");
  }
  pdf.font("Helvetica");
  pdf.moveDown(2).fontSize(9).fillColor("#64748b")
    .text("This report is confidential. It is intended for the patient and their treating clinician.")
    .text("Please discuss results with your doctor. This report is not a substitute for medical advice.");
  pdf.end();
};
