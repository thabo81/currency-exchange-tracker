# Portfolio Case Study — Currency Exchange Tracker

## 30-second recruiter summary

**Currency Exchange Tracker is a full-stack application I used to demonstrate QA Automation / SDET engineering practices end to end. I designed functional and negative tests, built reusable Selenium Page Objects with Pytest, validated backend APIs independently of the UI, investigated production defects, added environment-aware test configuration, and integrated the regression suite into GitHub Actions. I also performed manual exploratory and responsive testing before accepting the final Render deployment.**

## The QA/SDET problem

The project was not treated as a simple CRUD application. The objective was to build a working product while creating evidence of a repeatable quality process.

Key risks included:
- authentication and session failures;
- invalid and boundary inputs;
- incorrect exchange-rate fallback behaviour;
- data isolation between users;
- conversion History persistence;
- UI state and navigation problems;
- production-only configuration defects;
- responsive/mobile layout failures.

## Test approach

The project used multiple levels of validation:

```text
Requirements / Features
        ↓
Risk Identification
        ↓
Exploratory Testing
        ↓
API + Service Tests
        ↓
Selenium UI Automation
        ↓
Defect Investigation
        ↓
Targeted Retest
        ↓
Full Regression
        ↓
CI Validation
        ↓
Production Smoke Test
        ↓
Release Acceptance
```

## Automation architecture

### Pytest

Pytest provides the test runner, fixtures, parameterized boundary checks, and assertion framework.

### FastAPI TestClient / HTTPX

Backend/API tests validate the application independently of the browser. This makes it possible to identify whether a failure originates in the API/business layer or in the UI integration.

### Selenium WebDriver

Selenium covers critical browser journeys such as:
- registration;
- login;
- currency conversion;
- currency swapping;
- favourites;
- portfolio;
- alerts;
- trend rendering.

### Page Object Model

Reusable Page Objects isolate selectors and browser actions from test intent.

Primary objects:
- `pages/base_page.py`
- `pages/login_page.py`
- `pages/dashboard_page.py`

This makes UI tests easier to maintain when the dashboard structure changes.

## Environment-aware automation

A key framework improvement was introducing a configurable application target.

The UI tests can use:

```bash
pytest tests/test_ui.py --base-url=https://currency-exchange-tracker-app.onrender.com
```

or:

```bash
BASE_URL=https://currency-exchange-tracker-app.onrender.com pytest tests/test_ui.py
```

This avoids editing Page Object source code when switching between local and deployed environments.

## Defect investigation examples

### Production configuration defect

Exploratory production testing identified a hardcoded `localhost` API base URL.

**Impact:** production browser requests were sent to the user's local machine instead of the deployed backend.

**Fix:** replaced the absolute development URL with relative API paths.

**QA value:** demonstrates environment-specific testing, network-layer investigation, root-cause analysis, and production retesting.

### Test-framework configuration defect

The Selenium Page Objects also used hardcoded `localhost` navigation URLs.

**Impact:** the regression suite could not target the production environment without source edits.

**Fix:** introduced a `base_url` fixture and CLI/environment configuration.

**QA value:** demonstrates test-framework engineering rather than only test execution.

## Final automated evidence

The completed application regression suite contains **44 passing tests**.

Coverage includes:
- authentication;
- token security;
- password validation;
- conversion boundaries;
- currency-code validation;
- exchange-rate provider failures;
- cached fallback behaviour;
- conversion History;
- favourites;
- portfolio;
- alerts;
- trends;
- registration UI;
- login UI;
- conversion UI.

The GitHub Actions pipeline also validates:
- frontend dependency installation;
- TypeScript type checking;
- Vite/React widget build;
- generated bundle presence;
- Chrome setup;
- FastAPI startup;
- complete Pytest regression.

## Manual acceptance

The final product was manually accepted across:

| Area | Result |
|---|---|
| Overview | PASS |
| Convert | PASS |
| Trends + threshold | PASS |
| Portfolio | PASS |
| History | PASS |
| Alerts | PASS |
| Settings | PASS |
| Mobile layout | PASS |
| Authentication/session recovery | PASS |

## What this demonstrates to an SDET recruiter

The strongest evidence is the combination of:

**Test design + automation + framework engineering + defect analysis + CI/CD + production verification.**

The repository demonstrates that testing was treated as an engineering activity rather than a final manual step.

### Interview-ready explanation

> “I used this project to build out a practical SDET workflow. I started with functional and exploratory testing, identified defects, and converted high-value scenarios into Pytest API and Selenium UI automation. I used the Page Object Model to keep the UI suite maintainable, added boundary and negative tests around authentication and currency conversion, and configured GitHub Actions to build the frontend and run the full regression suite. During production testing I found an environment-specific API configuration defect, traced it to a hardcoded localhost URL, fixed it, and then improved the test framework so the same UI suite could target different environments. I finished with manual acceptance and production verification.”

## Portfolio positioning

Recommended role labels for this repository:

- QA Automation Engineer
- SDET
- Software Test Engineer
- QA Engineer
- Test Automation Engineer

The project should be presented primarily as a **QA Automation / SDET portfolio project**, with full-stack development described as the application context rather than the primary professional identity.
