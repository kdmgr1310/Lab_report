import type { Request, Response } from "express";
import { appConfig } from "../config.ts";

export async function health(_req: Request, res: Response) {
  res.json({ ok: true, database: "sqlite" });
}

export async function settings(_req: Request, res: Response) {
  res.json(appConfig);
}
