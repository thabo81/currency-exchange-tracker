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
---------------------------------------------------------------------------------------------------------
---------------------------------------------------------------------------------------------------------
# Defect Report

## 1. Defect ID & Title

**Defect ID:** CET-DEF-002

**Title:** Selenium test automation suite hardcodes `localhost` base URL, preventing execution against non-local environments

---

## 2. Severity & Priority

| Attribute | Rating | Justification |
|---|---|---|
| **Severity** | Major (S2) | This defect does not affect the production application itself — end users are unaffected. However, it critically impairs the **test automation asset**: the UI regression suite could only ever validate a local development instance and was structurally incapable of verifying the actual deployed production build, undermining its value as a release-confidence gate. |
| **Priority** | P2 (High) | Not release-blocking for the application, but high priority for test process maturity. Left unresolved, every future production deployment would ship without any automated UI-level verification, relying solely on manual smoke testing (as had already occurred during the CET-DEF-001 investigation). |

---

## 3. Environment

| Environment | Configuration | Status |
|---|---|---|
| **Local (Development)** | `http://localhost:8000`, FastAPI dev server via `uvicorn`, Selenium 4.48.0, Chrome (headless) | Suite executable, but only against this one target |
| **Production (Render)** | `https://currency-exchange-tracker-app.onrender.com` | **Unreachable by the suite — no mechanism existed to target it** |

**Test framework:** Pytest 9.1.1 + Selenium WebDriver, Page Object Model pattern (`pages/base_page.py`, `pages/login_page.py`, `pages/dashboard_page.py`)

**Test under discussion:** `tests/test_ui.py::test_currency_conversion_ui`

**Build/Commit:** Pre-fix commit on `main`, prior to `base_url` fixture introduction

---

## 4. Prerequisites

- Chrome and a compatible ChromeDriver available in the test execution environment
- Project dependencies installed per `requirements.txt`
- Access to both a local FastAPI instance (`uvicorn app.main:app`) and the live Render deployment URL, for comparison

---

## 5. Detailed Steps to Reproduce

1. Open `pages/login_page.py` and `pages/dashboard_page.py` and inspect the `open_login()` / `open_dashboard()` methods
2. Observe both methods call `self.open("http://localhost:8000/...")` with the host hardcoded directly into the method body
3. Attempt to execute the suite against the production deployment, e.g.:
   ```
   pytest tests/test_ui.py -v
   ```
4. Observe there is no command-line option, environment variable, or configuration mechanism available to redirect the suite's target host
5. Attempt a manual workaround by editing the source files directly to point to the Render URL, then reverting afterward for local runs

---

## 6. Expected Result

The test suite should be environment-agnostic: a single command-line flag or environment variable (e.g., `--base-url` or `BASE_URL`) should allow the identical test code to run unmodified against any target — local development, staging, or production — without editing Page Object source files between runs.

---

## 7. Actual Result

The target host was fixed at the source-code level inside the Page Object Model. Running the suite against any environment other than `localhost:8000` was only possible by manually editing `pages/login_page.py` and `pages/dashboard_page.py` before each run and reverting the changes afterward — an error-prone, non-repeatable process unsuitable for CI/CD pipelines or repeatable regression testing. As a direct consequence, the CET-DEF-001 production defect (hardcoded frontend API base URL) was only caught through **manual** browser testing after deployment, since the automated suite had no way to have caught it against the live environment beforehand.

---

## 8. Root Cause Analysis

The Page Object Model's base class, `pages/base_page.py`, defined only a `driver` reference in its constructor and provided no concept of a configurable target environment:

```python
class BasePage:
    def __init__(self, driver):
        self.driver = driver
        self.wait = WebDriverWait(driver, 15)
```

Consuming page objects (`LoginPage`, `DashboardPage`) each embedded the literal string `"http://localhost:8000"` directly in their navigation methods:

```python
def open_login(self):
    self.open("http://localhost:8000/login")
```

This is a **test-framework design defect**, distinct in nature from CET-DEF-001 but stemming from the identical root pattern: a development-time convenience value was never abstracted into a configurable parameter, so the test suite's scope of validation was silently limited to a single, non-production environment. The `tests/conftest.py` fixture responsible for supplying the Selenium `browser` instance likewise offered no companion mechanism for supplying a target URL alongside it.

**Contributing factor:** No `pytest_addoption` hook or equivalent CLI/environment-variable pattern had been established anywhere in the test suite, meaning there was no existing precedent or scaffolding for environment-aware test configuration to build upon.

---

## 9. Resolution / Fix Applied

A `base_url` fixture and accompanying `--base-url` CLI flag were introduced in `tests/conftest.py`, resolving the target host with the following precedence: explicit CLI flag → `BASE_URL` environment variable → `http://localhost:8000` default.

```python
def pytest_addoption(parser):
    parser.addoption(
        "--base-url",
        action="store",
        default=None,
        help="Base URL of the application under test",
    )


@pytest.fixture(scope="session")
def base_url(request):
    cli_value = request.config.getoption("--base-url")
    if cli_value:
        return cli_value.rstrip("/")
    return os.getenv("BASE_URL", "http://localhost:8000").rstrip("/")
```

`BasePage.__init__` was updated to accept and store this value, and both `LoginPage` and `DashboardPage` were updated to construct their navigation URLs from it rather than a hardcoded literal:

```python
class BasePage:
    def __init__(self, driver, base_url="http://localhost:8000"):
        self.driver = driver
        self.base_url = base_url
        self.wait = WebDriverWait(driver, 15)
```

```python
# login_page.py
def open_login(self):
    self.open(f"{self.base_url}/login")

# dashboard_page.py
def open_dashboard(self):
    self.open(f"{self.base_url}/dashboard")
```

`tests/test_ui.py::test_currency_conversion_ui` was updated to accept the `base_url` fixture and pass it into each page object on construction, and its previous `@pytest.mark.skip` marker was removed, since the test was no longer permanently inoperable.

**Verification performed post-fix:**
- Suite executed successfully with no flag (defaulting to `http://localhost:8000`) against a local `uvicorn` instance.
- Suite executed successfully against the live production deployment:
  ```
  pytest tests/test_ui.py --base-url=https://currency-exchange-tracker-app.onrender.com -v
  ```
  Result: `1 passed, 3 warnings in 7.21s` — confirming the identical, unmodified test code validated registration-page rendering, dashboard navigation, live currency conversion, and currency-pair swap functionality directly against production.

**Outcome:** The automated UI suite is now capable of serving as a genuine pre- and post-deployment verification gate against any environment, closing the process gap that had previously allowed CET-DEF-001 to reach production undetected by automation.