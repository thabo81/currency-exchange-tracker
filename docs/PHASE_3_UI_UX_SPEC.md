# Phase 3 — UI/UX Redesign Specification

**Project:** Currency Exchange Tracker  
**Phase:** 3 — Exploratory Findings, UX Redesign, and Defect Remediation  
**Status:** Completed / Accepted

## Final Outcome

Phase 3 transformed the dashboard into a dedicated multi-view experience and resolved the major authentication, History, responsive-layout, and trend-visualization findings identified during exploratory testing.

Implemented views:
1. Overview
2. Convert
3. Trends
4. Portfolio
5. History
6. Alerts
7. Settings / Profile

## Acceptance Status

All Phase 3 acceptance areas were manually verified:

- Authentication/session recovery — PASS
- Overview — PASS
- Convert — PASS
- Trends + threshold — PASS
- Portfolio — PASS
- History — PASS
- Alerts — PASS
- Settings — PASS
- Mobile layout — PASS

Automated regression and CI also passed.

## Visual System

### Light theme
- Canvas: `#F8F9FA`
- Surface: `#FFFFFF`
- Primary: `#0F8B8D`
- Accent/success: `#00B894`
- Text: `#2D3436`
- Muted: `#636E72`
- Border: `#DFE6E9`
- Warning: `#F59E0B`
- Error: `#D63031`

### Dark theme
- Canvas: `#12181A`
- Surface: `#1E2528`
- Primary: `#14A3A6`
- Accent/success: `#26E6C3`
- Text: white
- Muted: `#94A3B8`
- Border: `#2D3748`
- Warning: `#F59E0B`
- Error: `#FF7675`

## Completed Defect Areas

- Authenticated conversions are persisted to user History.
- Authenticated identity is displayed correctly.
- Invalid/expired tokens no longer silently become guest requests.
- Access-token refresh and session recovery are handled consistently.
- Conversion preview is separated from persisted History events.
- Favourites start empty for new users and persist saved pairs.
- Portfolio creation uses a modal workflow.
- Trends and History are dedicated views.
- Trends include threshold/state visualization.
- Responsive layouts reflow for mobile.
- Light/dark theme support is implemented.
- CI verifies the frontend bundle before the Python/Selenium regression suite.

## Data Boundary

The Trends experience is based on stored `FxRateHistory` observations. The scheduled collector currently watches a limited set of currency pairs. Arbitrary-pair historical collection remains outside this phase.

## Explicitly Out of Scope

- Automated alert notification delivery.
- Advanced penetration testing.
- Production-scale capacity engineering.
- Real-time tick-by-tick market feeds.
- Speculative financial predictions/advice.
