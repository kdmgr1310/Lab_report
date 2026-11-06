import { useState, type RefObject, type ReactNode } from 'react'
import {
  Activity, ArrowDownToLine, ArrowRight, Check, CheckCircle2, ChevronRight, CircleAlert,
  Clock3, FileText, HeartPulse, History, LoaderCircle, LockKeyhole, MessageCircle, Plus,
  Search, Send, ShieldCheck, Upload, X,
} from 'lucide-react'
import { EmptyState, StatusBadge } from '../components/ReportComponents'
import type { Audit, CallbackTask, Delivery, Doctor, MetricSet, Order, SummaryReview } from '../model'

const fmtTime = (value: string) => new Date(value).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' })
const fmtDate = (value: string) => new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })

export function Overview({ metrics, callbackTasks, orders, staffName, canImport, onViewAll, onOpen, onPortal, onImports, onCompleteCallback }: {
  metrics: MetricSet; callbackTasks: CallbackTask[]; orders: Order[]; staffName: string; canImport: boolean; onViewAll: () => void; onOpen: (order: Order) => void; onPortal: () => void; onImports: () => void; onCompleteCallback: (orderId: string) => void
}) {
  const callbackOrder = callbackTasks[0]
  const [today] = useState(() => new Date())
  return (
    <div className="page-stack">
      <div className="page-heading heading-with-action">
        <div><p className="eyebrow">{today.toLocaleDateString('en-IN', { weekday: 'long', day: '2-digit', month: 'long' }).toUpperCase()}</p><h1>Welcome, {staffName} <span className="wave">✦</span></h1><p className="muted">Here’s what’s happening across your reports today.</p></div>
        {canImport && <button className="button button-primary" onClick={onImports}><Plus size={17} /> Import LIS file</button>}
      </div>
      <section className="stat-grid" aria-label="Report summary">
        <StatCard label="Reports today" value={metrics.reportsToday} sub="Across all locations" icon={<FileText size={18} />} tone="teal" />
        <StatCard label="Ready to share" value={metrics.ready} sub="Secure links sent" icon={<CheckCircle2 size={18} />} tone="green" />
        <StatCard label="In progress" value={metrics.processing} sub="Awaiting sign-off" icon={<Clock3 size={18} />} tone="blue" />
        <StatCard label="Callback needed" value={metrics.callbackTasks} sub="Critical results" icon={<CircleAlert size={18} />} tone="amber" />
      </section>
      <div className="dashboard-grid">
        <section className="panel recent-panel">
          <div className="panel-heading"><div><h2>Recent reports</h2><p>Latest activity from the LIS</p></div><button className="link-button" onClick={onViewAll}>View all <ArrowRight size={15} /></button></div>
          {orders.length ? <div className="report-list">
            {orders.map((order) => <div className="report-row" key={order.id}>
              <div className={`patient-initial ${order.critical ? 'initial-amber' : ''}`}>{order.patient_name.split(' ').map((part) => part[0]).slice(0, 2).join('')}</div>
              <div className="report-main"><b>{order.patient_name}</b><span>{order.parameter} <i>·</i> {order.id}</span></div>
              <div className="report-doctor">{order.doctor_name}</div>
              <StatusBadge status={order.status} critical={order.critical} />
              <button className="row-arrow" aria-label={`Open report ${order.id}`} onClick={() => onOpen(order)}><ChevronRight size={17} /></button>
            </div>)}
          </div> : <EmptyState title="No reports yet" text="Import a LIS CSV to see reports here." />}
          <div className="panel-footer"><span><span className="live-dot" /> Updated just now</span><button className="text-button" onClick={onViewAll}>Open report list</button></div>
        </section>
        <aside className="right-rail">
          <section className="attention-card">
            <div className="attention-top"><span className="attention-icon"><CircleAlert size={18} /></span><span className="priority-label">NEEDS ATTENTION</span></div>
            <h3>{callbackOrder ? 'Critical result callback' : 'No urgent callbacks'}</h3>
            <p>{callbackOrder ? `${callbackOrder.patient_name} · ${callbackOrder.parameter} ${callbackOrder.result} ${callbackOrder.unit}. Call the patient promptly.` : 'Critical results will appear here with a callback task for the care team.'}</p>
            {callbackOrder && <div className="form-stack"><button className="button button-light" onClick={() => onOpen(callbackOrder)}>Open report <ArrowRight size={15} /></button><button className="text-button" onClick={() => onCompleteCallback(callbackOrder.id)}>Mark callback complete</button></div>}
          </section>
          <section className="panel quick-card">
            <div className="panel-heading compact-heading"><div><h2>Quick actions</h2><p>Pick up where you left off</p></div></div>
            {canImport && <button className="quick-action" onClick={onImports}><span className="quick-icon teal-bg"><Upload size={17} /></span><span><b>Import LIS export</b><small>CSV · results and sign-off status</small></span><ChevronRight size={17} /></button>}
            <button className="quick-action" onClick={onPortal}><span className="quick-icon purple-bg"><HeartPulse size={17} /></span><span><b>Patient portal</b><small>Preview the patient experience</small></span><ChevronRight size={17} /></button>
          </section>
          <section className="insight-card"><div className="insight-icon"><Activity size={17} /></div><div><b>{metrics.deliveredToday} digital deliveries today</b><p>Every signed report is sent automatically with a private, expiring link.</p></div></section>
        </aside>
      </div>
    </div>
  )
}

