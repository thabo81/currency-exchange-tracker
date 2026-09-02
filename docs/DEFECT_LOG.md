# Defect Report

## 1. Defect ID & Title

**Defect ID:** CET-DEF-001

**Title:** Frontend API requests fail in production due to hardcoded `localhost` API base URL

---

## 2. Severity & Priority

| Attribute | Rating | Justification |
|---|---|---|
| **Severity** | Critical (S1) | The defect blocks all core user-facing functionality — registration, login, OTP verification, and currency conversion — in the production environment. No workaround is available to the end user. The application is effectively unusable once deployed. |
| **Priority** | P1 (Highest) | Production deployment is a release blocker. The application had already been deployed live and was inaccessible to real users, requiring immediate remediation before the release could be considered stable. |

---

## 3. Environment

| Environment | Configuration | Status |
|---|---|---|
| **Local (Development)** | `http://localhost:8000`, FastAPI dev server, SQLite | Working as expected |
| **Production (Render)** | `https://currency-exchange-tracker-app.onrender.com`, Render Web Service, Python 3.14 | **Failed** |

**Application under test:** Currency Exchange Tracker (Python 3.14 / FastAPI / SQLAlchemy / Vanilla JS frontend)

**Browser(s) tested:** Chrome (latest)

**Build/Commit:** Pre-fix commit on `main` branch, prior to relative API base URL change

---

## 4. Prerequisites

- Application successfully deployed and live on Render (`Deploy succeeded` status confirmed in Render dashboard)
- No environment variable or build-step override for the frontend's API base URL
- Tester has access to a fresh, unregistered email address for account creation
- Browser developer console open to observe network-layer errors

---

## 5. Detailed Steps to Reproduce

1. Navigate to the production URL: `https://currency-exchange-tracker-app.onrender.com`
2. Confirm the login/landing page renders correctly (page itself loads without error)
3. Click **"Register"** / **"Show Register"** to open the registration form
4. Fill in valid values for First Name, Surname, Email, Country, and Password
5. Click the **Register** submit button
6. Observe the browser response

---

## 6. Expected Result

The registration request should be sent to the application's own production backend (same origin as the page, i.e. `https://currency-exchange-tracker-app.onrender.com/register`), the account should be created, and the user should be shown a confirmation message prompting OTP verification.

---

## 7. Actual Result

The browser displayed a JavaScript alert:

```
currency-exchange-tracker-app.onrender.com says
Failed to fetch
```

Inspection of the browser's Network tab and application source confirmed the request was never sent to the production server at all — it targeted `http://localhost:8000/register`, an address unreachable from the deployed client's execution context. The identical failure pattern was present across all authenticated and data-driven routes (`/login`, `/verify-otp`, `/convert`).

---

## 8. Root Cause Analysis

The frontend JavaScript (`app/static/js/main.js`) defined a module-level constant used to build every API request URL:

```javascript
const API_BASE = "http://localhost:8000";
```

All `fetch()` calls in the file (login, register, OTP verification, currency conversion) were constructed using template literals against this constant, e.g. `` `${API_BASE}/register` ``.

This value was appropriate during local development, where the FastAPI server runs on `localhost:8000`. However, it was never parameterized or made environment-aware before deployment. When the application was served from Render's production domain, the client-side JavaScript continued attempting to reach `localhost:8000` — which, from the perspective of a user's browser, refers to their **own machine**, not the Render server. Since no service was listening on that address in the user's environment, every API call failed at the network layer before a request could even reach the backend, surfacing as a generic `Failed to fetch` error.

This is a classic **environment-configuration defect**: the backend (FastAPI/Starlette routing) was functioning correctly and was never at fault — the defect was isolated entirely to a hardcoded client-side configuration value that did not account for deployment-target variability.

**Contributing factor:** No environment-based configuration strategy (e.g., build-time variable injection, relative URLs, or a config endpoint) existed to differentiate local vs. production API targets, allowing a development-only value to ship unmodified to production.

---

## 9. Resolution / Fix Applied

The hardcoded absolute URL was replaced with a **relative API base path**, allowing all requests to resolve against the current page's own origin regardless of environment:

```javascript
// Before
const API_BASE = "http://localhost:8000";

// After
const API_BASE = "";
```

Since every existing `fetch()` call already referenced `` `${API_BASE}/<endpoint>` ``, this single-line change caused all requests to collapse to relative paths (e.g., `/register`, `/login`, `/convert`), which the browser automatically resolves against whatever host is currently serving the page — `localhost:8000` in development, and the Render production domain in production — with no further code changes required.

**Verification performed post-fix:**
- Registration, OTP verification, login, and currency conversion flows were manually re-tested end-to-end on the production URL and confirmed functioning correctly.
- Confirmed via server logs that `POST /register`, `POST /verify-otp`, `POST /login`, and `POST /convert` requests were received and processed successfully by the production backend.

**Recommended follow-up (not yet implemented):**
- Parameterize the equivalent hardcoded `http://localhost:8000` base URLs present in the Selenium Page Object Model (`pages/login_page.py`, `pages/dashboard_page.py`) so the automated UI test suite can be run against any target environment (local or production) via a configurable base URL, preventing recurrence of this defect class in future environment-specific testing.