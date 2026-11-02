# Currency Exchange Tracker — Test Method Reference Guide

## Purpose and scope

This guide explains what the automated tests verify and how their supporting methods work. It is based on the current `tests/`, `pages/`, `app/services.py`, `app/auth.py`, and `app/dependencies.py` implementation. It covers all current test functions, the project's fixture/helper methods, the methods defined on the test Page Objects, and the framework calls used to drive assertions.

## 1. Test suite map

| File | Purpose |
|---|---|
| `tests/conftest.py` | Shared URL, API client, test database, Chrome browser, and authenticated-session fixtures. |
| `tests/test_auth.py` | Registration, login, JWT purpose separation, validation boundaries, conversion history, and alert validation. |
| `tests/test_conversion_service.py` | Conversion calculations, malformed provider payloads, cached fallback, and rate-source reporting. |
| `tests/test_registration_ui.py` | Browser registration and login journeys without email verification. |
| `tests/test_dashboard_features_ui.py` | Browser regression coverage for favourites, portfolio holdings, alerts, and Trends. |
| `tests/test_ui.py` | End-to-end currency-conversion smoke test. |

The README documents a successful CI run of 44 cases. There are fewer test functions because parameterized tests run once per input row. Browser tests may skip when Chrome WebDriver is unavailable.

## 2. Test fixtures and helper functions

### `pytest_addoption(parser)` — `tests/conftest.py`

Registers the `--base-url` CLI argument. It lets one test suite target a local or deployed instance without hardcoding the host into the tests or Page Objects.

### `base_url(request)`

Chooses the URL in this order: `--base-url`, then `BASE_URL`, then `http://localhost:8000`. It removes a trailing slash to avoid duplicate separators when tests append endpoint paths.

### `client()`

Creates FastAPI's in-process `TestClient`, so API tests do not need a separately started server. After the test finishes, it drops and recreates the mapped tables on the dedicated test SQLite engine to limit state leakage between cases.

### `browser()`

Starts Chrome using headless/container-friendly options. If Chrome WebDriver cannot be created, it calls `pytest.skip` with the reason rather than presenting a browser test as passed. It calls `driver.quit()` during teardown to close the browser session.

### `authenticated_session(browser, base_url)`

Creates a unique synthetic account through HTTPX requests to `POST /register` and `POST /login`. It then opens the dashboard, injects the access token, refresh token and user object into browser `localStorage`, and refreshes the page. Dashboard tests can therefore begin authenticated without repeating the UI registration/login steps in each scenario.

This fixture requires the configured target URL to be reachable. It uses a test-only password and must not be treated as production test data.

### `registration_payload(email, password)` — `tests/test_auth.py`

Builds a standard registration JSON body. Tests can change the email or password while keeping the other required fields consistent.

### `register_and_login(client, email, password)`

Posts the registration payload, asserts the expected success response, and returns the login response. It reduces duplicate setup code in tests that need a token.

## 3. API/authentication test catalogue

All functions in this table are in `tests/test_auth.py`.

| Test function | What it checks | Why |
|---|---|---|
| `test_invalid_login_returns_401` | Unknown credentials return HTTP 401. | Invalid credentials must not authenticate a user. |
| `test_register_creates_account_without_verification` | Registration succeeds without OTP/email-verification steps. | Preserves the agreed direct-registration flow. |
| `test_register_then_login_succeeds` | Registration followed by login returns access/refresh tokens and bearer token type. | Covers the main authentication journey and response contract. |
| `test_duplicate_registration_returns_409` | A repeated email returns HTTP 409. | Checks duplicate-account conflict handling. |
| `test_refresh_token_can_issue_new_access_token` | A refresh token can obtain a new access token. | Covers session renewal. |
| `test_access_token_cannot_be_used_as_refresh_token` | The refresh endpoint rejects an access token. | Enforces token-purpose separation. |
| `test_refresh_token_cannot_be_used_as_access_token` | A protected endpoint rejects a refresh token as a Bearer token. | Prevents refresh credentials being used for ordinary API access. |
| `test_register_password_length_boundaries` | Tests below-minimum, minimum, maximum and above-maximum password lengths. | Uses boundary-value analysis to find off-by-one validation errors. |
| `test_convert_amount_boundaries` | Tests zero, a small positive value, a negative value and a very large amount. | Checks amount validation and documents that no upper limit is currently defined. |
| `test_convert_currency_code_length_boundaries` | Tests 2-, 3- and 4-character currency codes. | Checks the three-character currency-code contract. |
| `test_conversion_preview_does_not_create_history_record` | A preview returns a conversion value but does not create recent history. | Separates a preview from a committed conversion event. |
| `test_authenticated_conversion_is_saved_to_history` | A token-authenticated conversion appears in that user's history with expected currencies and amount. | Verifies persistence and user association. |
| `test_invalid_access_token_is_rejected_for_authenticated_conversion` | A supplied invalid Bearer token returns HTTP 401. | Invalid credentials must not silently fall back to guest access. |
| `test_portfolio_negative_amount_currently_accepted` | A negative portfolio amount currently receives HTTP 200. | This records a known validation gap; it is not an endorsement of negative holdings as desired behavior. |
| `test_alert_direction_equivalence_classes` | `above` and `below` are accepted; `sideways` is rejected. | Tests valid and invalid input classes. |

