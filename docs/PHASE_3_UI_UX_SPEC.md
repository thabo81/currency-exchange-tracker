# Phase 3 — UI/UX Redesign Specification

Project: Currency Exchange Tracker
Phase: 3 — Exploratory Findings, UX Redesign, and Defect Remediation
Branch: phase-3/auth-history-foundation
Status: Draft for implementation

## 1. Objectives

Phase 3 converts the exploratory-testing findings into a coherent product design and remediation plan.

Goals:
- separate unrelated workflows into dedicated screens;
- make currency conversion fast and visually clear;
- provide a useful, data-driven Trends experience;
- make Portfolio and History easier to understand and manage;
- handle authenticated sessions consistently;
- improve desktop and mobile responsiveness;
- replace development-oriented UI patterns with production-oriented UX;
- preserve working backend behavior unless redesign requirements require backend changes.

UI/UX visual styling must not be finalized until the color palette, contrast rules, typography, component states, and visual hierarchy have been deliberately selected.

## 2. Target Information Architecture

Primary navigation:
1. Overview
2. Convert
3. Trends
4. Portfolio
5. History
6. Alerts
7. Settings / Profile

### Overview
Purpose: concise product summary rather than a second full conversion screen.
Planned sections: market/favorite-pair summary, portfolio summary, active-alert summary, recent activity, and data freshness/status.

### Convert
Purpose: perform a currency conversion.
Planned sections: amount, source currency, target currency, swap, favorite/watchlist control, current rate, converted amount, live/cached status, and last-updated information.
Conversion History and the large Trend chart should not be embedded here.

### Trends
Purpose: analyze exchange-rate movement.
Planned features: searchable/selectable currency pair, current rate, percentage change, configurable time ranges, historical line chart, high/low values where data supports them, last-updated timestamp, data-source/status, and alert-threshold overlay when applicable.
The initial implementation must not imply historical precision that the stored data cannot support.
The current scheduled history collection watches a limited set of pairs; expanding Trends to arbitrary pairs requires an explicit data-collection/storage design.

### Portfolio
Purpose: manage and understand holdings.
Planned layout: total portfolio value, allocation summary, holdings list/table/cards, add/edit/delete actions, add/edit form in a modal or drawer, valuation using current rates where supported, and optional notes.

### History
Purpose: review previous conversions.
Planned features: newest-first records, amount, source currency, target currency, converted amount, rate used, timestamp, search/filter/sort, pagination or bounded result loading, and optional CSV export as a later enhancement.
History should be a dedicated screen rather than a large card below the converter.

### Alerts
Purpose: manage rate thresholds.
Planned features: active/inactive state, currency pair, direction, target rate, current rate, clear status, edit/remove, and threshold visibility from Trends.
Automated notification delivery is a later capability and must not be represented as implemented until the backend actually evaluates alerts and sends notifications.

### Settings / Profile
Potential areas: authenticated user identity, preferred display currency, preferred conversion pair, notification preferences, theme preference, and session/logout controls.

## 3. Currency Selection

The long static dropdown should evolve toward a searchable currency picker.

Each currency should expose at least: ISO code, currency name, and symbol where available.
Useful groupings: recently used, favorites/watchlist, popular currencies, and all supported currencies.
The selector must remain keyboard accessible and usable at mobile widths.

## 4. Conversion UX Rules

The current UI recalculates when amount or currency selections change. That behavior may remain, but the implementation must avoid creating noisy or misleading History records for every keystroke.
A future History design should distinguish between a conversion preview/result and a conversion event that should be persisted to user History.
The exact interaction model will be finalized before the Convert screen is redesigned.

Converted values should display an appropriate currency symbol where this improves readability, while retaining the currency code where symbols are ambiguous.

## 5. Authentication and Session UX

