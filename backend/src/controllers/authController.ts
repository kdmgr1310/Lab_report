import type { Request, Response } from "express";
import { randomInt, timingSafeEqual } from "node:crypto";
import { db } from "../db.ts";
import { logEvent } from "../services/reportService.ts";
import { otpChallenges } from "./requestContext.ts";
import { normalizeMobile } from "../utils/mobile.ts";

export async function postApiAuthRequestOtp(req: Request, res: Response) {
  const mobile = normalizeMobile(req.body?.mobile);
  if (!/^\+?\d{10,13}$/.test(mobile)) return res.status(400).json({ error: "Enter a valid mobile number." });
  const patients = db.prepare("SELECT id FROM patients WHERE mobile = ?").all(mobile);
  if (!patients.length) return res.status(404).json({ error: "No patient account found for this number. Please contact the front desk." });
  const code = String(randomInt(100000, 1000000));
  otpChallenges.set(mobile, { code, expiresAt: Date.now() + 5 * 60 * 1000, attempts: 0 });
  logEvent("patient", "otp_requested", null, "OTP requested for registered mobile");
  res.json({ sent: true, message: "A one-time code was sent by SMS.", demoCode: process.env.NODE_ENV === "production" ? undefined : code });
}

export async function postApiAuthVerifyOtp(req: Request, res: Response) {
  const mobile = normalizeMobile(req.body?.mobile);
  const code = String(req.body?.code ?? "");
  const challenge = otpChallenges.get(mobile);
  if (!challenge || challenge.expiresAt < Date.now() || challenge.attempts >= 5) {
      otpChallenges.delete(mobile);
      return res.status(401).json({ error: "That code has expired. Request a new one." });
    }
  challenge.attempts += 1;
  const expected = Buffer.from(challenge.code);
  const received = Buffer.from(code);
  const valid = expected.length === received.length && timingSafeEqual(expected, received);
  if (!valid) return res.status(401).json({ error: "That code is not correct. Try again." });
  otpChallenges.delete(mobile);
  await new Promise<void>((resolve, reject) => {
    req.session.regenerate((error) => error ? reject(error) : resolve());
  });
  req.session.patientMobile = mobile;
  logEvent("patient", "patient_login", null, "Patient sign-in with OTP");
  res.json({ ok: true });
}

export async function getApiAuthSession(req: Request, res: Response) {
  if (req.session.staffUser) {
    return res.json({
      user: {
        id: req.session.staffUser.id,
        displayName: req.session.staffUser.displayName,
        role: req.session.staffUser.role,
        ...(req.session.staffUser.doctorId === undefined ? {} : { doctorId: req.session.staffUser.doctorId }),
      },
    });
  }
  if (req.session.patientMobile) {
    return res.json({ user: { id: "patient", displayName: "Patient", role: "patient" } });
  }
  return res.json({ user: null });
}

export async function postApiAuthLogout(req: Request, res: Response) {
  req.session.staffUser = undefined;
  req.session.patientMobile = undefined;
  req.session.shareAccess = undefined;
  res.json({ ok: true });
}

export async function getApiAuthDemoAccounts(_req: Request, res: Response) {
  if (process.env.NODE_ENV === "production") return res.status(404).json({ error: "Not found." });
  const accounts = db.prepare(`
    SELECT s.id, s.display_name AS displayName, r.name AS role
    FROM staff_users s JOIN roles r ON r.id = s.role_id
    WHERE s.active = 1 AND s.is_demo = 1
      AND r.name IN ('admin', 'pathologist', 'frontdesk', 'doctor')
    ORDER BY CASE r.name WHEN 'frontdesk' THEN 1 WHEN 'pathologist' THEN 2 WHEN 'doctor' THEN 3 ELSE 4 END, s.display_name
  `).all();
  res.json(accounts);
}

export async function staffDemoLogin(req: Request, res: Response) {
  if (process.env.NODE_ENV === "production") return res.status(404).json({ error: "Not found." });
  const accountId = String(req.body?.accountId ?? "");
  const staff = db.prepare(`
    SELECT s.id, s.display_name, s.doctor_id, r.name AS role
    FROM staff_users s JOIN roles r ON r.id = s.role_id
    WHERE s.id = ? AND s.active = 1 AND s.is_demo = 1
  `).get(accountId) as { id: string; display_name: string; doctor_id: number | null; role: string } | undefined;
  if (!staff) return res.status(403).json({ error: "Choose an active demo staff account." });
  if (staff.role !== "admin" && staff.role !== "pathologist" && staff.role !== "frontdesk" && staff.role !== "doctor") {
    return res.status(403).json({ error: "The configured staff role is invalid." });
  }
  await new Promise<void>((resolve, reject) => {
    req.session.regenerate((error) => error ? reject(error) : resolve());
  });
  req.session.staffUser = {
    id: staff.id,
    role: staff.role,
    displayName: staff.display_name,
    ...(staff.doctor_id === null ? {} : { doctorId: staff.doctor_id }),
  };
  logEvent("system", "demo_staff_login", null, `Demo session started for ${staff.role}`);
  res.json({ id: staff.id, displayName: staff.display_name, role: staff.role });
}
