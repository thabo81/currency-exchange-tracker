## Testing See [TEST_PLAN.md](docs/TEST_PLAN.md) for the full test strategy, scope, and test cases.

# Test Plan — Currency Exchange Tracker
**Test Plan ID:** CET-TP-01
**Prepared by:** Thabo Addy Mahlangu
**Application under test:** Currency Exchange Tracker (FastAPI backend + Jinja2/vanilla JS frontend)
**Version:** Post-verification-code & feature-integration release

---

## How to use this document (a quick ISTQB-style orientation)

This test plan follows the same shape as the IEEE 829 / ISTQB CTFL syllabus structure —
Scope → Approach → Environment → Criteria → Schedule → Risks. Every real test plan you
write in a job will roughly follow this skeleton, even if company templates rename a
few sections. The value of writing one isn't the document itself — it's that writing it
forces you to think through *what* you're testing, *how*, *where*, and *when you'd stop*,
before you write a single test case. Treat each section below as a rehearsal for that
thinking process, not just a fill-in-the-blanks form.

---

## 1. Introduction

This plan covers testing of all current features of the Currency Exchange Tracker
following the recent integration of Favorites, Portfolio, Alerts, Conversion History,
Rate Trends, and the timed in-app email verification flow (replacing the original
OTP flow). The goal is to validate functional correctness, catch regressions introduced
during integration, and establish a baseline for API and basic performance behavior.

## 2. Scope

### In Scope
- User registration and the 30-second timed email verification flow (code generation,
  expiry, resend limiting)
- Login, JWT access token issuance, "Remember me" checkbox behavior
- Currency conversion (`/convert`), live/cached rate fetching (`/rates`)
- Favorites (add/remove/list, star toggle)
- Portfolio (add/remove/list holdings)
- Alerts (add/remove/list, target rate direction logic)
- Conversion history (`/history/recent`)
- Rate trend history (`/trends/{base}/{quote}`) and the background polling job
- Currency dropdown content (expanded list added recently)
- Basic API-level performance/load behavior under moderate concurrent load

### Out of Scope
- Actual alert-triggered email notifications (not yet implemented — alerts are stored
  but nothing currently checks them against live rates and fires a notification)
- Penetration testing / advanced security testing (only basic authorization checks are
  included — see Section 4)
- Load testing at production-representative scale (this plan targets learning-level
  load testing, not capacity planning for real traffic)
- Payment processing (not a feature of this app)

## 3. Test Items

| Item | Description |
|---|---|
| `/register`, `/verify-code`, `/resend-code` | Timed email verification flow |
| `/login`, `/refresh-token` | Auth and token issuance |
| `/convert`, `/rates` | Currency conversion |
| `/favorites` (GET/POST/DELETE) | Favorite currency pairs |
| `/portfolio` (GET/POST/DELETE) | Portfolio holdings |
| `/alerts` (GET/POST/DELETE) | Rate alerts |
| `/history/recent` | Conversion history |
| `/trends/{base}/{quote}` | Rate trend data |
| `rate_history_job` (background scheduler) | Populates trend data every 15 min |
| Dashboard UI (`dashboard.html` + `main.js`) | All dashboard interactions |
| Login/Register UI (`login.html` + `main.js`) | Auth flows, verification modal |

## 4. Test Approach

**Functional testing** — Every endpoint and UI flow gets at least one happy-path test
and, where input validation exists, EP/BVA-based negative tests (you already have a
template for this style from the earlier conversion test cases — reuse that pattern
here for `/register`, `/convert`, `/portfolio`, `/alerts`).

**API testing** — Use curl, Postman, or a quick Python `requests` script to call each
endpoint directly, independent of the UI. This is what actually proves the backend is
correct versus the frontend just hiding backend bugs (or vice versa — you saw this
happen already with the missing `</select>` tag masking working backend endpoints).

**UI / manual exploratory testing** — Click through every dashboard feature by hand,
including edge interactions the automated/API tests won't cover: rapid double-clicking
Convert, switching currency pairs quickly while a request is in flight, resizing the
browser to the mobile breakpoint (`@media max-width: 820px`), and navigating between
panels repeatedly.