The application must clearly distinguish guest usage, an authenticated session, and an expired/invalid authenticated session.
Required behavior:
- authenticated dashboard requests send the access token;
- expired access tokens do not silently become guest requests;
- refresh-token behavior is handled consistently;
- if refresh fails, stale session state is cleared and the UI directs the user to log in;
- authenticated user identity is displayed instead of Guest;
- protected feature failures provide clear user-facing feedback.

## 6. Trend Data Requirements

The redesigned Trends experience must be based on actual stored provider data.
The current limitation is scheduled rate history for a fixed set of watched pairs.
Before implementing arbitrary-pair trends, determine whether to expand the scheduled watchlist, store broader base-currency snapshots and derive cross-rates, create on-demand historical collection, or use another documented provider/history source.
Do not fabricate chart points or use static demo trajectories.

## 7. Responsive Design Requirements

Desktop: clear hierarchy between navigation, content, and secondary information; consistent spacing; controls aligned on a predictable grid; readable chart/card dimensions.
Mobile: intentional stacking; adequate vertical spacing; appropriately sized controls; no overlapping labels; no clipped selector/input text; aligned action controls; readable status/help text; accessible touch targets; and no horizontal overflow.

## 8. Visual Design Workshop — REQUIRED BEFORE UI REDESIGN

No final color palette is locked yet.

Before implementing the new visual system, brainstorm and choose:

### Palette directions to evaluate
- Professional finance: navy / blue / cool neutral.
- Modern fintech: deep charcoal / electric blue / mint accent.
- Dark market terminal: near-black / graphite / green or cyan accent.

The final palette must consider WCAG text contrast, positive/negative market states, warning/error states, disabled states, chart readability, dark/light mode if implemented, and semantic meaning of color.

### Selected working palette — fintech cyan / mint

The visual direction is now defined as a modern fintech palette using off-white/white surfaces in light mode and deep slate surfaces in dark mode. The base colors below are the approved starting point for Phase 3 visual implementation.

#### Light theme

| Semantic role | Color | Intended use |
|---|---|---|
| Canvas | `#F8F9FA` | Main page/background surface |
| Surface | `#FFFFFF` | Cards, panels, inputs, modal/drawer surfaces |
| Primary | `#0F8B8D` | Navigation, structural UI, primary brand elements |
| Accent | `#00B894` | Highlights, selected states, chart emphasis, positive visual accents |
| Success | `#00B894` | Success/positive status semantics; keep as a separate design token even while it shares the accent value |
| Text | `#2D3436` | Primary body text and headings |
| Text muted | `#636E72` | Secondary text, captions, metadata |
| Border | `#DFE6E9` | Dividers, input/card borders |
| Warning | `#F59E0B` | Threshold warnings, caution states, attention indicators |
| Error | `#D63031` | Destructive/error states |

#### Dark theme

| Semantic role | Color | Intended use |
|---|---|---|
| Canvas | `#12181A` | Main page/background surface |
| Surface | `#1E2528` | Cards, panels, inputs, modal/drawer surfaces |
| Primary | `#14A3A6` | Navigation, structural UI, primary brand elements |
| Accent | `#26E6C3` | Highlights, selected states, chart emphasis, positive visual accents |
| Success | `#26E6C3` | Success/positive status semantics; keep as a separate design token even while it shares the accent value |
| Text | `#FFFFFF` | Primary body text and headings |
| Text muted | `#94A3B8` | Secondary text, captions, metadata |
| Border | `#2D3748` | Dividers, input/card borders |
| Warning | `#F59E0B` | Threshold warnings, caution states, attention indicators |
| Error | `#FF7675` | Destructive/error states |

#### CSS design tokens

Use semantic CSS variables rather than hard-coding colors throughout component styles:

