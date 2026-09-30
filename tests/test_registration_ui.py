import uuid

from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

from pages.login_page import LoginPage


def test_registration_returns_to_login_without_verification(browser, base_url):
    """Successful registration returns to login; no verification panel is needed."""
    login_page = LoginPage(browser, base_url)
    email = f"selenium-{uuid.uuid4().hex[:10]}@example.com"
    login_page.open_login()
    login_page.register(
        first_name="Selenium",
        surname="Test",
        email=email,
        country="South Africa",
        password="StrongPass1!",
    )

    # Wait for the UI state transition rather than relying on message rendering timing.
    WebDriverWait(browser, 10).until(
        lambda driver: "active" in driver.find_element(By.ID, "login-panel").get_attribute("class")
    )
    assert "registration successful" in login_page.get_auth_message().lower()
    assert not browser.find_elements(By.ID, "otp-panel")


def test_registered_user_can_log_in_from_ui(browser, base_url):
    """The login form submits credentials and navigates to the dashboard."""
    login_page = LoginPage(browser, base_url)
    email = f"selenium-{uuid.uuid4().hex[:10]}@example.com"
    login_page.open_login()
    login_page.register(
        first_name="Selenium",
        surname="Login",
        email=email,
        country="South Africa",
        password="StrongPass1!",
    )

    # Registration must return the browser to the login form before sign-in.
    WebDriverWait(browser, 10).until(
        lambda driver: "active" in driver.find_element(By.ID, "login-panel").get_attribute("class")
    )
    assert "registration successful" in login_page.get_auth_message().lower()
    login_page.login(email=email, password="StrongPass1!")
    WebDriverWait(browser, 10).until(EC.url_contains("/dashboard"))
    assert "/dashboard" in browser.current_url
