import os
import sys
import httpx
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

import pytest
from fastapi.testclient import TestClient
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base
from app.main import app

os.environ.setdefault("DATABASE_URL", "sqlite:///./test_currency.db")

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
def captured_emails(monkeypatch):
    """
    Intercepts send_challenge_email so tests can grab the real code
    without needing an actual inbox. This is the standard pattern for
    testing anything delivered out-of-band (email, SMS) — mock the
    delivery function and capture what it was called with.
    """
    sent = []
 
    def fake_send_challenge_email(email, code):
        sent.append({"email": email, "code": code})
 
    monkeypatch.setattr("app.main.send_challenge_email", fake_send_challenge_email)
    return sent

@pytest.fixture
def authenticated_session(browser, base_url):
    """
    Local-only fixture: registers a user via the real API, then verifies
    them by writing directly to the test database (bypassing the actual
    email flow, which already has its own dedicated tests in test_auth.py
    and test_registration_ui.py — this fixture is purely about getting a
    logged-in session for testing OTHER features, not re-testing verification
    itself). Logs in via the real API and injects the resulting access_token
    into the browser's localStorage.
 
    Only works when the Selenium browser is pointed at the SAME database
    the pytest process can reach directly (i.e. local runs). Not usable
    against the deployed Render environment.
    """
    import uuid
    from app.database import SessionLocal
    from app.models import User
 
    email = f"dashboard-{uuid.uuid4().hex[:10]}@example.com"
    password = "StrongPass1!"
 
    with httpx.Client(base_url=base_url) as client:
        client.post(
            "/register",
            json={
                "email": email,
                "password": password,
                "first_name": "Dash",
                "surname": "Board",
                "country": "South Africa",
            },
        )
 
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        user.is_verified = True
        db.commit()
    finally:
        db.close()
 
    with httpx.Client(base_url=base_url) as client:
        login_response = client.post("/login", json={"email": email, "password": password})
        token = login_response.json()["access_token"]
 
    browser.get(f"{base_url}/dashboard")
    browser.execute_script(f"window.localStorage.setItem('access_token', '{token}');")
    browser.refresh()
 
    return browser