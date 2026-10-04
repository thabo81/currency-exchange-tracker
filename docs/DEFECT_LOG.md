# Defect Log — Currency Exchange Tracker

This document records the main defects discovered through exploratory testing and QA automation. The purpose is to show the complete defect lifecycle from detection through root-cause analysis, remediation, and retest.

## CET-DEF-001 — Hardcoded frontend API base URL broke production requests

**Severity:** Critical (S1)  
**Priority:** P1  
**Status:** Closed / Verified

### Environment

- Local: FastAPI on `http://localhost:8000`
- Production: Render deployment

### Problem

The production application loaded successfully, but frontend API requests attempted to use a hardcoded `localhost` API address.

Because `localhost` in a browser refers to the user's own machine, production users could not reach the deployed backend through those requests.

### Expected

The frontend should call the backend associated with the environment in which the application is currently running.

### Actual

API requests were directed to `http://localhost:8000` instead of the deployed application origin.

### Root Cause

The frontend JavaScript stored an absolute development URL as a global API base:

```javascript
const API_BASE = "http://localhost:8000";
```

That configuration was not environment-aware.

### Fix

The application switched to relative API paths:

```javascript
const API_BASE = "";
```

The existing fetch calls then resolve against the current application origin.

### Verification

Registration, login, conversion, and deployed application workflows were re-tested successfully against the Render environment.

---

## CET-DEF-002 — Selenium Page Objects could only target localhost

**Severity:** Major (S2)  
**Priority:** P2  
**Status:** Closed / Verified

### Environment

- Local: `http://localhost:8000`
- Production: Render deployment

### Problem

The Selenium Page Object Model embedded `localhost` directly in navigation methods. This meant the same automation could not be executed against another environment without modifying source files.

### Expected

The automation framework should allow a target environment to be selected without changing Page Object source code.

### Actual

Page Objects were tightly coupled to `localhost:8000`.

### Root Cause

The test framework did not expose a configurable base URL.

### Fix

A `base_url` fixture and `--base-url` command-line option were introduced, with `BASE_URL` environment-variable support and a local default.

Example:

```bash
pytest tests/test_ui.py -v --base-url=https://currency-exchange-tracker-app.onrender.com
```

### Verification

The UI automation suite was executed successfully using a production base URL. The same test code can now target local or deployed environments.

---

## QA Closure Summary

The defect log demonstrates a defect-driven workflow:

```text
Exploratory Testing
      ↓
Defect Reproduction
      ↓
Root-Cause Analysis
      ↓
Implementation Fix
      ↓
Targeted Retest
      ↓
Full Regression
      ↓
Production Verification
      ↓
Closure
```

Both recorded critical process/application defects were fixed, retested, and closed before the final portfolio milestone.
