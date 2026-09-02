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

    dashboard_page.enter_amount("1000")
    dashboard_page.convert()
    time.sleep(1)

    value = dashboard_page.get_converted_output()
    assert value

    dashboard_page.swap_currencies()
    time.sleep(1)
    assert dashboard_page.get_converted_output()
