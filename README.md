# Currency Exchange Tracker

A robust, full-stack currency exchange application designed for real-time rate lookups, offline resilience, and secure user management. This project demonstrates modern UI principles alongside a highly resilient backend featuring JWT authentication, automated rate caching, and comprehensive error handling.

## 🚀 Core Features

### 🔐 Authentication & Security

* **User Onboarding:** Collects Email, First & Last Name, Password, and Country of Residence.
* **Email Verification:** Dispatches a 6-digit OTP to the user's email to verify account ownership before first login.
* **Modern Login UI:** Aesthetically pleasing interface with password visibility toggles and clear error state highlights.
* **Secure Sessions:** Utilizes bcrypt for password hashing and short-lived JWTs (15-minute expiry) for active sessions.
* **"Remember Me" Auto-Login:** Implements persistent device login using cryptographically secure refresh tokens stored on the device, complete with automatic token rotation upon each use.

### 💱 Exchange & Dashboard Engine

* **Instant Converter:** Auto-focused numeric input (capped at 12 digits) with a central one-tap swap toggle.
* **Curated Selection:** Prioritizes top currencies (USD, ZAR, EUR, JPY, GBP, CHF) in the dropdowns for speed, while supporting mathematical conversions for 140+ global currencies via the backend.
* **Live Conversion Output:** Large, real-time output display applying currency-specific rounding rules (e.g., 2 decimal places for standard currencies).
* **Trust & Metadata:** Displays the explicit 1-unit base rate, a "Last Updated" timestamp, and a visual network badge indicating if rates are live or served from the offline cache. Includes a manual pull-to-refresh action.
* **Shortcuts & History:** Features tappable quick-select favorite chips, a sparkline trend graph (7/30 days), and a log of the last 3-5 conversions.

### ⚙️ Advanced Utilities

* **Multi-Currency Matrix:** Convert a single base amount across 5+ target currencies simultaneously.
* **Custom Rate Alerts:** Background worker system monitoring market fluctuations to trigger push notifications (e.g., "Alert me when 1 USD drops below 18.00 ZAR").

---

## 🛠️ Tech Stack & Architecture

* **Backend / REST API:** Python (FastAPI / Flask)
* **Database:** PostgreSQL with SQLAlchemy ORM
* **Security:** bcrypt, JSON Web Tokens (JWT)
* **Frontend:** Modern UI framework (React / Flutter)
* **Testing & QA:** PyTest (Backend/API), Selenium WebDriver (End-to-End UI Automation)

---

## 🗄️ Database Schema

### `users` Table

Handles profile data and primary credentials with $O(1)$ lookup via indexed email.

* `user_id`: UUID (Primary Key)
* `email`: VARCHAR (Unique, Indexed)
* `password_hash`: VARCHAR (Bcrypt hashed)
* `first_name` & `surname`: VARCHAR
* `country`: VARCHAR
* `is_verified`: BOOLEAN (Default: False)

### `user_sessions` Table

Manages secure device state and token rotation. Uses ON DELETE CASCADE to clear tokens if a user account is removed.

* `session_id`: UUID (Primary Key)
* `user_id`: UUID (Foreign Key)
* `token_hash`: VARCHAR (Indexed)
* `expires_at`: TIMESTAMP (e.g., 30 days)

---

## 🛡️ Error Handling & System Resilience

* **Authentication Safety:** Returns a unified "Invalid email or password" (401 Unauthorized) to prevent user enumeration. Duplicate registrations cleanly return a 409 Conflict.
* **Session Management:** Expired refresh tokens are actively purged from the database and the user is securely redirected to the login screen.
* **Database Integrity:** All SQL operations are wrapped in TRY...EXCEPT blocks containing explicit db.rollback() executions on failure, returning a clean 500 Internal Server Error without exposing stack traces.
* **Input Validation:** Front-end logic strictly enforces numeric entry, prevents integer overflow, and catches negative inputs before API triggers.

---

## 💻 Local Setup & Installation

**1. Clone the Repository**

```bash
git clone https://github.com/thabo81/currency-exchange-tracker.git
cd currency-exchange-tracker

```

**2. Configure Environment Variables**
Create a `.env` file in the root directory:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/currency_db
JWT_SECRET=your_super_secret_key
RATE_API_KEY=your_exchange_rate_provider_key

```

**3. Initialize the Backend Environment**

```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

pip install -r requirements.txt

# Execute database migrations
alembic upgrade head

```

**4. Start the Application**

```bash
# Start the Python REST API server
uvicorn main:app --reload

```

---

## 🧪 Testing

This project emphasizes test-driven reliability. The suite covers database transactions, authentication flows, REST API rate mocked failures, and Selenium Page Object Model (POM) UI automation.

```bash
# Run backend unit and API integration tests
pytest tests/api/ -v

# Execute Selenium End-to-End UI automation
pytest tests/ui/ -v

```
