import express, { type NextFunction, type Request, type Response } from "express";
import session from "express-session";
import cors from "cors";
import { initializeRoutes, router } from "./routes.ts";
import { db } from "./db.ts";
import { seedDatabase } from "./seed.ts";

seedDatabase();

const app = express();
const port = Number(process.env.PORT ?? 4000);
const frontendOrigin = process.env.FRONTEND_ORIGIN ?? "http://localhost:5173";
const allowedOrigins = new Set([frontendOrigin, frontendOrigin.replace("localhost", "127.0.0.1")]);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.has(origin)) return callback(null, true);
    return callback(new Error("Origin is not allowed."));
  },
  credentials: true,
}));
app.use(express.raw({ type: "application/pdf", limit: "10mb" }));
app.use(express.json({ limit: "2mb" }));
app.use(session({
  name: "swasthya.sid",
  secret: process.env.SESSION_SECRET ?? "local-demo-session-secret-change-before-deployment",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 12 * 60 * 60 * 1000,
  },
}));
app.use(router);
app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(error);
  res.status(500).json({ error: "Something went wrong. Please try again or contact support." });
});

app.listen(port, () => {
  console.log(`Swasthya API listening on http://localhost:${port}`);
  void initializeRoutes().catch((error: unknown) => {
    console.error("Report initialization failed:", error);
  });
});

process.on("SIGINT", () => {
  db.close();
  process.exit(0);
});
