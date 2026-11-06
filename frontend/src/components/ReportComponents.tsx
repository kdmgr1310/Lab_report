import { useState } from 'react'
import {
  Activity, ArrowDownToLine, ArrowLeft, CheckCircle2, ChevronDown, CircleAlert,
  Clock3, FileText, LockKeyhole, ShieldCheck, Stethoscope, X,
} from 'lucide-react'
import type { Order } from '../model'

export function ErrorBanner({ message, onClose }: { message: string; onClose?: () => void }) {
  return <div className="error-banner"><CircleAlert size={17} /><span>{message}</span>{onClose && <button aria-label="Dismiss error" onClick={onClose}><X size={15} /></button>}</div>
}

export function StatusBadge({ status, critical }: { status: string; critical?: number }) {
  if (critical) return <span className="status-badge status-critical"><CircleAlert size={13} />Critical</span>
  if (status === 'ready') return <span className="status-badge status-ready"><CheckCircle2 size={13} />Ready</span>
  if (status === 'cancelled') return <span className="status-badge status-cancelled"><X size={13} />Cancelled</span>
  return <span className="status-badge status-processing"><Clock3 size={13} />Processing</span>
}

export function ReportView({ order, onDownload, onFlag, labName }: { order: Order; onDownload: () => void; onFlag: () => void; labName: string }) {
  const [language, setLanguage] = useState<'en' | 'te' | 'hi'>('te')
  return (
    <div className="patient-report-view">
      <div className="patient-report-head"><button className="icon-button" onClick={() => { window.history.replaceState({}, '', window.location.pathname); window.location.reload() }} aria-label="Back"><ArrowLeft size={18} /></button><div className="patient-brand-small"><div className="brand-mark"><Activity size={17} /></div><b>{labName}</b></div><span className="secure-tag"><LockKeyhole size={13} /> Secure report</span></div>
      <div className="patient-report-content">
        <p className="eyebrow">LABORATORY REPORT · {order.id}</p>
        <h1>Namaste, {order.patient_name.split(' ')[0]}</h1>
        <p className="muted">Your report is ready. Here’s a simple explanation of your result.</p>
        <div className="patient-result-card">
          <div className="patient-result-top"><span>{order.parameter}</span><StatusBadge status={order.status} critical={order.critical} /></div>
          <div className={`patient-result-value ${order.critical ? 'critical-value' : ''}`}>{order.result} <small>{order.unit}</small></div>
          <div className="patient-reference">Usual range <b>{order.reference_range} {order.unit}</b></div>
          <div className="result-range-graphic"><span className={order.critical ? 'range-marker critical-marker' : 'range-marker'} /></div>
        </div>
        {order.critical ? <div className="patient-critical"><CircleAlert size={19} /><div><b>Please speak to your doctor today</b><span>Your lab team is arranging a call. This result needs prompt medical attention.</span></div></div> :
          <section className="patient-summary">
            <div className="summary-header"><div><div className="summary-spark"><Activity size={16} /></div><div><b>In simple words</b><span>A short guide, not a diagnosis</span></div></div>
              <label className="language-select"><span className="sr-only">Summary language</span><select value={language} onChange={(event) => setLanguage(event.target.value as 'en' | 'te' | 'hi')}><option value="te">తెలుగు</option><option value="en">English</option><option value="hi">हिन्दी</option></select><ChevronDown size={14} /></label>
            </div>
            <p lang={language === 'te' ? 'te' : language === 'hi' ? 'hi' : 'en'}>{order.summary?.[language] ?? 'A plain-language summary is not available for this test yet. Please review the full report with your doctor.'}</p>
          </section>}
        <button className="button button-primary patient-download" onClick={onDownload}><ArrowDownToLine size={18} /> View full report (PDF)</button>
        {!order.critical && order.summary && <button className="text-button flag-summary" onClick={onFlag}>Something doesn’t look right? Let us know</button>}
        <div className="patient-doctor-note"><Stethoscope size={17} /><span>For advice about what this result means for you, please talk to <b>{order.doctor_name}</b>.</span></div>
        <p className="privacy-foot"><ShieldCheck size={14} /> Only you can open this private report. Link expires 72 hours after it was sent.</p>
      </div>
    </div>
  )
}

export function PortalBrand({ onBack, labName = 'Niramaya' }: { onBack?: () => void; labName?: string }) {
  return <div className="portal-brand-row">{onBack && <button className="icon-button" onClick={onBack} aria-label="Back to staff dashboard"><ArrowLeft size={18} /></button>}<div className="brand-mark"><Activity size={19} /></div><span><b>{labName}</b><small>LAB SERVICES</small></span><span className="portal-brand-spacer" /><span className="secure-tag"><LockKeyhole size={13} /> Private & secure</span></div>
}

export function EmptyState({ title, text }: { title: string; text: string }) {
  return <div className="empty-state"><div><FileText size={19} /></div><b>{title}</b><span>{text}</span></div>
}
