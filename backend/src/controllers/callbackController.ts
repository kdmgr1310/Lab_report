import type { Request, Response } from "express";
import { db } from "../db.ts";
import { orderQuery, type Order } from "../model.ts";
import { logEvent, nowIso } from "../services/reportService.ts";
import { pathParam } from "./requestContext.ts";

export async function listOpenCallbackTasks(_req: Request, res: Response) {
  const tasks = db.prepare(`
    ${orderQuery}
    JOIN callback_tasks ct ON ct.order_id = o.id
    WHERE ct.status = 'open'
    ORDER BY ct.created_at ASC
  `).all() as Array<Order & { callback_created_at: string; callback_status: string }>;
  res.json(tasks);
}

export async function completeCallbackTask(req: Request, res: Response) {
  const orderId = pathParam(req, "id");
  const staff = req.session.staffUser;
  if (!staff) return res.status(401).json({ error: "Please sign in to continue." });
  const result = db.prepare("UPDATE callback_tasks SET status = 'completed' WHERE order_id = ? AND status = 'open'")
    .run(orderId);
  if (result.changes !== 1) {
    const exists = db.prepare("SELECT order_id FROM callback_tasks WHERE order_id = ?").get(orderId);
    return res.status(exists ? 409 : 404).json({ error: exists ? "This callback task is already complete." : "Callback task not found." });
  }
  logEvent(`${staff.role}:${staff.id}`, "critical_callback_completed", orderId, `Callback task completed at ${nowIso()}`);
  res.json({ ok: true });
}
