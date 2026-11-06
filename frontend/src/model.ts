export type Page = 'overview' | 'patients' | 'imports' | 'delivery' | 'doctors' | 'reviews' | 'portal'

export type Order = {
  id: string
  patient_id: number
  patient_name: string
  mobile: string
  parameter: string
  result: string
  reference_range: string
  unit: string
  status: string
  doctor_name: string
  created_at: string
  signed_at: string | null
  critical: number
  summary_source?: 'ai' | 'template' | null
  summary: { en: string | null; te: string | null; hi: string | null } | null
  delivery_status?: string | null
  expires_at?: string | null
  pdf_is_original?: number
}

export type SummaryReview = Order & {
  review_status: 'pending' | 'flagged'
  generated_at: string
  patient_flagged_at: string | null
}
export type CallbackTask = Order & { callback_created_at: string; callback_status: string }

export type MetricSet = {
  reportsToday: number
  ready: number
  processing: number
  callbackTasks: number
  deliveredToday: number
}

export type Delivery = {
  id: number
  order_id: string
  patient_name: string
  phone: string
  channel: string
  status: string
  sent_at: string
  expires_at: string
}

export type Doctor = { id: number; name: string; clinic: string; report_count: number }
export type Audit = { id: number; actor: string; action: string; order_id: string | null; details: string; created_at: string }
export type LabSettings = { labName: string; labLocation: string; staffName: string; staffRole: string }
