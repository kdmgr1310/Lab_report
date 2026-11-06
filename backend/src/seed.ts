import { db } from "./db.ts";
import { appConfig } from "./config.ts";

export function seedDatabase() {
  const now = new Date().toISOString();
  const insertRole = db.prepare("INSERT OR IGNORE INTO roles (name, description) VALUES (?, ?)");
  insertRole.run("admin", "Manage staff and lab configuration");
  insertRole.run("pathologist", "Review and sign laboratory reports");
  insertRole.run("frontdesk", "Manage patient report delivery");
  insertRole.run("doctor", "View reports for authorized patients");

  const role = db.prepare("SELECT id FROM roles WHERE name = ?").get(appConfig.staffRoleCode) as { id: number } | undefined;
  if (!role) throw new Error("STAFF_ROLE_CODE must be admin, pathologist, frontdesk, or doctor.");

  const demoAccounts = [
    { id: "demo-login-frontdesk", name: "Demo Front Desk", roleCode: "frontdesk" },
    { id: "demo-login-pathologist", name: "Demo Pathologist", roleCode: "pathologist" },
    { id: "demo-login-admin", name: "Demo Admin", roleCode: "admin" },
  ];
  const insertStaff = db.prepare(`
    INSERT OR IGNORE INTO staff_users (id, display_name, role_id, is_demo, created_at)
    VALUES (?, ?, (SELECT id FROM roles WHERE name = ?), 1, ?)
  `);
  for (const account of demoAccounts) {
    insertStaff.run(account.id, account.name, account.roleCode, now);
    db.prepare("UPDATE staff_users SET is_demo = 1 WHERE id = ?").run(account.id);
  }

  const patientCount = (db.prepare("SELECT COUNT(*) AS count FROM patients").get() as { count: number }).count;
  if (patientCount === 0) {
    const insertDoctor = db.prepare("INSERT INTO doctors (name, clinic) VALUES (?, ?)");
    const drRamanaiah = Number(insertDoctor.run("Dr. S. Ramanaiah", "Coastal Care Clinic").lastInsertRowid);
    const drAnitha = Number(insertDoctor.run("Dr. P. Anitha", "Anitha Family Practice").lastInsertRowid);
    const drSuresh = Number(insertDoctor.run("Dr. K. Suresh", "Suresh Medical Centre").lastInsertRowid);
    const insertPatient = db.prepare("INSERT INTO patients (name, mobile, language, consent_at) VALUES (?, ?, ?, ?)");
    const patientOne = Number(insertPatient.run("Lakshmi Prasanna K", "+919876543210", "te", now).lastInsertRowid);
    const patientTwo = Number(insertPatient.run("Venkata Rao M", "+919876543211", "te", now).lastInsertRowid);
    const patientThree = Number(insertPatient.run("Farzana Begum", "+919876543212", "hi", now).lastInsertRowid);
    const insertOrder = db.prepare(`
      INSERT INTO orders (id, patient_id, parameter, result, reference_range, unit, status, doctor_id, created_at, signed_at, critical)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insertOrder.run(
      "ORD-71204", patientOne, "Haemoglobin", "10.2", "12.0-15.5", "g/dL", "ready", drRamanaiah,
      new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
      new Date(Date.now() - 45 * 60 * 1000).toISOString(), 0,
    );
    insertOrder.run(
      "ORD-71219", patientTwo, "LDL cholesterol", "142", "0-100", "mg/dL", "processing", drAnitha,
      new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), null, 0,
    );
    insertOrder.run(
      "ORD-71233", patientThree, "Potassium", "6.8", "3.5-5.1", "mmol/L", "ready", drSuresh,
      new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
      new Date(Date.now() - 30 * 60 * 1000).toISOString(), 1,
    );
    db.prepare("INSERT INTO callback_tasks (order_id, status, created_at) VALUES (?, 'open', ?)").run("ORD-71233", now);
    db.prepare(`
      INSERT INTO audit_logs (actor, action, order_id, details, created_at)
      VALUES ('system', 'critical_callback_created', 'ORD-71233', 'Critical potassium result requires a staff callback', ?)
    `).run(now);
  }

  const demoDoctors = db.prepare("SELECT id, name FROM doctors").all() as Array<{ id: number; name: string }>;
  const insertDemoDoctor = db.prepare(`
    INSERT OR IGNORE INTO staff_users (id, display_name, role_id, doctor_id, is_demo, created_at)
    VALUES (?, ?, (SELECT id FROM roles WHERE name = 'doctor'), ?, 1, ?)
  `);
  for (const doctor of demoDoctors) {
    insertDemoDoctor.run(`demo-login-doctor-${doctor.id}`, doctor.name, doctor.id, now);
  }

  db.prepare(`
    INSERT OR IGNORE INTO doctor_patient_access (doctor_id, patient_id, source, granted_at)
    SELECT DISTINCT doctor_id, patient_id, 'referral', ?
    FROM orders WHERE doctor_id IS NOT NULL
  `).run(now);

  db.prepare(`
    INSERT OR IGNORE INTO staff_users (id, display_name, role_id, created_at)
    VALUES (?, ?, ?, ?)
  `).run(appConfig.staffId, appConfig.staffName, role.id, now);
  db.prepare(`
    UPDATE staff_users SET display_name = ?, role_id = ?, doctor_id = ? WHERE id = ?
  `).run(appConfig.staffName, role.id, appConfig.staffDoctorId ?? null, appConfig.staffId);
}