**Basic performance/load testing (JMeter)** — Build a simple Thread Group in JMeter
hitting `/convert` and `/rates` with, say, 20-50 concurrent simulated users for a few
minutes. You're not trying to find a breaking point at this stage — you're learning to
read JMeter's response-time and error-rate graphs, and getting a baseline of how the
app behaves under mild concurrent load. A good first goal: confirm response times stay
reasonably flat as concurrent users increase, rather than degrading sharply.

**Basic authorization checks** — Since Favorites/Portfolio/Alerts/History are scoped to
`user.user_id` server-side, verify that User A's token can never see or modify User B's
data by manually swapping tokens between two test accounts.

## 5. Entry Criteria
- Latest code is deployed to Render and the build succeeds (check deploy logs)
- Local dev environment starts cleanly (`python -c "import app.main"` succeeds)
- turboSMTP environment variables are set (or the local fallback console-print path is
  acceptable for that test session)
- At least two test user accounts exist (for authorization cross-checks)

## 6. Exit Criteria
- All High-priority test cases in Section 8 have been executed
- No open High-severity defects remain unresolved (Medium/Low may be logged and
  deferred with justification)
- API and UI results match for every feature (no silent frontend-only or
  backend-only failures)
- A basic JMeter run has been completed and results recorded, even if just as a baseline

## 7. Pass/Fail Criteria
A test case **passes** when actual result matches expected result exactly, including
correct HTTP status codes on the API layer. A test case **fails** if: the result is
wrong, an unhandled exception/500 occurs, or the UI silently does nothing where an
error or success message was expected.

## 8. Test Cases by Feature (representative — expand each row into full test cases
as you execute)

