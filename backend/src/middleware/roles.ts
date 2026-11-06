import type { NextFunction, Request, Response, RequestHandler } from "express";

export type AppRole = "admin" | "pathologist" | "frontdesk" | "doctor" | "patient";

declare module "express-session" {
  interface SessionData {
    staffUser?: {
      id: string;
      role: AppRole;
      displayName: string;
      doctorId?: number;
    };
    patientMobile?: string;
    shareAccess?: Record<string, number>;
  }
}

export function requireRole(...roles: AppRole[]): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    if (roles.includes("patient") && req.session.patientMobile) return next();
    const user = req.session.staffUser;
    if (!user) return res.status(401).json({ error: "Please sign in to continue." });
    if (!roles.includes(user.role)) return res.status(403).json({ error: "Your account does not have permission to do this." });
    next();
  };
}

export const requirePatient = requireRole("patient");

export const requireStaff = requireRole("admin", "pathologist", "frontdesk");
