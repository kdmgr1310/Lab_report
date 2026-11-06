import { createHash, randomBytes } from "node:crypto";
import { db } from "../db.ts";
import { getOrder, type Order } from "../model.ts";
import { boundsFrom, createSummaryForOrder, isOutsideReferenceRange } from "./summaryService.ts";

const frontendOrigin = process.env.FRONTEND_ORIGIN ?? "http://localhost:5173";

export const nowIso = () => new Date().toISOString();
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export function logEvent(actor: string, action: string, orderId: string | null = null, details = "") {
  db.prepare("INSERT INTO audit_logs (actor, action, order_id, details, created_at) VALUES (?, ?, ?, ?, ?)")
    .run(actor, action, orderId, details, nowIso());
}

export const needsCriticalCallback = (parameter: string, result: number, range: string) => {
  const name = parameter.toLowerCase();
  if (name.includes("potassium")) return result >= 6.5 || result <= 2.5;
  if (name.includes("glucose")) return result >= 400 || result <= 40;
  if (name.includes("haemoglobin") || name.includes("hemoglobin")) return result <= 6;
  const bounds = boundsFrom(range);
  if (!bounds) return false;
  const [low, high] = bounds;
  return (Number.isFinite(high) && result >= high * 2)
    || (Number.isFinite(low) && result <= low * 0.5);
};

export function issueDelivery(orderId: string, mobile: string) {
  const token = randomBytes(32).toString("base64url");
  const sentAt = nowIso();
  const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();
  db.prepare(`
    INSERT INTO deliveries (order_id, phone, channel, status, link_hash, expires_at, sent_at)
    VALUES (?, ?, 'WhatsApp (mock)', 'delivered', ?, ?, ?)
  `).run(orderId, mobile, hashToken(token), expiresAt, sentAt);
  logEvent("system", "report_link_sent", orderId, "Mock WhatsApp delivery accepted");
  return { token, link: `${frontendOrigin}/?share=${encodeURIComponent(token)}`, expiresAt };
}

export async function initializeReportDeliveries() {
  const readyOrders = db.prepare(`
    SELECT o.id, p.mobile FROM orders o
    JOIN patients p ON p.id = o.patient_id
    WHERE o.status = 'ready'
  `).all() as Array<{ id: string; mobile: string }>;
  for (const order of readyOrders) {
    const record = getOrder(order.id);
    if (record) await createSummaryForOrder(record, Boolean(record.critical));
    const existing = db.prepare("SELECT id FROM deliveries WHERE order_id = ? LIMIT 1").get(order.id);
    if (!existing) issueDelivery(order.id, order.mobile);
  }
}

export function deliveryDetails(order: Order) {
  const summary = order.critical || order.status !== "ready" || !isOutsideReferenceRange(order.result, order.reference_range) || !order.summary_en
    ? null
    : {
        en: order.summary_en,
        te: order.summary_te,
        hi: order.summary_hi,
      };
  return { ...order, summary };
}

type SignResult =
  | { kind: "not_found" }
  | { kind: "already_signed" }
  | { kind: "cancelled" }
  | { kind: "update_failed" }
  | { kind: "signed"; order: Order; link: string; expiresAt: string; critical: boolean };

export async function signReport(orderId: string, actor = "frontdesk"): Promise<SignResult> {
  const order = getOrder(orderId);
  if (!order) return { kind: "not_found" };
  if (order.status === "ready") return { kind: "already_signed" };
  if (order.status === "cancelled") return { kind: "cancelled" };
  const result = Number.parseFloat(order.result);
  const critical = Number.isFinite(result) && needsCriticalCallback(order.parameter, result, order.reference_range);

  const signedResult = db.transaction((): SignResult => {
    const update = db.prepare("UPDATE orders SET status = 'ready', signed_at = ?, critical = ? WHERE id = ?")
      .run(nowIso(), critical ? 1 : 0, order.id);
    if (update.changes !== 1) return { kind: "update_failed" };
    if (critical) {
      db.prepare("INSERT OR IGNORE INTO callback_tasks (order_id, status, created_at) VALUES (?, 'open', ?)")
        .run(order.id, nowIso());
      logEvent("system", "critical_callback_created", order.id, "Critical result requires a staff callback");
    }
    const delivery = issueDelivery(order.id, order.mobile);
    logEvent(actor, "report_signed", order.id, critical ? "Critical result; no patient summary generated" : "Report signed and patient link sent");
    const updatedOrder = getOrder(order.id);
    if (!updatedOrder) throw new Error(`Signed report ${order.id} could not be reloaded.`);
    return {
      kind: "signed",
      order: updatedOrder,
      link: delivery.link,
      expiresAt: delivery.expiresAt,
      critical,
    };
  })();
  if (signedResult.kind === "signed" && !signedResult.critical) {
    await createSummaryForOrder(signedResult.order, false);
    const updatedOrder = getOrder(orderId);
    if (updatedOrder) signedResult.order = updatedOrder;
  }
  return signedResult;
}

type ResendResult =
  | { kind: "not_found" }
  | { kind: "not_signed" }
  | { kind: "sent"; link: string; expiresAt: string; phone: string };

export function resendReport(orderId: string, actor = "frontdesk"): ResendResult {
  const order = getOrder(orderId);
  if (!order) return { kind: "not_found" };
  if (order.status !== "ready") return { kind: "not_signed" };
  const delivery = issueDelivery(order.id, order.mobile);
  logEvent(actor, "report_link_resent", order.id, "Mock report link resent");
  return { kind: "sent", link: delivery.link, expiresAt: delivery.expiresAt, phone: order.mobile };
}
