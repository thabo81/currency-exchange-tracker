import time
import uuid
 
import pytest
 
from pages.login_page import LoginPage
 
 
def _register_new_user(login_page: LoginPage) -> str:
    """Registers a unique user and returns the email used, leaving the
    browser on the otp-panel afterward."""
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
    # Allow a small tolerance for page load/render time between submit and read
    assert 75 <= timer_value <= 90
 
 
def test_countdown_actually_decreases(browser, base_url):
    login_page = LoginPage(browser, base_url)
    _register_new_user(login_page)
 
    first_reading = login_page.get_timer_seconds()
    time.sleep(3)
    second_reading = login_page.get_timer_seconds()
 
    assert second_reading < first_reading
    # roughly 3 seconds should have elapsed, allow some tolerance
    assert first_reading - second_reading >= 2
 
 
def test_invalid_code_shows_inline_error(browser, base_url):
    login_page = LoginPage(browser, base_url)
    _register_new_user(login_page)
 
    login_page.submit_otp("ZZZZZZ")
 
    assert login_page.is_otp_error_visible()
    error_text = login_page.get_otp_error_text()
    assert error_text  # non-empty — exact wording comes from the API's error detail
    # the modal should still be showing, not redirected away
    assert "otp-panel" in browser.page_source
 
 
def test_resend_resets_the_timer(browser, base_url):
    login_page = LoginPage(browser, base_url)
    _register_new_user(login_page)
 
    time.sleep(5)
    before_resend = login_page.get_timer_seconds()
    assert before_resend <= 25  # confirm it actually ticked down first
 
    login_page.click_resend()
    time.sleep(1)  # brief pause for the resend request + UI update
    after_resend = login_page.get_timer_seconds()
 
    assert after_resend > before_resend
    assert after_resend >= 88  # should be back near 90
 
 
@pytest.mark.slow
def test_code_expires_and_inputs_disable(browser, base_url):
    """
    This test genuinely waits out the full 90-second window — it's slow
    by design, since it's the only way to observe the real expiry
    behavior end-to-end in the browser rather than assuming it works
    based on the countdown display alone. Run this one deliberately,
    not as part of every quick local test run.
    """
    login_page = LoginPage(browser, base_url)
    _register_new_user(login_page)
 
    time.sleep(31)
 
    assert login_page.get_timer_seconds() == 0
    assert login_page.are_otp_inputs_disabled()
    assert login_page.is_otp_error_visible()