function StatCard({ label, value, sub, icon, tone }: { label: string; value: number; sub: string; icon: ReactNode; tone: string }) {
  return <article className="stat-card"><div className={`stat-icon ${tone}`}>{icon}</div><div className="stat-label">{label}</div><div className="stat-value">{value.toLocaleString('en-IN')}</div><div className="stat-sub">{sub}</div></article>
}

export function PatientsPage({ orders, search, onSearch, onOpen, onResend, onPortal, busyOrder, copiedLink }: {
  orders: Order[]; search: string; onSearch: (value: string) => void; onOpen: (order: Order) => void; onResend: (order: Order) => void; onPortal: () => void; busyOrder: string; copiedLink: string
}) {
  return (
    <div className="page-stack">
      <div className="page-heading heading-with-action">
        <div><p className="eyebrow">REPORT MANAGEMENT</p><h1>Patients & reports</h1><p className="muted">Find reports, check delivery status, and share a secure link.</p></div>
        <button className="button button-outline" onClick={onPortal}><HeartPulse size={17} /> Patient portal</button>
      </div>
      <section className="panel table-panel">
        <div className="table-toolbar"><div><h2>All reports</h2><p>{orders.length} reports in this view</p></div><label className="search-field"><Search size={16} /><input placeholder="Search patient, order or test…" value={search} onChange={(event) => onSearch(event.target.value)} /><kbd>⌘ K</kbd></label></div>
        <div className="table-scroll"><table className="data-table"><thead><tr><th>ORDER / PATIENT</th><th>TEST</th><th>REFERRING DOCTOR</th><th>STATUS</th><th>DELIVERY</th><th aria-label="Actions" /></tr></thead><tbody>
          {orders.map((order) => <tr key={order.id}>
            <td><button className="table-patient" onClick={() => onOpen(order)}><b>{order.patient_name}</b><span>{order.id} <i>·</i> {fmtDate(order.created_at)}</span></button></td>
            <td><span className="test-name">{order.parameter}</span><small>{order.result} {order.unit}</small></td>
            <td className="doctor-cell">{order.doctor_name}</td>
            <td><StatusBadge status={order.status} critical={order.critical} /></td>
            <td>{order.status !== 'ready' ? <span className="delivery-pending">After sign-off</span> : <span className={`delivery-sent ${order.delivery_status === 'delivered' ? '' : 'delivery-wait'}`}><span />{order.delivery_status === 'delivered' ? 'Link sent' : 'Not sent'}</span>}</td>
            <td><div className="row-actions"><button title={copiedLink === order.id ? 'Link copied' : 'Resend secure link'} className="icon-button" disabled={order.status !== 'ready' || busyOrder === order.id} onClick={() => onResend(order)}>{busyOrder === order.id ? <LoaderCircle size={16} className="spin" /> : copiedLink === order.id ? <Check size={16} /> : <Send size={16} />}</button><button className="icon-button" aria-label={`View ${order.id}`} onClick={() => onOpen(order)}><ChevronRight size={17} /></button></div></td>
          </tr>)}
          {!orders.length && <tr><td colSpan={6}><EmptyState title="No matching reports" text="Try another search or import a LIS export." /></td></tr>}
        </tbody></table></div>
        <div className="panel-footer"><span>Patient data is visible only to authorized staff.</span><span className="audit-mark"><ShieldCheck size={14} /> Access logged</span></div>
      </section>
    </div>
  )
}

