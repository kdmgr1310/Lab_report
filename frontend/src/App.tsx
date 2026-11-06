import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import {
  Activity, ArrowDownToLine, ArrowLeft, ArrowRight, Bell, CheckCircle2, ChevronDown,
  ChevronRight, FileText, HeartPulse, LayoutDashboard, LockKeyhole, LogOut,
  Menu, MessageCircle, Send, ShieldCheck, Stethoscope, Upload, Users, X,
} from 'lucide-react'
import { EmptyState, ErrorBanner, PortalBrand, ReportView, StatusBadge } from './components/ReportComponents'
import type { Audit, CallbackTask, Delivery, Doctor, LabSettings, MetricSet, Order, Page, SummaryReview } from './model'
import { DeliveryPage, DoctorReportsPage, DoctorsPage, ImportsPage, Overview, PatientsPage, ReportModal, SummaryReviewsPage } from './pages/WorkspacePages'
import { API, request } from './services/api'
import { useAppDispatch, useAppSelector } from './store/hooks'
import { loginDemoStaff, logout, restoreAuth, verifyPatientOtp as verifyPatientOtpAction } from './store/authSlice'
import './App.css'

const fmtDate = (value: string) => new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })

type DemoStaffAccount = { id: string; displayName: string; role: 'frontdesk' | 'pathologist' | 'admin' | 'doctor' }

