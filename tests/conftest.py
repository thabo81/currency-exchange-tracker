import os
from pathlib import Path

import pytest
import sys
from fastapi.testclient import TestClient
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base
from app.main import app

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
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
def base_url(request):
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
