import type { Request, Response } from "express";
import { db } from "../db.ts";
import { appConfig } from "../config.ts";
import { getOrder, grantDoctorPatientAccess, orderQuery, type Order } from "../model.ts";
import { deliveryDetails, issueDelivery, logEvent, needsCriticalCallback, nowIso } from "../services/reportService.ts";
import { createSummaryForOrder } from "../services/summaryService.ts";
import { pathParam, streamPdf } from "./requestContext.ts";
import { normalizeMobile } from "../utils/mobile.ts";

export async function getApiDashboard(_req: Request, res: Response) {
  const orders = db.prepare(`${orderQuery} ORDER BY o.created_at DESC`).all() as Order[];
  const openCallbacks = (db.prepare("SELECT COUNT(*) AS count FROM callback_tasks WHERE status = 'open'").get() as { count: number }).count;
  const deliveredToday = (db.prepare("SELECT COUNT(*) AS count FROM deliveries WHERE sent_at >= date('now')").get() as { count: number }).count;
  res.json({
      metrics: {
        reportsToday: orders.length,
        ready: orders.filter((order) => order.status === "ready").length,
        processing: orders.filter((order) => order.status === "processing").length,
        callbackTasks: openCallbacks,
        deliveredToday,
      },
      orders: orders.map(deliveryDetails),
    });
}

export async function getApiOrders(_req: Request, res: Response) {
  res.json((db.prepare(`${orderQuery} ORDER BY o.created_at DESC`).all() as Order[]).map(deliveryDetails));
}