export function ImportsPage({ fileInput, onFile, loading, result, onClear }: {
  fileInput: RefObject<HTMLInputElement | null>; onFile: (file?: File) => void; loading: boolean; result: { imported: string[]; skipped: string[] } | null; onClear: () => void
}) {
  return (
    <div className="page-stack">
      <div className="page-heading"><p className="eyebrow">LIS CONNECTION</p><h1>Import reports</h1><p className="muted">Bring in a CSV export from your existing lab system. No LIS changes needed.</p></div>
      <div className="import-layout">
        <section className="panel import-panel">
          <div className="import-title"><div className="import-file-icon"><FileText size={21} /></div><div><h2>Upload LIS export</h2><p>CSV file · Up to 1 MB</p></div></div>
          <label className={`drop-zone ${loading ? 'is-loading' : ''}`} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); onFile(event.dataTransfer.files[0]) }}>
            <input ref={fileInput} type="file" accept=".csv,text/csv" onChange={(event) => onFile(event.target.files?.[0])} />
            <span className="upload-icon">{loading ? <LoaderCircle size={23} className="spin" /> : <Upload size={22} />}</span>
            <b>{loading ? 'Reading your export…' : 'Choose a CSV file or drag it here'}</b>
            <small>We’ll check your file before importing.</small>
            <span className="button button-outline">{loading ? 'Please wait' : 'Browse files'}</span>
          </label>
          <div className="import-safe"><LockKeyhole size={15} /><span>Your data stays in your lab’s private workspace. Imports are recorded in the access log.</span></div>
        </section>
        <aside className="panel format-panel">
          <div className="format-heading"><span className="format-icon"><CheckCircle2 size={17} /></span><h2>Required columns</h2></div>
          <p>Use these column names in the first row. Include Mobile and Consent for new patients; consent must be recorded before account setup.</p>
          <div className="column-tags"><span>Order ID</span><span>Patient</span><span>Parameter</span><span>Result</span><span>Reference Range</span></div>
          <div className="optional-column"><b>Optional</b><span>Status, Referring Doctor, Unit</span></div>
          <div className="optional-column"><b>For new patients</b><span>Mobile, Consent (Yes)</span></div>
          <button className="text-button download-sample" onClick={() => {
            const csv = 'Order ID,Patient,Parameter,Result,Reference Range,Status,Referring Doctor,Mobile,Unit,Consent\nORD-71240,Sample Patient,Haemoglobin,11.4,12.0-15.5,Processing,Dr. Example,+919876543210,g/dL,Yes'
            const link = document.createElement('a')
            link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
            link.download = 'niramaya-lis-sample.csv'
            link.click()
            URL.revokeObjectURL(link.href)
          }}>Download sample CSV <ArrowDownToLine size={15} /></button>
        </aside>
      </div>
      {result && <section className="panel import-result">
        <div className="result-heading"><div><div className="result-check"><CheckCircle2 size={18} /></div><h2>Import complete</h2></div><button className="icon-button" aria-label="Dismiss" onClick={onClear}><X size={17} /></button></div>
        <p>{result.imported.length ? `${result.imported.length} report${result.imported.length === 1 ? '' : 's'} added. Ready reports were sent a secure link; processing reports are waiting for sign-off.` : 'No reports were imported. Check the skipped-row reasons below; duplicate order IDs are not imported again.'}</p>
        {result.imported.length > 0 && <div className="imported-ids">{result.imported.map((id) => <span key={id}>{id}</span>)}</div>}
        {result.skipped.length > 0 && <div className="skipped-rows"><b>Rows skipped</b>{result.skipped.map((item) => <span key={item}>{item}</span>)}</div>}
      </section>}
    </div>
  )
}

