# Currency Exchange Tracker

A full-stack currency conversion web application built with **Python, FastAPI, SQLAlchemy, Jinja2, HTML/CSS/JavaScript, and a React/Recharts trend widget**. It supports currency conversion using live exchange-rate data when available, a cached-rate fallback, and account-based features such as favourites, portfolio holdings, conversion history, rate trends, and target-rate alerts.

[![Automated Tests](https://github.com/thabo81/currency-exchange-tracker/actions/workflows/tests.yml/badge.svg)](https://github.com/thabo81/currency-exchange-tracker/actions/workflows/tests.yml)

> **Project focus:** Application development and QA automation practice. The repository includes Pytest API/backend tests, Selenium browser UI tests, test documentation, and a GitHub Actions workflow. Check the Actions tab for the latest CI result.

## Contents

- [Features](#features)
- [Technology Stack](#technology-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Running the Tests](#running-the-tests)
- [Testing Approach](#testing-approach)
- [CI Workflow](#ci-workflow)
- [Known Limitations](#known-limitations)
- [Documentation](#documentation)

## Features

### Currency conversion and exchange rates

- Convert between supported currencies.
- Retrieve current exchange-rate data from an external rate provider.
- Fall back to cached rates or built-in default rates when live rate retrieval is unavailable.
- Display rate information and update timestamps in the interface.
- View historical rate trends where rate-history data is available.

### User accounts and sessions

- Direct user registration without email verification.
- Login with password hashing and JWT-based access tokens.
- Refresh-token/session handling.
- Input validation and authentication error handling.

### Personal dashboard features

- Save and manage favourite currency pairs.
- Track currency holdings in a portfolio.
- Review recent conversion history.
- Create target-rate alerts.
- Use dashboard controls for common currency conversion actions.

> Rate alerts can be created and stored. Automated alert evaluation and notification delivery are not currently described as implemented features.

## Technology Stack

| Area | Technologies |
|---|---|
| Language | Python |
| Backend and HTTP API | FastAPI, Uvicorn |
| Database access | SQLAlchemy |
| Database options | SQLite for local/CI use; PostgreSQL can be configured |
| Frontend | Jinja2 templates, HTML, CSS, JavaScript, React, Recharts, Lucide React |
| Browser automation | Selenium WebDriver |
| Test framework | Pytest |
| API test utilities | FastAPI TestClient, HTTPX |
| Authentication | JWT, password hashing |
| Scheduling | APScheduler |
| CI | GitHub Actions |

## Project Structure

```text
currency-exchange-tracker/
├── frontend/
│   ├── package.json            # React/Recharts/Lucide widget dependencies
│   ├── tsconfig.json           # TypeScript settings for the widget
│   ├── vite.config.ts          # Builds the widget into app/static/
│   └── src/main.tsx            # Recharts trend widget entry point
├── app/
│   ├── main.py                 # FastAPI application and core routes
│   ├── auth.py                 # Authentication utilities
│   ├── database.py             # SQLAlchemy engine and database session
│   ├── dependencies.py         # Shared request dependencies
│   ├── models.py               # Database models
│   ├── schemas.py              # Request/response validation schemas
│   ├── services.py             # Exchange-rate retrieval and conversion logic
│   ├── rate_history_job.py     # Rate-history background job
│   ├── routers/                # Feature routes
│   ├── templates/              # Jinja2 HTML templates
│   └── static/                 # CSS and JavaScript
├── pages/
│   ├── base_page.py            # Shared Selenium page behaviour
│   ├── login_page.py           # Login/registration page object
│   └── dashboard_page.py       # Dashboard page object
├── tests/
│   ├── conftest.py             # Pytest fixtures and test setup
│   ├── test_auth.py            # Authentication and request-validation tests
│   ├── test_registration_ui.py # Direct-registration UI tests
│   ├── test_ui.py              # UI tests
│   └── test_dashboard_features_ui.py
├── docs/
│   ├── TEST_PLAN.md            # Test scope, approach, and planned coverage
│   └── DEFECT_LOG.md           # Structured defect documentation
├── .github/workflows/
│   └── tests.yml               # GitHub Actions test workflow
├── requirements.txt
└── README.md
```

## Getting Started

### Prerequisites

- Python 3.12 or a compatible Python version.
- Google Chrome for Selenium browser tests.
- Git.
- Node.js 20+ and npm for the React/Recharts trend widget.

### 1. Clone the repository

```bash
git clone https://github.com/thabo81/currency-exchange-tracker.git
cd currency-exchange-tracker
```

### 2. Create and activate a virtual environment

**Windows (PowerShell):**

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
```

**macOS/Linux:**

```bash
python3 -m venv .venv
source .venv/bin/activate
```

### 3. Install dependencies

```bash
python -m pip install --upgrade pip
pip install -r requirements.txt
```

### 4. Build the dashboard trend widget

The dashboard Trend screen uses **Recharts** for the actual chart and **Lucide React** for chart/status icons. The widget is compiled into `app/static/trend-widget` and loaded by the FastAPI dashboard template.

From the repository root:

```bash
cd frontend
npm install recharts lucide-react
npm install
npm run typecheck
npm run build
cd ..
```

The explicit `npm install recharts lucide-react` command installs the requested chart and icon packages; the following `npm install` installs the remaining React/Vite build dependencies declared in `frontend/package.json`.

After the build completes, start FastAPI normally:

```bash
uvicorn app.main:app --reload
```

The generated bundle is required for the Trends chart to render locally. CI builds it automatically before running the Python/Selenium test suite.

### 4. Configure environment variables

The application defaults to a local SQLite database, so a database URL is not required for a basic local run. Create a `.env` file in the project root if you need to override settings:

```env
DATABASE_URL=sqlite:///./currency_exchange.db
JWT_SECRET=replace_with_a_local_development_secret
# Optional: configure a rate provider key if required by your provider
RATE_API_KEY=
```

Use a strong secret in any deployed environment. Do not commit real credentials or API keys to Git.

For PostgreSQL, set `DATABASE_URL` to your PostgreSQL connection string and ensure the database is available. Review the application's current database setup before applying migrations; do not assume a migration command is required for every local setup.

### 5. Start the application

From the repository root, run:

```bash
uvicorn app.main:app --reload
```

Open [http://localhost:8000](http://localhost:8000) in your browser.

## Running the Tests

Run the complete test suite from the repository root:

```bash
pytest -v
```

Run individual test modules when debugging:

```bash
pytest tests/test_auth.py -v
pytest tests/test_registration_ui.py -v
pytest tests/test_ui.py -v
pytest tests/test_dashboard_features_ui.py -v
```

The suite includes API/backend tests and Selenium browser tests. Browser tests require Chrome and a compatible ChromeDriver/browser setup. Some dashboard UI tests use a separately running application through `BASE_URL` or `--base-url`.

To point those tests at a running local application, start the server in one terminal:

```bash
uvicorn app.main:app --reload
```

Then run the relevant test module in another terminal, for example:

```bash
pytest tests/test_dashboard_features_ui.py -v --base-url http://localhost:8000
```

Test setup and environment requirements are defined in `tests/conftest.py`. If tests fail, read the first failure and its traceback before changing the application or test setup.

## Testing Approach

The project uses a mix of test techniques and automation patterns:

- **Functional testing:** Validate user-visible behaviour and application responses.
- **API/backend testing:** Exercise endpoints using FastAPI's `TestClient` and HTTPX.
- **UI automation:** Use Selenium WebDriver to interact with pages in a browser.
- **Page Object Model (POM):** Keep page locators and common browser interactions in reusable page classes.
- **Negative and boundary testing:** Check invalid inputs and authentication and token-security edge cases.
- **Regression testing:** Re-run automated checks after changes to help identify unintended behaviour.
- **Test fixtures:** Use Pytest fixtures to configure clients, browsers, and test data.
- **Defect documentation:** Record reproduction steps, expected/actual results, severity, priority, and investigation notes.

The test plan contains additional scope and test ideas. Items described as planned in that document should not be interpreted as completed testing unless test evidence has been recorded.

## CI Workflow

The GitHub Actions workflow in `.github/workflows/tests.yml` is configured to run when code is pushed to `main` or a pull request targets `main`. It:

1. Checks out the repository.
2. Sets up Python.
3. Installs Chrome and project dependencies.
4. Starts the FastAPI application.
5. Runs `pytest -v`.
6. Prints application logs if the job fails.

View the [workflow runs](https://github.com/thabo81/currency-exchange-tracker/actions/workflows/tests.yml) for the current status and failure details. The workflow being configured does not, by itself, mean every run is passing.

## Known Limitations

- Live exchange-rate retrieval depends on the external provider and network availability; cached/default rates are used as fallbacks.
- Rate alerts are stored, but automated rate evaluation and notification delivery are not currently implemented.
- The test plan includes proposed performance/load testing. Do not treat that work as completed unless results and test evidence are added.
- CI results can vary as the application and tests change. Use the Actions tab to check the latest run.

## Documentation

- [Test Plan](docs/TEST_PLAN.md)
- [Defect Log](docs/DEFECT_LOG.md)
- [GitHub Actions](https://github.com/thabo81/currency-exchange-tracker/actions)

## Author

**Thabo Addy Mahlangu**

- GitHub: [@thabo81](https://github.com/thabo81)
