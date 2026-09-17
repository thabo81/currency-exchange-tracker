import time
import uuid

import pytest
from selenium.webdriver.support.ui import WebDriverWait

from pages.login_page import LoginPage


def _register_new_user(login_page: LoginPage) -> str:
    email = f"selenium-{uuid.uuid4().hex[:10]}@example.com"
    login_page.open_login()
    login_page.register(
        first_name="Selenium",
        surname="Test",
        email=email,
        country="South Africa",
        password="StrongPass1!",
    )
    login_page.wait_for_otp_panel()
    return email


def test_verification_modal_appears_immediately_after_registration(browser, base_url):
    login_page = LoginPage(browser, base_url)
    _register_new_user(login_page)

    assert "otp-panel" in browser.page_source
    timer_value = login_page.get_timer_seconds()
    # 90-second TTL — allow a small tolerance for page load/render time
    assert 85 <= timer_value <= 90


def test_countdown_actually_decreases(browser, base_url):
    login_page = LoginPage(browser, base_url)
    _register_new_user(login_page)

    first_reading = login_page.get_timer_seconds()
    time.sleep(3)
    second_reading = login_page.get_timer_seconds()

    assert second_reading < first_reading
    assert first_reading - second_reading >= 2


def test_invalid_code_shows_inline_error(browser, base_url):
    login_page = LoginPage(browser, base_url)
    _register_new_user(login_page)

    login_page.submit_otp("ZZZZZZ")

    # Wait for the async verify-code request to actually fail and render
    # the error, rather than asserting immediately after the click
    WebDriverWait(browser, 5).until(
        lambda d: login_page.is_otp_error_visible()
    )

    error_text = login_page.get_otp_error_text()
    assert error_text
    assert "otp-panel" in browser.page_source


def test_resend_resets_the_timer(browser, base_url):
    login_page = LoginPage(browser, base_url)
    _register_new_user(login_page)

    time.sleep(5)
    before_resend = login_page.get_timer_seconds()
    assert before_resend <= 85  # confirm it actually ticked down first

    login_page.click_resend()
    time.sleep(1)
    after_resend = login_page.get_timer_seconds()

    assert after_resend > before_resend
    assert after_resend >= 88  # should be back near 90


@pytest.mark.slow
def test_code_expires_and_inputs_disable(browser, base_url):
    """
    Genuinely waits out the full 90-second window. Slow by design —
    run this deliberately, not as part of every quick local test run.
    """
    login_page = LoginPage(browser, base_url)
    _register_new_user(login_page)

    time.sleep(91)

    assert login_page.get_timer_seconds() == 0
    assert login_page.are_otp_inputs_disabled()
    assert login_page.is_otp_error_visible()