The password, amount, currency-code, and alert-direction tests use `pytest.mark.parametrize` so each row is a separate test execution.

## 4. Currency service test catalogue

All functions below are in `tests/test_conversion_service.py`.

| Test function | What it checks | Why |
|---|---|---|
| `test_convert_currency_uses_rate_ratio_for_supported_pair` | A controlled USD/ZAR snapshot converts 10 USD at 18.5 to 185 ZAR. | Verifies the calculation deterministically, without external network dependency. |
| `test_convert_currency_rejects_missing_target_currency` | Missing target currency raises `ValueError`. | The application must not invent a rate for an unsupported target. |
| `test_convert_currency_reports_cached_fallback_source` | A conversion preserves the `cached` source label from the provider helper. | Makes rate provenance observable to the caller. |
| `test_rate_snapshot_reports_cached_source` | Snapshot includes base currency, rate values and `cached` source. | Checks response metadata as well as the rates. |
| `test_convert_currency_rejects_non_positive_rates` | A zero target rate raises `ValueError`. | Blocks mathematically invalid rates. |
| `test_convert_currency_rejects_missing_source_currency` | A source absent from the rate map raises `ValueError`. | Avoids silently using a substitute source rate. |
| `test_parse_rate_payload_rejects_malformed_provider_data` | Missing/empty rate objects and non-numeric values are rejected. | Validates untrusted provider responses before calculations use them. |
| `test_malformed_provider_response_uses_cached_rates` | A fake malformed response uses cached rates and must not save malformed data. | Verifies safe fallback and guards against cache pollution. |

### Why monkeypatching is used here

`monkeypatch.setattr` temporarily replaces the rate-fetch helper, HTTP `urlopen`, cache retrieval, or cache writing function. The test controls its input without relying on a live provider, and pytest restores the original attribute after the test. The malformed-response test replaces cache writing with `pytest.fail` so an unexpected cache write fails immediately.

## 5. UI test catalogue

### Registration — `tests/test_registration_ui.py`

| Test function | What it checks | Why |
|---|---|---|
| `test_registration_returns_to_login_without_verification` | Successful registration returns to the login panel and no OTP panel appears. | Confirms the visible UI follows the direct-registration contract. |
| `test_registered_user_can_log_in_from_ui` | A registered user logs in and the URL changes to `/dashboard`. | Checks the full browser journey, not just an API status code. |

Both tests use `uuid.uuid4().hex` to generate a distinct synthetic email per execution, reducing collisions between runs.

### Dashboard features — `tests/test_dashboard_features_ui.py`

| Test function | What it checks | Why |
|---|---|---|
| `test_favorite_pair_can_be_added_and_removed` | Starts empty, saves USD/ZAR, confirms it survives refresh, then removes it. | Covers both mutation directions and persistence. |
| `test_portfolio_add_and_remove_holding` | Adds a holding, checks its row, removes it, and waits for the original row count. | Validates list state without relying on asynchronously recalculated portfolio value. |
| `test_alert_add_and_remove` | Creates a USD/ZAR above-threshold alert and then deletes it. | Covers the alert lifecycle in the browser. |
| `test_alert_direction_options_present` | Confirms the direction selector contains `above` and `below`. | Checks the UI presents supported choices. |
| `test_trend_chart_handles_available_or_missing_data` | Accepts a chart when present or the expected empty-state message when data is absent. | Makes the scenario meaningful in test environments with or without stored trends. |