export async function postApiImport(req: Request, res: Response) {
  const csv = req.body?.csv;
  if (typeof csv !== "string" || csv.length > 1_000_000) {
      return res.status(400).json({ error: "Upload a CSV file smaller than 1 MB." });
    }
  const rows: string[][] = [];
  let cells: string[] = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index];
    if (character === '"' && quoted && csv[index + 1] === '"') {
      value += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === "," && !quoted) {
      cells.push(value.trim());
      value = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && csv[index + 1] === "\n") index += 1;
      cells.push(value.trim());
      if (cells.some(Boolean)) rows.push(cells);
      cells = [];
      value = "";
    } else {
      value += character;
    }
  }
  if (quoted) return res.status(400).json({ error: "The CSV contains an unclosed quoted field." });
  cells.push(value.trim());
  if (cells.some(Boolean)) rows.push(cells);
  if (rows.length < 2) return res.status(400).json({ error: "The CSV needs a header row and at least one report." });
  const headers = rows[0].map((header) => header.replace(/^\uFEFF/, "").toLowerCase().replace(/[^a-z0-9]/g, ""));
  const column = (...names: string[]) => headers.findIndex((header) => names.includes(header));
  const indexes = {
      id: column("orderid", "accessionnumber"),
      patient: column("patient", "patientname", "name"),
      parameter: column("parameter", "test", "testname"),
      result: column("result", "value"),
      range: column("referencerange", "range", "normalrange"),
      status: column("status"),
      doctor: column("referringdoctor", "doctor"),
      mobile: column("mobile", "patientmobile", "phone", "phonenumber"),
      unit: column("unit", "units"),
      consent: column("consent", "consentrecorded"),
      signedAt: column("reportsignedat", "signedat", "signeddate"),
      consentAt: column("consentat", "consentdate", "consentrecordedat"),
    };
  if ([indexes.id, indexes.patient, indexes.parameter, indexes.result, indexes.range].some((index) => index < 0)) {
      return res.status(400).json({ error: "Required columns: Order ID, Patient, Parameter, Result, Reference Range." });
    }
  const created: string[] = [];
  const skipped: string[] = [];
  const insertOrder = db.prepare(`
      INSERT OR IGNORE INTO orders (id, patient_id, parameter, result, reference_range, unit, status, doctor_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
  const firstCsvRowByOrderId = new Map<string, number>();
  const upsert = db.transaction(() => {
      for (const [lineIndex, cells] of rows.slice(1).entries()) {
        const get = (index: number) => index < 0 ? "" : (cells[index] ?? "").trim();
        const orderId = get(indexes.id);
        const patientName = get(indexes.patient);
        if (!orderId || !patientName || !get(indexes.parameter) || !get(indexes.result) || !get(indexes.range)) {
          skipped.push(`Row ${lineIndex + 2}: required value missing`);
          continue;
        }
        const firstCsvRow = firstCsvRowByOrderId.get(orderId);
        if (firstCsvRow !== undefined) {
          skipped.push(`Row ${lineIndex + 2}: duplicate order ID ${orderId} in this CSV (first seen on row ${firstCsvRow})`);
          continue;
        }
        firstCsvRowByOrderId.set(orderId, lineIndex + 2);
        const existingOrder = db.prepare("SELECT id FROM orders WHERE id = ?").get(orderId);
        if (existingOrder) {
          skipped.push(`Row ${lineIndex + 2}: order ${orderId} already exists in the database (seeded demo data or a previous import)`);
          continue;
        }
        const sourceStatus = get(indexes.status).toLowerCase();
        const status = sourceStatus.includes("ready")
          ? "ready"
          : sourceStatus.includes("cancel")
            ? "cancelled"
            : sourceStatus.includes("process")
              ? "processing"
              : "";
        if (!status) {
          skipped.push(`Row ${lineIndex + 2}: status must be Ready, Processing, or Cancelled`);
          continue;
        }
        const sourceSignedAt = get(indexes.signedAt);
        const parsedSignedAt = sourceSignedAt ? Date.parse(sourceSignedAt) : Number.NaN;
        if (status === "ready" && sourceSignedAt && !Number.isFinite(parsedSignedAt)) {
          skipped.push(`Row ${lineIndex + 2}: invalid Report Signed At date`);
          continue;
        }
        const mobile = normalizeMobile(get(indexes.mobile));
        let patient = db.prepare("SELECT id, mobile FROM patients WHERE name = ? COLLATE NOCASE LIMIT 1")
          .get(patientName) as { id: number; mobile: string } | undefined;
        if (patient && mobile && normalizeMobile(patient.mobile) !== mobile) {
          skipped.push(`Row ${lineIndex + 2}: mobile number does not match the existing patient account for ${patientName}`);
          continue;
        }
        if (!patient) {
          const consent = get(indexes.consent).toLowerCase();
          if (!mobile || !["yes", "true", "1", "consented"].includes(consent)) {
            skipped.push(`Row ${lineIndex + 2}: ${patientName} needs a mobile number and recorded consent before account setup`);
            continue;
          }
          const consentAt = get(indexes.consentAt);
          const parsedConsentAt = consentAt ? Date.parse(consentAt) : Number.NaN;
          if (consentAt && !Number.isFinite(parsedConsentAt)) {
            skipped.push(`Row ${lineIndex + 2}: invalid Consent Date`);
            continue;
          }
          const patientId = db.prepare("INSERT INTO patients (name, mobile, language, consent_at) VALUES (?, ?, 'en', ?)")
            .run(patientName, mobile, consentAt ? new Date(parsedConsentAt).toISOString() : nowIso()).lastInsertRowid;
          patient = { id: Number(patientId), mobile };
        }
        const doctorName = get(indexes.doctor);
        let doctorId: number | null = null;
        if (doctorName) {
          db.prepare("INSERT OR IGNORE INTO doctors (name) VALUES (?)").run(doctorName);
          doctorId = (db.prepare("SELECT id FROM doctors WHERE name = ?").get(doctorName) as { id: number }).id;
        }
        const result = insertOrder.run(
          orderId, patient.id, get(indexes.parameter), get(indexes.result), get(indexes.range),
          get(indexes.unit), status, doctorId, nowIso(),
        );
        if (result.changes === 1) {
          created.push(orderId);
          if (doctorId !== null) grantDoctorPatientAccess(doctorId, patient.id, appConfig.staffId);
          if (status === "ready") {
            const record = getOrder(orderId);
            if (record) {
              const numericResult = Number.parseFloat(record.result);
              const isCritical = Number.isFinite(numericResult) && needsCriticalCallback(record.parameter, numericResult, record.reference_range);
              const signedAt = sourceSignedAt ? new Date(parsedSignedAt).toISOString() : nowIso();
              db.prepare("UPDATE orders SET signed_at = ?, critical = ? WHERE id = ?").run(signedAt, isCritical ? 1 : 0, orderId);
              if (isCritical) {
                db.prepare("INSERT OR IGNORE INTO callback_tasks (order_id, status, created_at) VALUES (?, 'open', ?)").run(orderId, nowIso());
                logEvent("system", "critical_callback_created", orderId, "Critical result requires a staff callback");
              } else {
                const signedOrder = getOrder(orderId);
                if (signedOrder) createSummaryForOrder(signedOrder, false);
              }
              issueDelivery(orderId, record.mobile);
            }
          }
        } else skipped.push(`Row ${lineIndex + 2}: duplicate order ${orderId}`);
      }
    });
  upsert();
  logEvent("frontdesk", "lis_csv_imported", null, `${created.length} imported; ${skipped.length} skipped`);
  res.json({ imported: created, skipped });
}

export async function getApiDoctors(_req: Request, res: Response) {
  res.json(db.prepare(`
      SELECT d.id, d.name, d.clinic, COUNT(DISTINCT o.id) AS report_count
      FROM doctors d
      LEFT JOIN doctor_patient_access a ON a.doctor_id = d.id AND a.revoked_at IS NULL
      LEFT JOIN orders o ON o.doctor_id = d.id AND o.patient_id = a.patient_id
        AND o.created_at >= datetime('now', '-90 days')
      GROUP BY d.id ORDER BY d.name
    `).all());
}

export async function getApiDoctorsIdReports(req: Request, res: Response) {
  const doctorId = Number(pathParam(req, "id"));
  if (!Number.isInteger(doctorId)) return res.status(400).json({ error: "Invalid doctor." });
  const reports = db.prepare(`${orderQuery}
      JOIN doctor_patient_access a ON a.doctor_id = o.doctor_id
        AND a.patient_id = o.patient_id AND a.revoked_at IS NULL
      WHERE o.doctor_id = ? AND o.created_at >= datetime('now', '-90 days')
      ORDER BY o.created_at DESC`)
      .all(doctorId) as Order[];
  res.json(reports.map(deliveryDetails));
}

export async function getApiDeliveryReport(_req: Request, res: Response) {
  res.json(db.prepare(`
      SELECT dl.id, dl.order_id, p.name AS patient_name, dl.phone, dl.channel, dl.status, dl.sent_at, dl.expires_at
      FROM deliveries dl JOIN orders o ON o.id = dl.order_id JOIN patients p ON p.id = o.patient_id
      ORDER BY dl.sent_at DESC LIMIT 100
    `).all());
}

export async function getApiAudit(_req: Request, res: Response) {
  res.json(db.prepare("SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 100").all());
}

export async function getApiStaffOrdersIdPdf(req: Request, res: Response) {
  const order = getOrder(pathParam(req, "id"));
  if (!order) return res.status(404).json({ error: "Report not found." });
  if (order.status !== "ready") return res.status(409).json({ error: "The report is not signed yet." });
  logEvent("frontdesk", "report_pdf_downloaded", order.id, "Front-desk staff downloaded report PDF");
  streamPdf(res, order);
}
