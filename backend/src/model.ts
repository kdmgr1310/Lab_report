import { db } from "./db.ts";

export type Order = {
  id: string;
  patient_id: number;
  doctor_id: number | null;
  patient_name: string;
  mobile: string;
  parameter: string;
  result: string;
  reference_range: string;
  unit: string;
  status: string;
  doctor_name: string;
  created_at: string;
  signed_at: string | null;
  critical: number;
  summary_en: string | null;
  summary_te: string | null;
  summary_hi: string | null;
  pdf_is_original?: number;
  delivery_status?: string | null;
  expires_at?: string | null;
};

export const orderQuery = `
  SELECT o.*, p.name AS patient_name, p.mobile, d.name AS doctor_name,
    EXISTS (SELECT 1 FROM report_pdfs rp WHERE rp.order_id = o.id) AS pdf_is_original,
    (SELECT status FROM deliveries WHERE order_id = o.id ORDER BY sent_at DESC LIMIT 1) AS delivery_status,
    (SELECT expires_at FROM deliveries WHERE order_id = o.id ORDER BY sent_at DESC LIMIT 1) AS expires_at
  FROM orders o
  JOIN patients p ON p.id = o.patient_id
  LEFT JOIN doctors d ON d.id = o.doctor_id
`;

export const getOrder = (orderId: string) =>
  db.prepare(`${orderQuery} WHERE o.id = ?`).get(orderId) as Order | undefined;

export function grantDoctorPatientAccess(doctorId: number, patientId: number, grantedByStaffId: string | null = null) {
  db.prepare(`
    INSERT INTO doctor_patient_access (doctor_id, patient_id, granted_by_staff_id, source, granted_at)
    VALUES (?, ?, ?, 'referral', ?)
    ON CONFLICT (doctor_id, patient_id) DO UPDATE SET
      granted_by_staff_id = excluded.granted_by_staff_id,
      source = excluded.source,
      granted_at = excluded.granted_at,
      revoked_at = NULL
  `).run(doctorId, patientId, grantedByStaffId, new Date().toISOString());
}