export function DeliveryPage({ deliveries, audits, tab, onTab, metrics }: { deliveries: Delivery[]; audits: Audit[]; tab: 'deliveries' | 'access'; onTab: (tab: 'deliveries' | 'access') => void; metrics: MetricSet }) {
  const sentCount = deliveries.filter((delivery) => delivery.status === 'delivered').length
  return (
    <div className="page-stack">
      <div className="page-heading heading-with-action">
        <div><p className="eyebrow">OPERATIONS</p><h1>Delivery & access</h1><p className="muted">A clear record of every patient link sent and report opened.</p></div>
        <span className="report-date"><History size={15} /> Last 30 days</span>
      </div>
      <section className="stat-grid delivery-stats">
        <StatCard label="Links sent" value={deliveries.length} sub="WhatsApp · mock channel" icon={<Send size={18} />} tone="teal" />
        <StatCard label="Delivered" value={sentCount} sub="Delivery confirmation" icon={<CheckCircle2 size={18} />} tone="green" />
        <StatCard label="Reports opened" value={audits.filter((item) => item.action === 'report_viewed').length} sub="OTP verified" icon={<LockKeyhole size={18} />} tone="blue" />
        <StatCard label="Callback tasks" value={metrics.callbackTasks} sub="Awaiting staff follow-up" icon={<CircleAlert size={18} />} tone="amber" />
      </section>
      <section className="panel table-panel">
        <div className="tab-bar"><button className={tab === 'deliveries' ? 'tab-active' : ''} onClick={() => onTab('deliveries')}>Delivery history <span>{deliveries.length}</span></button><button className={tab === 'access' ? 'tab-active' : ''} onClick={() => onTab('access')}>Access log <span>{audits.length}</span></button></div>
        {tab === 'deliveries' ? <div className="table-scroll"><table className="data-table"><thead><tr><th>PATIENT / ORDER</th><th>CHANNEL</th><th>DELIVERY STATUS</th><th>SENT</th><th>LINK EXPIRES</th></tr></thead><tbody>
          {deliveries.map((delivery) => <tr key={delivery.id}><td><div className="table-patient static"><b>{delivery.patient_name}</b><span>{delivery.order_id} <i>·</i> {delivery.phone}</span></div></td><td><span className="channel-tag"><MessageCircle size={14} />{delivery.channel}</span></td><td><span className="delivery-sent"><span />{delivery.status}</span></td><td className="date-cell">{fmtDate(delivery.sent_at)} · {fmtTime(delivery.sent_at)}</td><td className="date-cell">{fmtDate(delivery.expires_at)}</td></tr>)}
          {!deliveries.length && <tr><td colSpan={5}><EmptyState title="No delivery history yet" text="Links will appear here as reports are signed." /></td></tr>}
        </tbody></table></div> : <div className="audit-list">
          {audits.map((entry) => <div className="audit-row" key={entry.id}><span className={`audit-action-icon ${entry.action.includes('critical') ? 'audit-warning' : ''}`}>{entry.action.includes('otp') || entry.action.includes('login') ? <LockKeyhole size={15} /> : entry.action.includes('sent') || entry.action.includes('resent') ? <Send size={15} /> : entry.action.includes('critical') ? <CircleAlert size={15} /> : <FileText size={15} />}</span><div><b>{entry.action.replaceAll('_', ' ')}</b><span>{entry.details}{entry.order_id ? ` · ${entry.order_id}` : ''}</span></div><time>{fmtDate(entry.created_at)} · {fmtTime(entry.created_at)}</time></div>)}
          {!audits.length && <EmptyState title="No access activity yet" text="Report views and delivery events will be recorded here." />}
        </div>}
        <div className="panel-footer"><span>Log entries are retained for audit. Patient phone numbers are partially masked in patient-facing views.</span><span className="audit-mark"><ShieldCheck size={14} /> Audit trail</span></div>
      </section>
    </div>
  )
}