### Conversion smoke test — `tests/test_ui.py`

`test_currency_conversion_ui` opens the application, navigates to Convert, enters an amount, submits the conversion, checks that output appears, swaps currencies, and checks output again. It is a high-level regression check that the main UI controls work together.

This test currently uses fixed `time.sleep` delays for some transitions. Explicit waits tied to the target page state are generally more reliable; the documentation patch notes that improvement opportunity but does not alter synchronization or behavior.

## 6. Service methods that the tests exercise

These functions are defined in `app/services.py`.

| Method | How it works | Why it matters |
|---|---|---|
| `parse_rate_payload(payload)` | Requires a non-empty `rates` dictionary, uppercases currency keys, converts values to floats, and raises `ValueError` for malformed payloads. | Provider data must be validated before use. |
| `_fetch_rates_with_source(base_currency)` | Fetches live rates, validates them, saves successful snapshots, and falls back to cached/default data on supported provider or parsing failures. Returns rates and a source label. | The tests verify reliable fallback and truthful source reporting. |
| `fetch_live_rates(base_currency)` | Public wrapper that returns only the rates from `_fetch_rates_with_source`. | Keeps compatibility for callers that do not need the source label; not directly asserted by the current service tests. |
| `save_rate_cache(base_currency, rates)` | Inserts/updates the SQLAlchemy cache record and commits the change. | The malformed-payload test ensures this is not called for bad provider data. |
| `fetch_cached_rates(base_currency)` | Reads stored rates when available, otherwise returns a copy of built-in defaults. | Supplies a predictable fallback path for service tests. |
| `convert_currency(amount, from_currency, to_currency)` | Retrieves a rate map, validates that both currencies exist and rates are positive, calculates `target_rate / base_rate`, then multiplies by amount. Returns converted amount, rate and source. | Tests calculation, supported currencies, rate validation and source propagation. |
| `get_rate_snapshot(base_currency)` | Returns the uppercase base, rounded rate map, source label and UTC update timestamp. | Ensures consumers receive consistent rate metadata. |

## 7. Authentication methods and routes exercised indirectly

These tests call FastAPI routes; they normally do not call these functions directly.

| Method or endpoint | Role in the tested flow |
|---|---|
| `hash_password(password)` | Registration stores a password hash rather than plaintext. |
| `verify_password(password, password_hash)` | Login compares the supplied password with the stored hash. |
| `create_access_token(subject)` | Issues the JWT used on protected API routes. |
| `create_refresh_token(subject)` | Issues the refresh-purpose JWT for session renewal. |
| `decode_token(token)` | Decodes and verifies a JWT before its claims are used. |
| `get_current_user(...)` | Validates a Bearer access token and loads its user. |
| `get_optional_user(...)` | Allows a request with no Authorization header to be anonymous, but rejects a supplied invalid token. |
| `POST /register`, `POST /login` | Account creation and credential exchange for API and UI setup. |
| `POST /refresh-token` | Enforces refresh-token purpose and access-token renewal. |
| `POST /convert/preview` | Converts an amount without persisting a history record. |
| `POST /convert`, `GET /history/recent` | Verifies saved conversion history for an authenticated user. |
| `POST /portfolio`, `POST /alerts`, `GET /favorites` | Exercises portfolio validation, alert direction validation and protected-resource authentication. |

## 8. Pytest methods and patterns