function App() {
  const shareToken = new URLSearchParams(window.location.search).get('share')
  const dispatch = useAppDispatch()
  const authUser = useAppSelector((state) => state.auth.user)
  const authStatus = useAppSelector((state) => state.auth.status)
  const staffRole = authUser?.role ?? 'frontdesk'
  const canImport = staffRole === 'admin' || staffRole === 'frontdesk'
  const [settings, setSettings] = useState<LabSettings>({ labName: 'Niramaya', labLocation: 'Vijayawada · Coastal Andhra', staffName: 'Front desk', staffRole: 'Front desk' })
  const [page, setPage] = useState<Page>(shareToken ? 'portal' : 'overview')
  const [orders, setOrders] = useState<Order[]>([])
  const [metrics, setMetrics] = useState<MetricSet>({ reportsToday: 0, ready: 0, processing: 0, callbackTasks: 0, deliveredToday: 0 })
  const [callbackTasks, setCallbackTasks] = useState<CallbackTask[]>([])
  const [deliveries, setDeliveries] = useState<Delivery[]>([])
  const [audits, setAudits] = useState<Audit[]>([])
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [summaryReviews, setSummaryReviews] = useState<SummaryReview[]>([])
  const [demoAccounts, setDemoAccounts] = useState<DemoStaffAccount[]>([])
  const [selectedDemoDoctorId, setSelectedDemoDoctorId] = useState('')
  const [weeklyReviews, setWeeklyReviews] = useState({ reviewed: 0, target: 50 })
  const [reviewBusy, setReviewBusy] = useState('')
  const [selectedDoctor, setSelectedDoctor] = useState<number | null>(null)
  const [doctorReports, setDoctorReports] = useState<Order[]>([])
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [search, setSearch] = useState('')
  const [toast, setToast] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [mobileMenu, setMobileMenu] = useState(false)
  const [portalOrders, setPortalOrders] = useState<Order[] | null>(null)
  const [patientMobile, setPatientMobile] = useState('')
  const [otp, setOtp] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [demoCode, setDemoCode] = useState('')
  const [shareOtp, setShareOtp] = useState('')
  const [shareSent, setShareSent] = useState(false)
  const [shareDemoCode, setShareDemoCode] = useState('')
  const [shareReport, setShareReport] = useState<Order | null>(null)
  const [deliveryTab, setDeliveryTab] = useState<'deliveries' | 'access'>('deliveries')
  const [importResult, setImportResult] = useState<{ imported: string[]; skipped: string[] } | null>(null)
  const [busyOrder, setBusyOrder] = useState('')
  const [copiedLink, setCopiedLink] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)
  const doctorAccounts = demoAccounts.filter((account) => account.role === 'doctor')

  const flash = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(''), 3500)
  }

  const refreshDashboard = useCallback(async () => {
    try {
      const [data, tasks] = await Promise.all([
        request<{ metrics: MetricSet; orders: Order[] }>('/api/dashboard'),
        request<CallbackTask[]>('/api/callback-tasks'),
      ])
      setMetrics(data.metrics)
      setOrders(data.orders)
      setCallbackTasks(tasks)
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : 'Could not load reports.')
    }
  }, [])

  const refreshSummaryReviews = useCallback(async () => {
    try {
      const data = await request<{ items: SummaryReview[]; weeklyReviewed: number; weeklyTarget: number }>('/api/pathologist/summary-reviews')
      setSummaryReviews(data.items)
      setWeeklyReviews({ reviewed: data.weeklyReviewed, target: data.weeklyTarget })
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : 'Could not load summary reviews.')
    }
  }, [])

  useEffect(() => {
    request<LabSettings>('/api/settings')
      .then(setSettings)
      .catch((issue) => setError(issue instanceof Error ? issue.message : 'Could not load workspace settings.'))
  }, [])

  useEffect(() => {
    const loadWorkspace = async () => {
      if (shareToken) return
      try {
        const user = await dispatch(restoreAuth()).unwrap()
        if (user?.role === 'patient') {
          setPage('portal')
          setPortalOrders(await request<Order[]>('/api/patient/orders'))
          return
        }
        if (user?.role === 'doctor') {
          setPage('doctors')
          setDoctorReports(await request<Order[]>('/api/doctor/reports'))
          return
        }
        if (!user) {
          if (import.meta.env.DEV) setDemoAccounts(await request<DemoStaffAccount[]>('/api/auth/demo-accounts'))
          return
        }
        if (user?.role === 'admin' || user?.role === 'pathologist') await refreshSummaryReviews()
        await refreshDashboard()
      } catch (issue) {
        setError(issue instanceof Error ? issue.message : 'Could not open the staff workspace.')
      }
    }
    void loadWorkspace()
  }, [dispatch, refreshDashboard, refreshSummaryReviews, shareToken])

  useEffect(() => {
    if (page === 'delivery') {
      Promise.all([request<Delivery[]>('/api/delivery-report'), request<Audit[]>('/api/audit')])
        .then(([deliveryData, auditData]) => { setDeliveries(deliveryData); setAudits(auditData) })
        .catch((issue) => setError(issue instanceof Error ? issue.message : 'Could not load delivery report.'))
    }
    if (page === 'doctors' && authUser?.role !== 'doctor') {
      request<Doctor[]>('/api/doctors').then((items) => {
        setDoctors(items)
        if (selectedDoctor === null && items.length) setSelectedDoctor(items[0].id)
      }).catch((issue) => setError(issue instanceof Error ? issue.message : 'Could not load doctors.'))
    }
  }, [authUser?.role, page, selectedDoctor])

  useEffect(() => {
    if (page === 'doctors' && authUser?.role !== 'doctor' && selectedDoctor !== null) {
      request<Order[]>(`/api/doctors/${selectedDoctor}/reports`)
        .then(setDoctorReports)
        .catch((issue) => setError(issue instanceof Error ? issue.message : 'Could not load doctor reports.'))
    }
  }, [authUser?.role, page, selectedDoctor])

  const filteredOrders = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return orders
    return orders.filter((order) => [order.id, order.patient_name, order.parameter, order.doctor_name].join(' ').toLowerCase().includes(query))
  }, [orders, search])

  const openReport = (order: Order) => {
    setSelectedOrder(order)
    setError('')
  }

  const resend = async (order: Order) => {
    setBusyOrder(order.id)
    setError('')
    try {
      const result = await request<{ link: string; expiresAt: string }>('/api/orders/' + encodeURIComponent(order.id) + '/resend', { method: 'POST' })
      await navigator.clipboard?.writeText(result.link).catch(() => undefined)
      setCopiedLink(order.id)
      flash('Secure link resent. A copy is ready to share.')
      await refreshDashboard()
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : 'Could not resend this link.')
    } finally {
      setBusyOrder('')
    }
  }

  const signReport = async (order: Order) => {
    setBusyOrder(order.id)
    setError('')
    try {
      const result = await request<{ critical: boolean }>('/api/orders/' + encodeURIComponent(order.id) + '/sign', { method: 'POST' })
      flash(result.critical ? 'Signed. Critical callback task created; summary withheld.' : 'Report signed and secure link sent.')
      setSelectedOrder(null)
      await refreshDashboard()
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : 'Could not sign report.')
    } finally {
      setBusyOrder('')
    }
  }

  const uploadReportPdf = async (file: File) => {
    if (!selectedOrder) return
    if (file.size > 10 * 1024 * 1024) {
      setError('PDF must be 10 MB or smaller.')
      return
    }
    const orderId = selectedOrder.id
    setBusyOrder(orderId)
    setError('')
    try {
      const response = await fetch(`${API}/api/orders/${encodeURIComponent(orderId)}/pdf`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/pdf', 'X-File-Name': encodeURIComponent(file.name) },
        body: file,
      })
      if (!response.ok) {
        const body = await response.json().catch(() => ({ error: 'Could not upload the LIS PDF.' }))
        throw new Error(body.error ?? 'Could not upload the LIS PDF.')
      }
      setSelectedOrder((current) => current?.id === orderId ? { ...current, pdf_is_original: 1 } : current)
      setOrders((current) => current.map((order) => order.id === orderId ? { ...order, pdf_is_original: 1 } : order))
      flash('Original LIS PDF attached to the report.')
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : 'Could not upload the LIS PDF.')
    } finally {
      setBusyOrder('')
    }
  }

  const completeSummaryReview = async (orderId: string) => {
    setReviewBusy(orderId)
    setError('')
    try {
      await request(`/api/pathologist/summary-reviews/${encodeURIComponent(orderId)}/review`, { method: 'POST' })
      flash('Summary marked as reviewed.')
      await refreshSummaryReviews()
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : 'Could not complete the review.')
    } finally {
      setReviewBusy('')
    }
  }

  const completeCallback = async (orderId: string) => {
    setError('')
    try {
      await request(`/api/callback-tasks/${encodeURIComponent(orderId)}/complete`, { method: 'POST' })
      flash('Callback task completed.')
      await refreshDashboard()
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : 'Could not complete the callback task.')
    }
  }

  const downloadPdf = async (path: string, fileName: string) => {
    setError('')
    try {
      const response = await fetch(`${API}${path}`, { credentials: 'include' })
      if (!response.ok) {
        const body = await response.json().catch(() => ({ error: 'Could not download report.' }))
        throw new Error(body.error)
      }
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = fileName
      anchor.click()
      URL.revokeObjectURL(url)
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : 'Could not download report.')
    }
  }

  const requestPatientOtp = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      const result = await request<{ demoCode?: string }>('/api/auth/request-otp', {
        method: 'POST', body: JSON.stringify({ mobile: patientMobile }),
      })
      setOtpSent(true)
      setDemoCode(result.demoCode ?? '')
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : 'Could not send code.')
    } finally {
      setLoading(false)
    }
  }

  const verifyPatientOtp = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      await dispatch(verifyPatientOtpAction({ mobile: patientMobile, code: otp })).unwrap()
      const patientData = await request<Order[]>('/api/patient/orders')
      setPortalOrders(patientData)
      setOtpSent(false)
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : 'Could not verify code.')
    } finally {
      setLoading(false)
    }
  }

  const requestShareOtp = async () => {
    if (!shareToken) return
    setError('')
    setLoading(true)
    try {
      const result = await request<{ demoCode?: string }>(`/api/share/${encodeURIComponent(shareToken)}/otp`, { method: 'POST' })
      setShareSent(true)
      setShareDemoCode(result.demoCode ?? '')
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : 'Could not send code.')
    } finally {
      setLoading(false)
    }
  }

  const verifyShareOtp = async (event: FormEvent) => {
    event.preventDefault()
    if (!shareToken) return
    setError('')
    setLoading(true)
    try {
      await request(`/api/share/${encodeURIComponent(shareToken)}/verify`, { method: 'POST', body: JSON.stringify({ code: shareOtp }) })
      const report = await request<Order>(`/api/share/${encodeURIComponent(shareToken)}/report`)
      setShareReport(report)
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : 'Could not verify code.')
    } finally {
      setLoading(false)
    }
  }

  const choosePage = (nextPage: Page) => {
    setPage(nextPage)
    setMobileMenu(false)
    setError('')
    if (nextPage === 'reviews') void refreshSummaryReviews()
    if (nextPage === 'portal') {
      setShareReport(null)
      setShareSent(false)
      setPortalOrders(null)
      setOtpSent(false)
      if (shareToken) window.history.replaceState({}, '', window.location.pathname)
    }
  }

  const uploadCsv = async (file?: File) => {
    if (!file) return
    setError('')
    setLoading(true)
    setImportResult(null)
    try {
      const csv = await file.text()
      const result = await request<{ imported: string[]; skipped: string[] }>('/api/import', {
        method: 'POST', body: JSON.stringify({ csv }),
      })
      setImportResult(result)
      flash(`${result.imported.length} report${result.imported.length === 1 ? '' : 's'} imported.`)
      await refreshDashboard()
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : 'Could not import CSV.')
    } finally {
      setLoading(false)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  const markSummary = async (orderId: string) => {
    try {
      await request(`/api/orders/${encodeURIComponent(orderId)}/flag-summary`, { method: 'POST' })
      flash('Thanks. The summary was flagged for review.')
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : 'Could not send feedback.')
    }
  }

  const signOutPatient = async () => {
    setError('')
    try {
      await dispatch(logout()).unwrap()
      setPortalOrders(null)
      setSelectedOrder(null)
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : 'Could not sign out.')
    }
  }

  const signInDemoStaff = async (accountId: string) => {
    setError('')
    try {
      const user = await dispatch(loginDemoStaff(accountId)).unwrap()
      if (user.role === 'doctor') {
        setPage('doctors')
        setDoctorReports(await request<Order[]>('/api/doctor/reports'))
        return
      }
      setPage(user.role === 'pathologist' ? 'reviews' : 'overview')
      await refreshDashboard()
      if (user.role === 'admin' || user.role === 'pathologist') await refreshSummaryReviews()
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : 'Could not sign in.')
    }
  }

  const signOutStaff = async () => {
    setError('')
    try {
      await dispatch(logout()).unwrap()
      setPage('overview')
      setOrders([])
      setSelectedOrder(null)
      if (import.meta.env.DEV) setDemoAccounts(await request<DemoStaffAccount[]>('/api/auth/demo-accounts'))
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : 'Could not sign out.')
    }
  }

  if (shareToken) {
    return (
      <main className="share-shell">
        <PortalBrand labName={settings.labName} />
        <section className="share-card">
          {!shareReport ? (
            <>
              <div className="share-icon"><LockKeyhole size={23} /></div>
              <p className="eyebrow">PRIVATE REPORT LINK</p>
              <h1>One quick security check</h1>
              <p className="muted share-copy">We’ll send a one-time code to the mobile number linked to this report. Your report stays private.</p>
              {error && <ErrorBanner message={error} />}
              {!shareSent ? (
                <button className="button button-primary full-button" onClick={() => void requestShareOtp()}>
                  <MessageCircle size={17} /> Send code to registered mobile
                </button>
              ) : (
                <form onSubmit={verifyShareOtp} className="form-stack">
                  <label htmlFor="share-otp">Enter the 6-digit code</label>
                  <input id="share-otp" className="input otp-input" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={shareOtp} onChange={(event) => setShareOtp(event.target.value)} />
                  {shareDemoCode && <small className="demo-hint">Demo SMS code: <b>{shareDemoCode}</b></small>}
                  <button className="button button-primary full-button" disabled={loading || shareOtp.length < 6}>{loading ? 'Checking…' : 'Open my report'}</button>
                </form>
              )}
              {error && !shareReport && null}
            </>
          ) : (
            <ReportView order={shareReport} labName={settings.labName} onDownload={() => void downloadPdf(`/api/share/${encodeURIComponent(shareToken)}/pdf`, `${shareReport.id}.pdf`)} onFlag={() => {
              void request(`/api/share/${encodeURIComponent(shareToken)}/flag-summary`, { method: 'POST' })
                .then(() => flash('Thanks. The summary was flagged for review.'))
                .catch((issue) => setError(issue instanceof Error ? issue.message : 'Could not send feedback.'))
            }} />
          )}
        </section>
        <p className="share-foot"><ShieldCheck size={14} /> This secure link expires 72 hours after it was sent.</p>
      </main>
    )
  }

  if (page === 'portal') {
    return (
      <main className="portal-shell">
        <PortalBrand onBack={() => choosePage('overview')} labName={settings.labName} />
        <section className="portal-card">
          {!portalOrders ? (
            <>
              <div className="share-icon"><HeartPulse size={23} /></div>
              <p className="eyebrow">PATIENT PORTAL</p>
              <h1>{otpSent ? 'Enter your security code' : 'Your reports, in one place'}</h1>
              <p className="muted share-copy">{otpSent ? `A one-time code was sent to ${patientMobile}.` : 'Sign in with the mobile number registered at the lab.'}</p>
              {error && <ErrorBanner message={error} />}
              {!otpSent ? (
                <form onSubmit={requestPatientOtp} className="form-stack">
                  <label htmlFor="mobile">Mobile number</label>
                  <input id="mobile" className="input" type="tel" placeholder="+91 98765 43210" autoComplete="tel" value={patientMobile} onChange={(event) => setPatientMobile(event.target.value)} required />
                  <button className="button button-primary full-button" disabled={loading}>{loading ? 'Sending…' : 'Send one-time code'}</button>
                  <small className="demo-hint">Demo patient: +91 98765 43210</small>
                </form>
              ) : (
                <form onSubmit={verifyPatientOtp} className="form-stack">
                  <label htmlFor="patient-otp">6-digit code</label>
                  <input id="patient-otp" className="input otp-input" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={otp} onChange={(event) => setOtp(event.target.value)} />
                  {demoCode && <small className="demo-hint">Demo SMS code: <b>{demoCode}</b></small>}
                  <button className="button button-primary full-button" disabled={loading || otp.length < 6}>{loading ? 'Checking…' : 'View my reports'}</button>
                  <button className="text-button" type="button" onClick={() => setOtpSent(false)}>Use a different number</button>
                </form>
              )}
            </>
          ) : (
            <PatientReports
              orders={portalOrders}
              onDownload={(order) => void downloadPdf(`/api/patient/orders/${encodeURIComponent(order.id)}/pdf`, `${order.id}.pdf`)}
              onOpen={async (order) => {
                try { setSelectedOrder(await request<Order>(`/api/patient/orders/${encodeURIComponent(order.id)}`)) }
                catch (issue) { setError(issue instanceof Error ? issue.message : 'Could not open report.') }
              }}
              selected={selectedOrder}
              labName={settings.labName}
              onBack={() => setSelectedOrder(null)}
              onFlag={markSummary}
              onLogout={() => void signOutPatient()}
              error={error}
            />
          )}
        </section>
        <p className="share-foot"><ShieldCheck size={14} /> Your health information is private and protected.</p>
      </main>
    )
  }

  if (authStatus === 'checking') {
    return (
      <main className="portal-shell">
        <PortalBrand labName={settings.labName} />
        <section className="portal-card"><p className="muted">Checking your sign-in…</p></section>
      </main>
    )
  }

  if (!authUser || authUser.role === 'patient') {
    return (
      <main className="portal-shell">
        <PortalBrand labName={settings.labName} />
        <section className="portal-card">
          <div className="share-icon"><ShieldCheck size={23} /></div>
          <p className="eyebrow">STAFF WORKSPACE</p>
          <h1>Sign in to your workspace</h1>
          {error && <ErrorBanner message={error} />}
          {import.meta.env.DEV ? (
            <div className="form-stack">
              <p className="muted share-copy">Choose a seeded demo account. Its role is loaded from the database; access is enforced by the API.</p>
              {demoAccounts.filter((account) => account.role !== 'doctor').map((account) => (
                <button key={account.id} className={account.role === 'frontdesk' ? 'button button-primary full-button' : 'button button-outline full-button'} onClick={() => void signInDemoStaff(account.id)}>
                  {account.role === 'pathologist' ? <Stethoscope size={17} /> : account.role === 'admin' ? <ShieldCheck size={17} /> : <Users size={17} />}
                  Continue as {account.role === 'frontdesk' ? 'front desk' : account.role}
                </button>
              ))}
              {doctorAccounts.length > 0 && (
                <>
                  <label htmlFor="demo-doctor">Doctor account</label>
                  <select
                    id="demo-doctor"
                    className="input"
                    value={doctorAccounts.some((account) => account.id === selectedDemoDoctorId) ? selectedDemoDoctorId : doctorAccounts[0].id}
                    onChange={(event) => setSelectedDemoDoctorId(event.target.value)}
                  >
                    {doctorAccounts.map((account) => <option key={account.id} value={account.id}>{account.displayName}</option>)}
                  </select>
                  <button
                    className="button button-outline full-button"
                    disabled={!doctorAccounts.length}
                    onClick={() => void signInDemoStaff(doctorAccounts.find((account) => account.id === selectedDemoDoctorId)?.id ?? doctorAccounts[0].id)}
                  >
                    <Stethoscope size={17} /> Continue as doctor
                  </button>
                </>
              )}
              {!demoAccounts.length && <p className="muted">No active demo staff accounts are configured.</p>}
              <small className="demo-hint">Demo accounts only. Production staff sign-in must use verified credentials.</small>
              <button className="text-button" onClick={() => choosePage('portal')}>Patient? Sign in with mobile OTP</button>
            </div>
          ) : (
            <div className="form-stack">
              <p className="muted share-copy">Staff sign-in is not configured for this deployment. Patients can still use OTP sign-in.</p>
              <button className="button button-primary full-button" onClick={() => choosePage('portal')}>Patient sign-in</button>
            </div>
          )}
        </section>
        <p className="share-foot"><ShieldCheck size={14} /> Your access is determined by your account and checked by the server.</p>
      </main>
    )
  }

  if (authUser.role === 'doctor') {
    return (
      <main className="portal-shell">
        <PortalBrand labName={settings.labName} />
        <section className="portal-card">
          <div className="portal-list-head"><div className="share-icon"><Stethoscope size={21} /></div><p className="eyebrow">REFERRING CLINICIAN</p><h1>{authUser.displayName}</h1><p className="muted">Authorized patient reports from the last 90 days.</p></div>
          {error && <ErrorBanner message={error} />}
          <DoctorReportsPage
            reports={doctorReports}
            onDownload={(order) => void downloadPdf(`/api/doctor/orders/${encodeURIComponent(order.id)}/pdf`, `${order.id}.pdf`)}
          />
          <button className="text-button portal-logout" onClick={() => void signOutStaff()}><LogOut size={15} /> Sign out</button>
        </section>
      </main>
    )
  }

  return (
    <div className="app-shell">
      {mobileMenu && <button className="mobile-backdrop" aria-label="Close menu" onClick={() => setMobileMenu(false)} />}
      <aside className={`sidebar ${mobileMenu ? 'sidebar-open' : ''}`}>
        <div className="brand-lockup">
          <div className="brand-mark"><Activity size={21} strokeWidth={2.4} /></div>
          <div><strong>{settings.labName}</strong><span>LAB SERVICES</span></div>
          <button className="icon-button mobile-close" aria-label="Close menu" onClick={() => setMobileMenu(false)}><X size={19} /></button>
        </div>
        <div className="workspace-select">
          <div className="workspace-avatar">V</div>
          <div className="workspace-text"><b>{settings.labName}</b><span>{settings.labLocation}</span></div>
          <ChevronDown size={15} className="workspace-chevron" />
        </div>
        <p className="nav-label">WORKSPACE</p>
        <nav className="primary-nav" aria-label="Main navigation">
          <NavButton icon={<LayoutDashboard size={18} />} active={page === 'overview'} label="Overview" onClick={() => choosePage('overview')} />
          <NavButton icon={<Users size={18} />} active={page === 'patients'} label="Patients & reports" count={orders.length} onClick={() => choosePage('patients')} />
          {canImport && <NavButton icon={<Upload size={18} />} active={page === 'imports'} label="LIS imports" onClick={() => choosePage('imports')} />}
          <NavButton icon={<Send size={18} />} active={page === 'delivery'} label="Delivery & access" onClick={() => choosePage('delivery')} />
          <NavButton icon={<Stethoscope size={18} />} active={page === 'doctors'} label="Doctor access" onClick={() => choosePage('doctors')} />
          {(staffRole === 'admin' || staffRole === 'pathologist') && <NavButton icon={<FileText size={18} />} active={page === 'reviews'} label="Summary review" count={summaryReviews.length} onClick={() => choosePage('reviews')} />}
        </nav>
        <div className="sidebar-bottom">
          <div className="side-security"><ShieldCheck size={17} /><div><b>Private by design</b><span>Access is logged and secure</span></div></div>
          <div className="profile-row"><div className="profile-avatar">{(authUser.displayName || settings.staffName).split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase()}</div><div className="profile-name"><b>{authUser.displayName || settings.staffName}</b><span>{staffRole}</span></div><button className="icon-button" aria-label="Sign out" title="Sign out" onClick={() => void signOutStaff()}><LogOut size={17} /></button></div>
        </div>
      </aside>

      <div className="main-column">
        <header className="topbar">
          <button className="icon-button menu-button" aria-label="Open menu" onClick={() => setMobileMenu(true)}><Menu size={20} /></button>
          <div className="breadcrumb"><span>Workspace</span><ChevronRight size={14} /><b>{pageTitle(page)}</b></div>
          <div className="topbar-actions">
            <div className="online-indicator"><span /> All systems operational</div>
            <button className="icon-button alert-button" aria-label={`${metrics.callbackTasks} callback tasks`} onClick={() => choosePage('overview')}><Bell size={18} />{metrics.callbackTasks > 0 && <i />}</button>
            <div className="top-avatar">{settings.staffName.split(/\s+/).map((part) => part[0]).slice(0, 2).join('').toUpperCase()}</div>
          </div>
        </header>
        <main className="page-content">
          {error && <ErrorBanner message={error} onClose={() => setError('')} />}
          {page === 'overview' && (
            <Overview
              metrics={metrics}
              callbackTasks={callbackTasks}
              orders={orders.slice(0, 5)}
              staffName={authUser.displayName || settings.staffName}
              canImport={canImport}
              onViewAll={() => choosePage('patients')}
              onOpen={openReport}
              onPortal={() => choosePage('portal')}
              onImports={() => choosePage('imports')}
              onCompleteCallback={(id) => void completeCallback(id)}
            />
          )}
          {page === 'patients' && (
            <PatientsPage
              orders={filteredOrders}
              search={search}
              onSearch={setSearch}
              onOpen={openReport}
              onResend={resend}
              onPortal={() => choosePage('portal')}
              busyOrder={busyOrder}
              copiedLink={copiedLink}
            />
          )}
          {page === 'imports' && (
            <ImportsPage fileInput={fileInput} onFile={(file) => void uploadCsv(file)} loading={loading} result={importResult} onClear={() => setImportResult(null)} />
          )}
          {page === 'delivery' && (
            <DeliveryPage
              deliveries={deliveries}
              audits={audits}
              tab={deliveryTab}
              onTab={setDeliveryTab}
              metrics={metrics}
            />
          )}
          {page === 'doctors' && (
            <DoctorsPage doctors={doctors} selected={selectedDoctor} onSelect={setSelectedDoctor} reports={doctorReports} onOpen={openReport} />
          )}
          {page === 'reviews' && (staffRole === 'admin' || staffRole === 'pathologist') && (
            <SummaryReviewsPage items={summaryReviews} weeklyReviewed={weeklyReviews.reviewed} weeklyTarget={weeklyReviews.target} busyOrder={reviewBusy} onReview={(id) => void completeSummaryReview(id)} />
          )}
        </main>
      </div>
      {selectedOrder && <ReportModal order={selectedOrder} canSign={staffRole === 'admin' || staffRole === 'pathologist'} onClose={() => setSelectedOrder(null)} onSign={() => void signReport(selectedOrder)} onResend={() => void resend(selectedOrder)} busy={busyOrder === selectedOrder.id} onDownload={() => void downloadPdf(`/api/staff/orders/${encodeURIComponent(selectedOrder.id)}/pdf`, `${selectedOrder.id}.pdf`)} onPdfUpload={(file) => void uploadReportPdf(file)} pdfBusy={busyOrder === selectedOrder.id} />}
      {toast && <div className="toast"><CheckCircle2 size={18} />{toast}<button aria-label="Dismiss" onClick={() => setToast('')}><X size={16} /></button></div>}
    </div>
  )
}

