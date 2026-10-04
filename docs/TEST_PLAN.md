# Test Plan — Currency Exchange Tracker

**Test Plan ID:** CET-TP-01  
**Application:** Currency Exchange Tracker  
**Status:** Completed  
**Role:** Thabo Addy Mahlangu — Test Lead, Test Designer, Tester

## 1. Objective

Validate the functional behaviour, API contracts, authentication/session handling, currency conversion reliability, dashboard workflows, responsive UX, and regression stability of the Currency Exchange Tracker.

The test strategy combines exploratory testing, API testing, UI automation, negative/boundary testing, defect investigation, regression testing, and production smoke verification.

## 2. Scope

### In scope
- Direct user registration and login.
- JWT access/refresh-token handling.
- Protected-route authorization.
- Currency conversion and validation.
- Live/cached exchange-rate behaviour.
- Favourites.
- Portfolio.
- Alerts.
- Conversion History.
- Stored rate Trends.
- Dashboard navigation and interaction.
- Responsive/mobile layout.
- Theme/settings behaviour.
- Selenium browser regression.
- CI build and test verification.
- Production smoke testing.

### Out of scope
- Email verification or OTP.
- Automated alert notification delivery.
- Advanced penetration testing.
- Production-scale load/capacity engineering.
- Real-time tick-by-tick market feeds.
- Financial prediction/advice.

## 3. Test Levels

| Level | Purpose | Tooling |
|---|---|---|
| API/backend | Validate business rules and HTTP behaviour independently of UI | FastAPI TestClient, HTTPX, Pytest |
| Service | Validate conversion and exchange-rate logic | Pytest |
| UI | Validate critical user journeys in a real browser | Selenium, Pytest |
| Exploratory/manual | Discover UX, state, responsive, and integration defects | Browser DevTools/manual testing |
| CI | Validate build + automated regression on every PR/push to main | GitHub Actions |
| Production smoke | Verify deployed application behaviour | Browser + configurable Selenium target |

## 4. Test Design Techniques

The project uses:
- positive/happy-path testing;
- negative testing;
- boundary-value analysis;
- equivalence classes;
- authentication/security checks;
- regression testing;
- defect-based test design;
- exploratory testing.

Examples include password length boundaries, conversion amount boundaries, currency-code length boundaries, invalid token types, invalid alert directions, malformed provider responses, unsupported currencies, and authenticated user-data scoping.

## 5. Automated Regression

The final CI suite executes **44 tests successfully**.

Key coverage areas:
- authentication and token security;
- request validation;
- conversion service behaviour;
- fallback/cached rates;
- conversion History persistence;
- favourites;
- portfolio;
- alerts;
- trend-data/UI handling;
- registration/login UI;
- conversion UI.

## 6. Manual Acceptance Criteria

Manual acceptance required all of the following to work correctly:
- Overview;
- Convert;
- Trends + threshold;
- Portfolio;
- History;
- Alerts;
- Settings;
- mobile layout;
- authentication/session recovery.

All were verified and approved.

## 7. Defect Management

Defects were recorded with:
- defect title;
- severity and priority;
- environment;
- reproduction steps;
- expected result;
- actual result;
- root-cause analysis;
- fix/resolution;
- verification outcome.

See [Defect Log](DEFECT_LOG.md).

## 8. CI Acceptance

The final post-merge GitHub Actions run passed all workflow stages:
- frontend dependency installation;
- TypeScript type checking;
- Vite production build;
- static bundle verification;
- Chrome installation;
- Python dependency installation;
- FastAPI startup;
- full Pytest execution.

Final result: **44 passed, 10 warnings**.

## 9. Final Outcome

**PASS — test cycle complete.**

The application passed automated regression, manual acceptance, and production smoke verification. Remaining warnings are maintenance/deprecation items rather than release-blocking defects.
