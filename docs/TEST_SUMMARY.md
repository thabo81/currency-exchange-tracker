# Final Test Summary — Currency Exchange Tracker

## Release Status

**Status: PASS / ACCEPTED**

Phase 3 was manually accepted after verification of all major user workflows and the final merged `main` branch was successfully validated by GitHub Actions.

## Automated Evidence

The final Phase 3 GitHub Actions run completed successfully.

- Workflow: `Tests`
- Final pre-merge run: #81
- Final post-merge `main` run: #82
- Result: **Success**
- Test result: **44 passed, 10 warnings**
- Frontend type checking: passed
- Recharts widget production build: passed
- Compiled widget bundle verification: passed
- FastAPI startup: passed
- Selenium browser tests: passed
- API/backend tests: passed

[View the GitHub Actions workflow](https://github.com/thabo81/currency-exchange-tracker/actions/workflows/tests.yml)

## Automated Coverage

### Authentication and security
- Registration succeeds with valid data.
- Duplicate registration is rejected.
- Login returns access and refresh tokens.
- Access tokens cannot be used as refresh tokens.
- Refresh tokens cannot be used as access tokens.
- Invalid access tokens are rejected.
- Password length boundaries are validated.
- Currency-code length boundaries are validated.

### Conversion
- Valid conversion behaviour is verified.
- Amount boundaries are tested.
- Preview conversion does not create a History record.
- Authenticated conversions are stored in History.
- Unsupported/missing currencies are rejected.
- Cached-rate fallback behaviour is tested.
- Malformed provider responses are rejected or handled through fallback logic.
- Non-positive rates are rejected.

### Dashboard features
- Favourites can be added and removed.
- Portfolio holdings can be added and removed.
- Alerts can be added and removed.
- Alert direction options are validated.
- Trends handle available or missing stored data.

### UI automation
- Registration flow returns to login without verification.
- Registered users can log in from the UI.
- Currency conversion UI works.
- Currency swap works.
- Selenium uses reusable Page Objects.
- UI tests support a configurable target base URL.

## Manual Acceptance

The following areas were manually verified against the finished application:

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

## Defect Verification

### CET-DEF-001 — Production API base URL
**Result:** Fixed and verified.

The frontend no longer depends on a hardcoded `localhost` API host. Relative API paths allow the deployed application to call its own backend.

### CET-DEF-002 — Selenium environment targeting
**Result:** Fixed and verified.

The UI automation framework now accepts a configurable target through `--base-url` or `BASE_URL`, avoiding source-code edits between environments.

## Warnings

The successful CI run produced framework/dependency deprecation warnings. These did not cause failures.

Notable examples include:
- FastAPI `on_event` deprecation.
- SQLAlchemy `datetime.utcnow()` deprecation.
- Passlib/crypt deprecation.
- A Node.js package/runtime deprecation warning during GitHub Actions cleanup.

These are suitable for a future maintenance pass but are not release-blocking defects for the completed portfolio milestone.

## Final Acceptance

The release is accepted because:

1. Automated regression tests passed.
2. Frontend build and bundle checks passed.
3. Critical authentication/data-consistency defects were fixed.
4. Manual acceptance passed across the primary product areas.
5. The deployed application was verified as working.
6. GitHub Issues contain no remaining open Phase 3 defects.

**Conclusion:** Currency Exchange Tracker is complete and suitable for presentation as an SDET/QA Automation portfolio project.
