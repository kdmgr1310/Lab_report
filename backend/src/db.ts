import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { normalizeMobile } from "./utils/mobile.ts";

const databasePath = process.env.DATABASE_PATH ?? join(process.cwd(), "data", "swasthya.sqlite");
mkdirSync(dirname(databasePath), { recursive: true });

export const db = new Database(databasePath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS patients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    mobile TEXT NOT NULL,
    language TEXT NOT NULL DEFAULT 'en',
    consent_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS doctors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    clinic TEXT NOT NULL DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    description TEXT NOT NULL DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS staff_users (
    id TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    mobile TEXT UNIQUE,
    email TEXT UNIQUE,
    role_id INTEGER NOT NULL REFERENCES roles(id),
    doctor_id INTEGER REFERENCES doctors(id),
    active INTEGER NOT NULL DEFAULT 1,
    is_demo INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    patient_id INTEGER NOT NULL REFERENCES patients(id),
    parameter TEXT NOT NULL,
    result TEXT NOT NULL,
    reference_range TEXT NOT NULL,
    unit TEXT NOT NULL DEFAULT '',
    status TEXT NOT NULL,
    doctor_id INTEGER REFERENCES doctors(id),
    created_at TEXT NOT NULL,
    signed_at TEXT,
    critical INTEGER NOT NULL DEFAULT 0,
    summary_en TEXT,
    summary_te TEXT,
    summary_hi TEXT
  );
  CREATE TABLE IF NOT EXISTS deliveries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id TEXT NOT NULL REFERENCES orders(id),
    phone TEXT NOT NULL,
    channel TEXT NOT NULL,
    status TEXT NOT NULL,
    link_hash TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    sent_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    actor TEXT NOT NULL,
    action TEXT NOT NULL,
    order_id TEXT,
    details TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS callback_tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id TEXT NOT NULL UNIQUE REFERENCES orders(id),
    status TEXT NOT NULL DEFAULT 'open',
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS report_pdfs (
    order_id TEXT PRIMARY KEY REFERENCES orders(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_data BLOB NOT NULL,
    uploaded_by TEXT NOT NULL,
    uploaded_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS summary_reviews (
    order_id TEXT PRIMARY KEY REFERENCES orders(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'flagged', 'reviewed')),
    generated_at TEXT NOT NULL,
    patient_flagged_at TEXT,
    reviewed_at TEXT,
    reviewer_staff_id TEXT REFERENCES staff_users(id) ON DELETE SET NULL
  );
  CREATE TABLE IF NOT EXISTS doctor_patient_access (
    doctor_id INTEGER NOT NULL REFERENCES doctors(id),
    patient_id INTEGER NOT NULL REFERENCES patients(id),
    granted_by_staff_id TEXT REFERENCES staff_users(id) ON DELETE SET NULL,
    source TEXT NOT NULL DEFAULT 'referral',
    granted_at TEXT NOT NULL,
    revoked_at TEXT,
    PRIMARY KEY (doctor_id, patient_id)
  );
  CREATE INDEX IF NOT EXISTS idx_doctor_patient_access_active
    ON doctor_patient_access (doctor_id, revoked_at, patient_id);
`);

const staffUserColumns = db.pragma("table_info(staff_users)") as Array<{ name: string }>;
if (!staffUserColumns.some((column) => column.name === "doctor_id")) {
  db.exec("ALTER TABLE staff_users ADD COLUMN doctor_id INTEGER REFERENCES doctors(id)");
}
if (!staffUserColumns.some((column) => column.name === "is_demo")) {
  db.exec("ALTER TABLE staff_users ADD COLUMN is_demo INTEGER NOT NULL DEFAULT 0");
}

const patientsWithMobile = db.prepare("SELECT id, mobile FROM patients").all() as Array<{ id: number; mobile: string }>;
const updatePatientMobile = db.prepare("UPDATE patients SET mobile = ? WHERE id = ?");
const normalizePatientMobiles = db.transaction(() => {
  for (const patient of patientsWithMobile) {
    const mobile = normalizeMobile(patient.mobile);
    if (mobile !== patient.mobile) updatePatientMobile.run(mobile, patient.id);
  }
});
normalizePatientMobiles();
