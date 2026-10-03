import time
import pytest

from pages.login_page import LoginPage
from pages.dashboard_page import DashboardPage


def test_currency_conversion_ui(browser, base_url):
    login_page = LoginPage(browser, base_url)
    login_page.open_login()
    time.sleep(1)
    assert "Currency Exchange" in browser.page_source

    dashboard_page = DashboardPage(browser, base_url)
    dashboard_page.open_dashboard()
    time.sleep(1)

    # 🔄 STRUCTURAL FIX: Click the navigation tab/sidebar link to open the Convert View
    # If your page object uses a different method name (e.g. go_to_convert), match it here.
    if hasattr(dashboard_page, 'go_to_convert'):
        dashboard_page.go_to_convert()
    elif hasattr(dashboard_page, 'click_nav_tab'):
        dashboard_page.click_nav_tab('CONVERT')
    else:
        # Fallback inline selector text click if no explicit page helper exists yet
        from selenium.webdriver.common.by import By
        browser.find_element(By.XPATH, "//*[contains(text(), 'Convert')]").click()
    
    # Allow the layout panel animation state to render the inputs cleanly
    time.sleep(0.5)

    # Proceed with the conversion transaction sequence
    dashboard_page.enter_amount("1000")
    dashboard_page.convert()
    time.sleep(1)

    value = dashboard_page.get_converted_output()
    assert value

    dashboard_page.swap_currencies()
    time.sleep(1)
    assert dashboard_page.get_converted_output()