```css
:root {
    --color-canvas: #F8F9FA;
    --color-surface: #FFFFFF;
    --color-primary: #0F8B8D;
    --color-accent: #00B894;
    --color-success: #00B894;
    --color-text: #2D3436;
    --color-text-muted: #636E72;
    --color-border: #DFE6E9;
    --color-warning: #F59E0B;
    --color-error: #D63031;
}

[data-theme="dark"] {
    --color-canvas: #12181A;
    --color-surface: #1E2528;
    --color-primary: #14A3A6;
    --color-accent: #26E6C3;
    --color-success: #26E6C3;
    --color-text: #FFFFFF;
    --color-text-muted: #94A3B8;
    --color-border: #2D3748;
    --color-warning: #F59E0B;
    --color-error: #FF7675;
}
```

#### Contrast and usage rules

The palette is intentionally retained, but individual colors must be used according to their contrast characteristics rather than treated as interchangeable text colors.

- Use `#2D3436`, `#636E72`, and white text for normal-size content where the selected surface provides sufficient contrast.
- Treat `#00B894` and `#26E6C3` primarily as accents, icons, chart lines, selected states, badges, and large/high-emphasis content rather than default body text on light surfaces.
- Use the cyan primary colors for structural UI and controls; do not rely on them as the only visual signal for meaning.
- Keep warning and error states semantically distinct from positive/success states.
- Never communicate a state through color alone; pair color with text, icons, labels, position, or another accessible indicator.

#### Chart and threshold semantics

Charts will use color by meaning rather than decoration:

- Cyan: neutral/current series or primary interaction state.
- Mint: positive movement or favorable state.
- Red: negative movement or breach/error state.
- Amber: warning/near-threshold state.
- Threshold line: a visually distinct reference treatment that remains readable in both themes.
- Threshold breach: visually emphasize only the affected portions/markers rather than tinting the entire chart indiscriminately.

The chart must also provide textual threshold/state information so the interpretation does not depend on color alone.

### Typography
Decide the primary UI font, heading scale, body scale, number/financial-value treatment, and table density.

### Components
Define visual rules for buttons, inputs, searchable currency pickers, cards, badges, status indicators, tables, charts, modals/drawers, navigation, empty states, loading states, and error states.

### Chart colors
Chart color must encode meaning consistently: neutral/current series, positive movement, negative movement, alert threshold, and threshold breach.
Threshold colors must remain accessible and interpretable rather than being chosen only for aesthetics.

## 9. Phase 3 Implementation Order

### Phase 3A — Foundation / defects
- fix authenticated conversion requests;
- fix user identity display;
- fix access-token/refresh handling;
- prevent invalid tokens from silently becoming guest requests;
- make History persistence correct;
- add regression tests.

### Phase 3B — Data and Trends foundation
- define trend data strategy;
- improve historical-rate collection/storage;
- define chart API contract;
- add tests for trend data.

### Phase 3C — UI/UX redesign
Only after the visual workshop:
- redesign navigation/layout;
- redesign Convert;
- build dedicated Trends;
- redesign Portfolio;
- build dedicated History;
- redesign Alerts;
- improve currency picker;
- implement responsive layout;
- apply the selected palette and design system.

### Phase 3D — Regression and deployment
- full local suite;
- UI regression;
- production smoke tests;
- Render deployment verification;
- defect retesting;
- documentation updates.

## 10. Acceptance Criteria

Phase 3 is complete when:
- critical authentication/data-consistency defects are resolved;
- authenticated conversions appear in user History;
- authenticated identity is displayed correctly;
- session-expiry behavior is explicit and recoverable;
- Trends use real stored data;
- Convert, Trends, Portfolio, History, and Alerts have clear boundaries;
- mobile layout no longer overlaps or clips;
- currency selection is easier to use;
- a visual palette and component system are explicitly selected;
- automated and UI regression tests pass;
- production smoke checks succeed.

## 11. Explicit Out-of-Scope Items

Unless separately approved: payment processing, advanced penetration testing, production-scale capacity engineering, real-time tick-by-tick market feeds, automated alert notification delivery, and speculative financial advice or market prediction features.