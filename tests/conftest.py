import os
import sys
import httpx
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

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

engine = create_engine("sqlite:///./test_currency.db", connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

import app.database as database_module

database_module.engine = engine
database_module.SessionLocal = TestingSessionLocal
Base.metadata.create_all(bind=engine)

def pytest_addoption(parser):
    parser.addoption(
        "--base-url",
        action="store",
        default=None,
        help="Base URL of the application under test",
    )


@pytest.fixture(scope="session")
def base_url(request: pytest.FixtureRequest):
    cli_value = request.config.getoption("--base-url")
    if cli_value:
        return cli_value.rstrip("/")
    return os.getenv("BASE_URL", "http://localhost:8000").rstrip("/")

@pytest.fixture(scope="function")
def client():
    with TestClient(app) as test_client:
        yield test_client

    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)


@pytest.fixture(scope="function")
def browser():
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

    email = f"dashboard-{uuid.uuid4().hex[:10]}@example.com"
    password = "StrongPass1!"

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
        token = login_response.json()["access_token"]

    browser.get(f"{base_url}/dashboard")
    browser.execute_script("window.localStorage.setItem('access_token', arguments[0]);", token)
    browser.refresh()

    return browser