export function DoctorsPage({ doctors, selected, onSelect, reports, onOpen }: { doctors: Doctor[]; selected: number | null; onSelect: (id: number) => void; reports: Order[]; onOpen: (order: Order) => void }) {
  const doctor = doctors.find((item) => item.id === selected)
  return (
    <div className="page-stack">
      <div className="page-heading"><p className="eyebrow">REFERRING CLINICIANS</p><h1>Doctor access</h1><p className="muted">A focused view of each doctor’s reports from the last 90 days.</p></div>
      <div className="doctor-layout">
        <section className="panel doctor-list-panel"><div className="panel-heading"><div><h2>Referring doctors</h2><p>{doctors.length} clinicians</p></div></div>
          {doctors.map((item) => <button key={item.id} className={`doctor-select ${selected === item.id ? 'doctor-selected' : ''}`} onClick={() => onSelect(item.id)}><span className="doctor-avatar">{item.name.split(' ').slice(-1)[0][0]}</span><span><b>{item.name}</b><small>{item.clinic || 'Referring clinician'}</small></span><span className="doctor-count">{item.report_count}</span></button>)}
          {!doctors.length && <EmptyState title="No referring doctors" text="Doctors appear when included in LIS imports." />}
        </section>
        <section className="panel doctor-report-panel">
          {doctor ? <><div className="doctor-report-heading"><div className="doctor-avatar large">{doctor.name.split(' ').slice(-1)[0][0]}</div><div><h2>{doctor.name}</h2><p>{doctor.clinic || 'Referring clinician'} <span>·</span> Last 90 days</p></div><div className="doctor-report-count"><b>{reports.length}</b><span>reports</span></div></div>
            <div className="doctor-report-list">{reports.map((order) => <button key={order.id} className="doctor-report-row" onClick={() => onOpen(order)}><div className="patient-initial">{order.patient_name.split(' ').map((part) => part[0]).slice(0, 2).join('')}</div><span className="doctor-report-patient"><b>{order.patient_name}</b><small>{order.id} · {order.parameter}</small></span><span className="doctor-report-date">{fmtDate(order.created_at)}</span><StatusBadge status={order.status} critical={order.critical} /><ChevronRight size={17} /></button>)}
              {!reports.length && <EmptyState title="No reports in this period" text="Reports from this doctor will show here." />}
            </div>
          </> : <EmptyState title="Select a doctor" text="Choose a clinician to see their recent reports." />}
        </section>
      </div>
      <div className="info-note"><LockKeyhole size={15} /><span>Doctor accounts are represented in this demo view. Production access should use verified clinician identity and role-based permissions.</span></div>
    </div>
  )
}

export function DoctorReportsPage({ reports, onDownload }: {
  reports: Order[]
  onDownload: (order: Order) => void
}) {
  return (
    <div className="portal-reports">
      {reports.length ? <div className="portal-order-list">{reports.map((order) => (
        <article className="portal-order-card" key={order.id}>
          <div className="portal-order-top"><span>{fmtDate(order.created_at)} · {order.id}</span><StatusBadge status={order.status} critical={order.critical} /></div>
          <h2>{order.patient_name}</h2>
          <p>{order.parameter} · {order.result} {order.unit} · Ref. {order.reference_range}</p>
          {order.status === 'ready' && <button className="button button-primary" onClick={() => onDownload(order)}><ArrowDownToLine size={16} /> View report PDF</button>}
        </article>
      ))}</div> : <EmptyState title="No reports in this period" text="Reports for your authorized patients from the last 90 days will appear here." />}
    </div>
  )
}

export function SummaryReviewsPage({ items, weeklyReviewed, weeklyTarget, busyOrder, onReview }: {
  items: SummaryReview[]
  weeklyReviewed: number
  weeklyTarget: number
  busyOrder: string
  onReview: (orderId: string) => void
}) {
  return (
    <div className="page-stack">
      <div className="page-heading"><p className="eyebrow">PATHOLOGIST WORKFLOW</p><h1>Summary review</h1><p className="muted">Review patient-friendly summaries for safety. Critical results are excluded.</p></div>
      <section className="panel" style={{ padding: 24 }}>
        <div className="panel-heading"><div><h2>Weekly review target</h2><p>{weeklyReviewed} of {weeklyTarget} summaries reviewed this week</p></div></div>
        <progress value={Math.min(weeklyReviewed, weeklyTarget)} max={weeklyTarget} aria-label={`${weeklyReviewed} of ${weeklyTarget} summaries reviewed`} style={{ width: '100%', height: 12, accentColor: '#14665e' }} />
      </section>
      {items.length ? items.map((item) => (
        <section className="panel" key={item.id} style={{ padding: 24 }}>
          <div className="panel-heading"><div><h2>{item.patient_name} · {item.parameter}</h2><p>{item.id} · Result {item.result} {item.unit} · Reference {item.reference_range} {item.unit}</p></div><span className={item.review_status === 'flagged' ? 'priority-label' : 'template-tag'}>{item.review_status === 'flagged' ? 'PATIENT FLAGGED' : 'PENDING REVIEW'}</span></div>
          <div className="review-summary-list">
            <div><b>English</b><p lang="en">{item.summary?.en ?? 'English summary unavailable.'}</p></div>
            <div><b>తెలుగు</b><p lang="te">{item.summary?.te ?? 'తెలుగు సారాంశం అందుబాటులో లేదు.'}</p></div>
            <div><b>हिन्दी</b><p lang="hi">{item.summary?.hi ?? 'हिन्दी सारांश उपलब्ध नहीं है।'}</p></div>
          </div>
          <div className="panel-footer"><span>{item.summary_source === 'ai' ? 'Generated by local AI' : 'Locked template fallback'} · {item.patient_flagged_at ? `Flagged ${fmtDate(item.patient_flagged_at)}` : `Generated ${fmtDate(item.generated_at)}`}</span><button className="button button-primary" disabled={busyOrder === item.id} onClick={() => onReview(item.id)}>{busyOrder === item.id ? <LoaderCircle size={16} className="spin" /> : <Check size={16} />} Mark reviewed</button></div>
        </section>
      )) : <section className="panel" style={{ padding: 24 }}><EmptyState title="No summaries need review" text="New eligible summaries and patient flags will appear here." /></section>}
      <p className="muted">AI drafts use only test name, result, unit, and reference range with the local model. Locked templates are used if the model is unavailable or its output fails validation.</p>
    </div>
  )
}