| Method/pattern | How it works | Why it is used |
|---|---|---|
| `@pytest.fixture` | Runs setup/teardown and injects yielded/returned resources. | Shares database, API, URL and browser setup. |
| `@pytest.mark.parametrize` | Runs a function for every input row. | Efficiently checks boundaries and equivalence classes. |
| `monkeypatch.setattr(...)` | Replaces a function/attribute temporarily and restores it after the test. | Controls rate responses and side effects deterministically. |
| `pytest.approx(value)` | Compares floating-point values within tolerance. | Avoids brittle exact comparisons of decimal calculations. |
| `pytest.raises(Error, match=...)` | Requires the specified exception and optionally a matching message. | Confirms invalid input is rejected explicitly. |
| `pytest.fail(message)` | Fails immediately when an unexpected operation occurs. | Guards against saving malformed provider rates. |
| `pytest.skip(message)` | Marks a test skipped with a reason. | Makes missing browser infrastructure visible rather than treating the UI scenario as passed. |
| `assert response.status_code == ...` | Checks the response status against the endpoint contract. | Detects incorrect success/error behavior. |
| `response.json()`, `response.text` | Reads parsed JSON or raw response text. | Enables field-level assertions and useful failure diagnostics. |

## 9. HTTP-client and database methods in test setup

| Method | How it works and why it is used |
|---|---|
| `TestClient(app)` | Calls FastAPI in-process without manually starting Uvicorn. |
| `client.post(...)`, `client.get(...)` | Submit API requests with JSON bodies, query parameters and headers. |
| `httpx.Client(base_url=...)` | Makes HTTP requests to the configured running application from the browser-auth fixture. |
| `create_engine(...)` | Creates the SQLAlchemy engine for the SQLite test database. |
| `sessionmaker(...)` | Configures database sessions bound to the test engine. |
| `Base.metadata.create_all(bind=engine)` | Creates the mapped schema needed by the tests. |
| `Base.metadata.drop_all(bind=engine)` | Drops mapped test tables before the schema is recreated between API tests. |

## 10. Page Object Model methods

The Page Object Model keeps locators and browser interactions out of the scenario assertions. Tests describe a user action; page methods centralize how the UI performs that action.

### `pages/base_page.py`

| Method | How it works / why it is useful |
|---|---|
| `__init__(driver, base_url)` | Stores browser and URL context and creates a 15-second `WebDriverWait`. |
| `open(url)` | Navigates to the supplied URL through WebDriver. |
| `click(by, value)` | Waits for a locator to become clickable, clicks it and returns the element. |
| `type(by, value, text)` | Waits for visibility, clears the field and types text. |
| `get_text(by, value)` | Waits for visibility and returns displayed text. |
| `is_visible(by, value)` | Returns a boolean after waiting for the locator to become visible. |
| `wait_for_url(url_fragment)` | Waits until the current URL contains the requested fragment. |

### `pages/login_page.py`

| Method | How it works / why it is useful |
|---|---|
| `open_login()` | Navigates to the configured login URL. |
| `login(email, password, remember_me=False)` | Fills credentials, optionally selects Remember Me, and submits the form. |
| `register(first_name, surname, email, country, password)` | Opens the registration panel, fills the fields and submits. |
| `get_auth_message()` | Returns the trimmed visible authentication message for assertions. |

### `pages/dashboard_page.py`

