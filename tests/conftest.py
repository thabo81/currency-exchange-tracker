"""Shared pytest fixtures for API, database, and Selenium browser tests."""

import os
import sys
import httpx
from pathlib import Path

# Keep project imports stable when tests run from the repository root or CI workspace.
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

# Default test settings are intentionally non-production; an existing environment value is preserved.
os.environ.setdefault("DATABASE_URL", "sqlite:///./test_currency.db")
# Use a dedicated non-production signing key for automated tests.
os.environ.setdefault("JWT_SECRET", "test-only-secret-do-not-use-in-production")

import pytest
from fastapi.testclient import TestClient
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base
from app.main import app

# Give tests a dedicated SQLite engine so API assertions do not depend on the deployed database.
engine = create_engine("sqlite:///./test_currency.db", connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

import app.database as database_module

# Replace the application database handles with the test engine before requests execute.
database_module.engine = engine
database_module.SessionLocal = TestingSessionLocal
# Create the mapped tables needed by the test suite in the dedicated SQLite database.
Base.metadata.create_all(bind=engine)

def pytest_addoption(parser):
    """Register a CLI override so UI automation can target local or deployed environments."""
    parser.addoption(
        "--base-url",
        action="store",
        default=None,
        help="Base URL of the application under test",
    )


@pytest.fixture(scope="session")
def base_url(request: pytest.FixtureRequest):
    """Resolve the target URL in priority order: --base-url, BASE_URL, then local development."""
    cli_value = request.config.getoption("--base-url")
    if cli_value:
        return cli_value.rstrip("/")
    return os.getenv("BASE_URL", "http://localhost:8000").rstrip("/")

@pytest.fixture(scope="function")
def client():
    """Provide an in-process FastAPI client and reset test tables after each test using this fixture."""
    with TestClient(app) as test_client:
        yield test_client

    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)


@pytest.fixture(scope="function")
def browser():
    """Start headless Chrome for UI tests, or skip clearly when Chrome WebDriver is unavailable."""
    options = Options()
    options.add_argument("--headless=new")
    options.add_argument("--window-size=1920,1080")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    try:
        driver = webdriver.Chrome(options=options)
    except Exception:
        pytest.skip("Chrome WebDriver is not available in this environment.")

    yield driver
    driver.quit()

@pytest.fixture
def authenticated_session(browser, base_url):
    """Register and log in through the running app, then seed browser auth state."""
    import uuid

    # A unique email prevents one browser test from colliding with data left by another run.
    email = f"dashboard-{uuid.uuid4().hex[:10]}@example.com"
    password = "StrongPass1!"

    # Create the user through the same HTTP base URL that the browser will visit.
    with httpx.Client(base_url=base_url) as api_client:
        register_response = api_client.post(
            "/register",
            json={
                "email": email,
                "password": password,
                "first_name": "Dash",
                "surname": "Board",
                "country": "South Africa",
            },
        )
        assert register_response.status_code == 200, register_response.text

        login_response = api_client.post("/login", json={"email": email, "password": password})
        assert login_response.status_code == 200, login_response.text
        login_data = login_response.json()

    browser.get(f"{base_url}/dashboard")
    # Seed browser localStorage with the returned tokens so the dashboard opens authenticated.
    browser.execute_script(
        """
        window.localStorage.setItem('access_token', arguments[0]);
        window.localStorage.setItem('refresh_token', arguments[1]);
        window.localStorage.setItem('current_user', JSON.stringify(arguments[2]));
        """,
        login_data["access_token"],
        login_data["refresh_token"],
        login_data["user"],
    )
    browser.refresh()

    return browser
