# Niramaya report portal

Separate React frontend and Express/SQLite API for the lab-report workflow.

## Run locally

```sh
npm install
npm run dev
```

The frontend is served at `http://localhost:5173`; the API listens on `http://localhost:4000`. The first API start creates the SQLite database under `backend/data/` and seeds the sample reports if the database is empty.

Demo patient sign-in uses `+91 98765 43210`. In development, the generated OTP is shown in the app after requesting it; the same flow is used to verify an expiring report link. OTP and WhatsApp delivery are mocked and do not send real messages. Do not use real patient information in this demo.

## Project layout

- `frontend/src/model.ts` — frontend domain and API response types.
- `frontend/src/components/ReportComponents.tsx` — shared report, status, and empty/error-state components.
- `frontend/src/pages/WorkspacePages.tsx` — overview, patient/report, import, delivery, doctor, and report-detail screens.
- `frontend/src/App.tsx` — app shell, navigation, patient portal, and shared UI state.
- `frontend/src/store/authSlice.ts` — Redux Toolkit auth state for the current UI session; it does not enforce permissions.
- `frontend/src/store/index.ts` — Redux store setup and shared state types.
- `frontend/src/services/api.ts` — cookie-backed API request helper.
- `backend/src/index.ts` — API server, middleware, and startup.
- `backend/src/routes.ts` — route entry point and report-delivery initialization.
- `backend/src/routes/` — public, auth, patient, doctor, and staff route groups.
- `backend/src/middleware/roles.ts` — role and patient-session guards.
- `backend/src/controllers/` — async HTTP handlers by feature.
- `backend/src/controllers/orderController.ts` — sign and resend request controllers.
- `backend/src/services/reportService.ts` — report signing, delivery, summary, and audit business logic.
- `backend/src/services/summaryService.ts` — rule-based range checks and safe multilingual template summaries.
- `backend/src/controllers/summaryReviewController.ts` — pathologist review queue and review tracking.
- `backend/src/model.ts` — database-backed report model and query.
- `backend/src/db.ts` — SQLite connection and schema, including roles, staff users, and doctor–patient access.
- `backend/src/seed.ts` — demo records plus startup provisioning/backfill for role and doctor-access data.
- `backend/src/config.ts` — lab and staff display settings.

Routes are registered from role-specific modules under `backend/src/routes/`; async request handlers live in controllers, and report business logic lives in services. Doctor report queries are scoped to active doctor–patient access records. Existing order-to-doctor relationships are backfilled at startup, and new LIS imports create access records for the referring doctor.

The frontend uses Redux Toolkit only to reflect the current authenticated session for UI behavior. The API session is restored through `GET /api/auth/session`, while role and resource authorization remain enforced by backend middleware and handlers. Redux state is not persisted in browser storage and is never trusted by the API.

The demo can attach an original LIS PDF to an order from its report details. PDFs are stored in the private SQLite database, access-controlled by the API, and downloaded unchanged instead of the generated demo PDF when attached. Uploads are limited to 10 MB. Without an attachment, the generated PDF is clearly a demo artifact and includes the English, Telugu, and Hindi plain-language summary when one is available. Telugu and Devanagari fonts are embedded in generated PDFs; macOS fonts are detected automatically. Other deployments should provide compatible font files with `PDF_FONT_TELUGU` and `PDF_FONT_HINDI` (and, for font collections, optional `PDF_FONT_TELUGU_FAMILY` and `PDF_FONT_HINDI_FAMILY`).

Out-of-range detection uses numeric results and reference ranges. Critical results suppress the summary and create callback tasks. Eligible abnormal results for the 30 supported common test names receive a locked, non-diagnostic summary in English, Telugu, and Hindi, and enter the pathologist review queue. Patients can flag a summary; flagged items move to the top of the queue. The app tracks the pathologist's weekly target of 50 reviews. The assignment's outside AI service is mocked: this implementation does not send health data to an external AI or claim to generate real AI summaries.

To demo a different role, sign out of the staff workspace and choose the matching seeded demo account on the sign-in screen. No code or environment variable changes are needed.

In development, staff start at a sign-in screen and choose from active demo accounts loaded from the database. Demo accounts for front desk, pathologist, admin, and each seeded referring doctor are marked with `is_demo`. `POST /api/auth/demo-staff` accepts an account ID only when it matches an active demo account; the server loads that account's role from the database, stores it in the session, and backend middleware enforces permissions. Front desk/admin can import, while signing and summary review require pathologist/admin. Doctor sessions are linked to a clinician profile and limited to that doctor's active patient access records from the last 90 days. The demo login is disabled in production; real deployments must integrate trusted staff/doctor authentication, provision roles administratively, and must not treat the demo route as production authorization.

CSV imports accept the LIS columns shown in the import screen, including `Patient Mobile`, `Report Signed At`, and a recorded `Consent` value for new patient accounts. Import is row-by-row: existing database order IDs and repeated IDs within the same CSV are skipped with distinct reasons, while other valid rows in that file can still import. Rows marked Ready trigger a mock report-link delivery; Processing rows wait for staff sign-off and Cancelled rows cannot be signed.

## Configuration

Set these environment variables before starting the API to customize the demo:

| Variable | Default |
| --- | --- |
| `LAB_NAME` | `Niramaya Lab Services` |
| `LAB_LOCATION` | `Vijayawada · Coastal Andhra` |
| `STAFF_DISPLAY_NAME` | `Front desk` |
| `STAFF_ROLE` | `Front desk` |
| `STAFF_ID` | `demo-frontdesk` |
| `STAFF_ROLE_CODE` | `frontdesk` for the legacy configured staff account; demo role selection uses seeded accounts |
| `STAFF_DOCTOR_ID` | Empty; set to a doctor record ID when using the `doctor` demo role |
| `DATABASE_PATH` | `backend/data/swasthya.sqlite` |
| `PORT` | `4000` |
| `FRONTEND_ORIGIN` | `http://localhost:5173` |
| `SESSION_SECRET` | Local demo-only fallback |

This is a local prototype, not a production-ready health-data system. It does not connect to a real AI service, SMS/WhatsApp provider, or LIS folder watcher: CSV upload, locked multilingual summary templates, demo OTP display, and delivery status are implemented locally. Before deployment, integrate production OTP/messaging and session storage, configure a strong session secret, apply role-based staff/doctor authentication, and deploy the database and application in the required region with appropriate operational controls.