function pageTitle(page: Page) {
  return ({ overview: 'Overview', patients: 'Patients & reports', imports: 'LIS imports', delivery: 'Delivery & access', doctors: 'Doctor access', reviews: 'Summary review', portal: 'Patient portal' })[page]
}

function NavButton({ icon, active, label, count, onClick }: { icon: ReactNode; active: boolean; label: string; count?: number; onClick: () => void }) {
  return <button className={`nav-item ${active ? 'nav-active' : ''}`} onClick={onClick}>{icon}<span>{label}</span>{count !== undefined && <small>{count}</small>}</button>
}

function PatientReports({ orders, onDownload, onOpen, selected, labName, onBack, onFlag, onLogout, error }: {
  orders: Order[]; onDownload: (order: Order) => void; onOpen: (order: Order) => void; selected: Order | null; labName: string; onBack: () => void; onFlag: (id: string) => void; onLogout: () => void; error: string
}) {
  if (selected) return <div className="portal-reports"><button className="text-button back-reports" onClick={onBack}><ArrowLeft size={15} /> All reports</button>{error && <ErrorBanner message={error} />}<ReportView order={selected} labName={labName} onDownload={() => onDownload(selected)} onFlag={() => onFlag(selected.id)} /></div>
  return (
    <div className="portal-reports">
      <div className="portal-list-head"><div className="share-icon"><FileText size={21} /></div><p className="eyebrow">YOUR HEALTH RECORD</p><h1>Your reports</h1><p className="muted">Reports linked to your mobile number.</p></div>
      {error && <ErrorBanner message={error} />}
      {orders.length ? <div className="portal-order-list">{orders.map((order) => <article className="portal-order-card" key={order.id}>
        <div className="portal-order-top"><span>{fmtDate(order.created_at)} · {order.id}</span><StatusBadge status={order.status} critical={order.critical} /></div>
        <h2>{order.parameter}</h2><p>{order.patient_name}</p>
        <div className="portal-order-actions"><button className="button button-primary" disabled={order.status !== 'ready'} onClick={() => onOpen(order)}>{order.status === 'ready' ? 'Open report' : 'Still processing'} <ArrowRight size={16} /></button>{order.status === 'ready' && <button className="icon-button" aria-label="Download PDF" onClick={() => onDownload(order)}><ArrowDownToLine size={17} /></button>}</div>
      </article>)}</div> : <EmptyState title="No reports found" text="Reports for your mobile number will appear here after sign-off." />}
      <button className="text-button portal-logout" onClick={() => void onLogout()}><LogOut size={15} /> Sign out</button>
    </div>
  )
}

export default App