| ID | Feature | Test Case | Type | Priority |
|---|---|---|---|---|
| TC-A01 | Registration | Register with valid data → challenge email sent, modal shows 30s countdown | Functional/UI | High |
| TC-A02 | Verification | Enter correct code within 30s → account verified, `is_verified=True` | Functional/API | High |
| TC-A03 | Verification | Let timer hit 0 → inputs disable, error shown, code no longer accepted | Functional/UI | High |
| TC-A04 | Verification | Click Resend before expiry → new code sent, timer resets to 30 | Functional/API | High |
| TC-A05 | Verification | Resend 4 times → 4th attempt returns 429, UI disables resend button | Functional/API/BVA | High |
| TC-A06 | Verification | Submit code AFTER 30s expiry → 400 returned, old code rejected even if typed correctly | Functional/API | High |
| TC-A07 | Login | Valid credentials, unverified account → 403 returned | Functional/API | High |
| TC-A08 | Login | Valid credentials, verified account → access_token + refresh_token returned | Functional/API | High |
| TC-A09 | Login | "Remember me" checked → confirm actual current behavior end-to-end (known gap — see Risks) | Functional/UI | High |
| TC-C01 | Conversion | Convert 1000 USD → ZAR, guest (no token) → succeeds, history NOT logged to any user | Functional/API | High |
| TC-C02 | Conversion | Convert while logged in → succeeds, entry appears in `/history/recent` | Functional/API | High |
| TC-C03 | Conversion | Convert with amount = 0 → check actual validation behavior (no explicit min enforced in ConvertRequest beyond gt=0) | Functional/BVA | Medium |
| TC-C04 | Conversion | Convert using a currency in the dropdown but NOT in `DEFAULT_RATES` fallback (e.g. INR) during a simulated API failure → check for silent wrong-rate risk (see Risks) | Functional/Negative | Medium |
| TC-F01 | Favorites | Add a pair → appears in sidebar chips immediately | Functional/UI | High |
| TC-F02 | Favorites | Add the same pair twice → second attempt returns 409 | Functional/API | Medium |
| TC-F03 | Favorites | Remove a favorite → disappears from list, further attempts to delete same ID return 404 | Functional/API | Medium |
| TC-P01 | Portfolio | Add a holding → appears in list | Functional/UI | High |
| TC-P02 | Portfolio | Remove a holding not owned by the logged-in user (using another user's ID) → 404, not leaked | Security/Authorization | High |
| TC-AL01 | Alerts | Add alert with invalid direction (not "above"/"below") → 422 | Functional/BVA | Medium |
| TC-AL02 | Alerts | Add alert, then confirm it does NOT get emailed/triggered automatically (documenting the current out-of-scope gap) | Functional | Low |
| TC-H01 | History | `/history/recent` returns only the logged-in user's own conversions | Security/Authorization | High |
| TC-T01 | Trends | `/trends/USD/ZAR` returns empty array before first scheduler run, populated array after | Functional/API | Medium |
| TC-T02 | Trends | Sparkline renders "not enough trend data yet" message correctly on empty response | Functional/UI | Low |
| TC-U01 | UI | Resize browser to <820px → layout switches to single-column per media query | Functional/UI | Low |
| TC-U02 | UI | Rapidly click Convert multiple times → no duplicate/broken history entries, no UI freeze | Exploratory | Medium |
| TC-PF01 | Performance | 20 concurrent users hitting `/convert` for 2 minutes via JMeter → record avg/max response time, error rate | Performance | Medium |
| TC-PF02 | Performance | Same load against `/rates` → compare response time to `/convert` (different code paths — one hits FX API/cache, one also does math) | Performance | Low |

## 9. Test Environment
- **Local:** `python -m uvicorn app.main:app --reload`, SQLite or local Postgres,
  `http://localhost:8000`
- **Deployed:** `https://currency-exchange-tracker-app.onrender.com`, PostgreSQL on Render
- **Browsers:** Chrome and Firefox at minimum (you already found a Firefox-specific
  bug once with GitHub's editor — cross-browser checks are worth keeping habitual)
- **Test data:** at least 2 distinct verified user accounts, 1 unverified account
  (for testing the verification flow itself)
- **Tools:** curl/Postman (API), browser DevTools (UI/network), JMeter (performance)

## 10. Test Deliverables
- This test plan
- Detailed test case sheet (expand Section 8 as you execute — track actual results,
  pass/fail, evidence/screenshots)
- Defect log (GitHub Issues, per your current setup)
- JMeter test plan file (`.jmx`) and a results summary
- Final test summary report (brief — what passed, what didn't, what's still open)

## 11. Schedule (rough, self-paced)
| Phase | Focus | Environment |
|---|---|---|
| 1 | Functional + API — Auth & Verification | Local |
| 2 | Functional + API — Conversion, Favorites, Portfolio, Alerts, History, Trends | Local |
| 3 | UI/manual exploratory — full dashboard walkthrough | Local |
| 4 | Regression — repeat Phases 1-3 against deployed environment | Deployed |
| 5 | Basic JMeter load testing | Deployed (or local, your choice) |
| 6 | Defect logging, retest, final summary report | Both |

## 12. Roles & Responsibilities
Since this is a solo project: Thabo acts as Test Lead, Test Designer, and Tester for
all phases. Worth stating explicitly in any plan you write professionally — even solo
projects benefit from naming this, since it forces clarity on who signs off.

## 13. Risks & Contingencies

| Risk | Impact | Mitigation |
|---|---|---|
| 30-second code TTL vs real email delivery latency | Users may not receive/read the code in time | Test explicitly (TC-A06); consider raising TTL if repeatedly too tight in practice |
| `CHALLENGE_STORE` and rate-limiting are in-memory, single-process | Data lost on restart; won't work if Render ever scales to >1 instance | Acceptable for current WEB_CONCURRENCY=1 setup; flag as a known limitation, not a bug, unless scaling changes |
| `DEFAULT_RATES` fallback dict doesn't cover all dropdown currencies | Silent incorrect conversion rate (defaults to 1.0) if the live FX API fails for an uncommon currency | Test TC-C04 explicitly; consider expanding `DEFAULT_RATES` as a follow-up fix, not covered in this test cycle |
| "Remember me" token generated but not consumed anywhere in the frontend | Feature appears broken/incomplete to a user who expects persistent login | Documented in TC-A09 as a known gap to confirm, not silently assumed fixed |
| Alerts are stored but never checked against live rates | Feature is visibly incomplete (a "silent" gap) | Explicitly out of scope this cycle — don't test as if it should trigger anything yet |
| Third-party FX API (open.er-api.com) downtime or rate limiting | Conversion falls back to cache/defaults, which may be stale or incomplete | Note during testing if it happens; not something you control directly |

## 14. Approval
Since this is a self-directed learning/portfolio project, "sign-off" here just means:
you've gone through Sections 5-8, logged what you found, and you're satisfied the app
behaves as documented (bugs and all) before calling this test cycle complete.