export function ReportModal({ order, canSign, onClose, onSign, onResend, busy, onDownload, onPdfUpload, pdfBusy }: { order: Order; canSign: boolean; onClose: () => void; onSign: () => void; onResend: () => void; busy: boolean; onDownload: () => void; onPdfUpload: (file: File) => void; pdfBusy: boolean }) {
  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="report-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <header className="modal-header"><div><p className="eyebrow">REPORT DETAILS</p><h2 id="modal-title">{order.id}</h2></div><button className="icon-button" aria-label="Close report" onClick={onClose}><X size={19} /></button></header>
        <div className="modal-patient"><div className="patient-initial">{order.patient_name.split(' ').map((part) => part[0]).slice(0, 2).join('')}</div><div><b>{order.patient_name}</b><span>{order.mobile} · {order.doctor_name}</span></div><StatusBadge status={order.status} critical={order.critical} /></div>
        <div className="result-block"><div className="result-label"><span>TEST RESULT</span><span>REFERENCE RANGE</span></div><div className="result-values"><b>{order.parameter}<small>{order.unit}</small></b><strong className={order.critical ? 'critical-value' : ''}>{order.result} <small>{order.unit}</small></strong><span>{order.reference_range}</span></div></div>
        {order.critical ? <div className="critical-note"><CircleAlert size={17} /><span><b>Critical result — call patient.</b> A callback task is open. No automated plain-language summary is shown.</span></div> : order.summary?.en && <div className="summary-preview"><div><Activity size={16} /><b>Plain-language summary</b><span className="template-tag">DEMO · LOCKED TEMPLATE</span></div><p>{order.summary.en}</p><small>Also available in తెలుగు and हिन्दी on the patient report.</small></div>}
        <div className="info-note"><FileText size={15} /><span>{order.pdf_is_original ? 'Original LIS PDF attached; downloads use the signed source file.' : 'No LIS PDF attached; downloads use a generated demo report.'}</span></div>
        <div className="modal-meta"><span><Clock3 size={15} /> Received {fmtDate(order.created_at)} · {fmtTime(order.created_at)}</span><span><ShieldCheck size={15} /> Access events are logged</span></div>
        <footer className="modal-actions">
          {canSign && <label className="button button-outline" style={{ cursor: pdfBusy ? 'wait' : 'pointer' }}><Upload size={16} />{pdfBusy ? 'Uploading…' : order.pdf_is_original ? 'Replace LIS PDF' : 'Attach LIS PDF'}<input type="file" accept="application/pdf,.pdf" disabled={pdfBusy} hidden onChange={(event) => { const file = event.target.files?.[0]; if (file) onPdfUpload(file); event.currentTarget.value = '' }} /></label>}
          {order.status === 'ready' ? <><button className="button button-outline" onClick={onDownload}><ArrowDownToLine size={16} /> Download PDF</button><button className="button button-primary" disabled={busy} onClick={onResend}>{busy ? <LoaderCircle size={16} className="spin" /> : <Send size={16} />} Resend secure link</button></> : <>{!canSign && <button className="button button-outline" onClick={onClose}>Close</button>}{canSign ? <button className="button button-primary" disabled={busy} onClick={onSign}>{busy ? <LoaderCircle size={16} className="spin" /> : <Check size={17} />} Sign & send report</button> : <span className="delivery-pending">Pathologist sign-off required</span>}</>}
        </footer>
      </section>
    </div>
  )
}