| Method | How it works / why it is useful |
|---|---|
| `open_dashboard()` | Opens the dashboard route. |
| `enter_amount(amount)` | Types the conversion amount. |
| `select_base_currency(value)` | Selects a base currency by option value. |
| `select_target_currency(value)` | Selects a target currency by option value. |
| `swap_currencies()` | Clicks the swap control. |
| `convert()` | Submits the conversion form. |
| `get_converted_output()` | Reads the visible converted amount. |
| `get_rate_badge()` | Reads the visible rate badge. |
| `get_rate_source()` | Reads the live/cached source label. |
| `go_to_view(view)` | Clicks a named dashboard navigation link and waits for the matching panel to become visible. |
| `go_to_overview()`, `go_to_portfolio()`, `go_to_alerts()`, `go_to_trends()` | Convenience wrappers that select a fixed named view. |
| `is_favorites_empty()` | Checks for the empty-favourites state element. |
| `toggle_first_favorite()` | Waits for favorite stars and clicks the first one. |
| `toggle_candidate_favorite(pair)` | Clicks the saved-toggle control for a candidate pair after it becomes clickable. |
| `toggle_favorite_pair(pair)` | Clicks the toggle for a specific favorite pair in the overview. |
| `get_favorite_star_text(pair)` | Waits for a pair's toggle and reads its star text. |
| `get_first_favorite_star_text()` | Reads the first favourite star's text. |
| `get_favorite_card_texts()` | Returns visible text for favorite cards. |
| `get_favorite_pairs()` | Reads each card's `data-favorite-pair` attribute rather than relying on display spacing. |
| `wait_for_favorite_count(count, timeout=5)` | Waits until the favorite card count matches the expected value. |
| `add_portfolio_holding(currency, amount, notes="")` | Opens the modal, fills the holding form, submits it and waits for the modal to close. |
| `get_portfolio_list_texts()` | Returns text for portfolio rows. |
| `get_portfolio_count()` | Counts portfolio rows for stable add/remove assertions. |
| `wait_for_portfolio_count(count, timeout=5)` | Waits until the portfolio row count reaches the expected value. |
| `remove_portfolio_item(index=0)` | Clicks the remove button in the selected portfolio row. |
| `add_alert(base, quote, direction, target_rate)` | Opens the alert modal, selects pair/direction, enters the target and submits. |
| `get_alerts_list_texts()` | Returns visible text for alert rows. |
| `remove_alert_item(index=0)` | Clicks the remove button in the selected alert row. |
| `is_trend_chart_showing()` | Checks whether the chart SVG exists. |
| `get_trend_message()` | Reads the visible trend/threshold message for the empty state. |
| `wait_for_list_change(get_texts_fn, previous_texts, timeout=5)` | Waits until a supplied list reader returns content different from the previous state. |

## 11. Selenium library methods used

| Call | Purpose |
|---|---|
| `webdriver.Chrome(options=...)` | Starts Chrome for UI automation. |
| `Options.add_argument(...)` | Configures headless/container execution and the viewport size. |
| `driver.get(url)` | Navigates to a browser URL. |
| `driver.refresh()` | Reloads the page to check server-backed favourite persistence. |
| `driver.execute_script(...)` | Executes browser JavaScript; the fixture uses it to seed `localStorage`. |
| `driver.find_element(...)`, `driver.find_elements(...)` | Locates one element or a list of elements for interaction and count checks. |
| `element.click()`, `element.clear()`, `element.send_keys(...)` | Performs user-like interactions with browser controls. |
| `element.text`, `element.get_attribute(...)` | Reads visible text or an HTML attribute for assertions. |
| `WebDriverWait(driver, timeout).until(condition)` | Waits for a UI condition instead of assuming a transition is instantaneous. |
| `EC.element_to_be_clickable(...)` | Waits until a control can be clicked. |
| `EC.visibility_of_element_located(...)` | Waits until a target is visible. |
| `EC.invisibility_of_element_located(...)` | Waits for a modal to close. |
| `EC.url_contains(...)` | Waits for navigation to contain a path such as `/dashboard`. |
| `Select(element).select_by_value(value)` | Selects a dropdown option by its HTML value. |
| `By.ID`, `By.CSS_SELECTOR`, `By.TAG_NAME` | Specify stable locator strategies for controls, rows and options. |
| `driver.quit()` | Closes the WebDriver session during fixture cleanup. |

## 12. Running and interpreting the suite

From the repository root:

```bash
pytest -v
pytest tests/test_auth.py -v
pytest tests/test_conversion_service.py -v
pytest tests/test_dashboard_features_ui.py -v
pytest tests/test_registration_ui.py -v
pytest tests/test_ui.py -v
```

To target a configured deployed environment for UI tests:

```bash
pytest tests/test_ui.py -v --base-url=https://currency-exchange-tracker-app.onrender.com
```

Interpret results carefully:

- A passing test confirms the behavior asserted by that test; it does not prove all possible cases work.
- The negative portfolio amount test documents a known validation gap, not ideal business behavior.
- A skipped browser test is not a pass; investigate missing browser infrastructure.
- Service tests use fake provider responses to check deterministic logic, not the live availability of the exchange-rate service.
- The API `TestClient` exercises FastAPI in-process. Selenium UI tests drive a browser against the configured URL and require that target to be reachable.
- This commit adds explanations and documentation only. The test suite still needs to be run in the project's normal environment to confirm runtime results.
