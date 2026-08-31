import time

import pytest


@pytest.mark.skip(reason="Selenium UI smoke tests require a local running server and ChromeDriver.")
def test_currency_conversion_ui(browser):
    browser.get("http://localhost:8000")
    time.sleep(1)
    assert "Currency Exchange" in browser.page_source

    browser.get("http://localhost:8000/dashboard")
    time.sleep(1)
    amount_input = browser.find_element("id", "amount-input")
    amount_input.clear()
    amount_input.send_keys("1000")
    browser.find_element("id", "convert-button").click()
    time.sleep(1)

    value = browser.find_element("id", "converted-output").text
    assert value

    browser.find_element("id", "swap-currency").click()
    time.sleep(1)
    assert browser.find_element("id", "converted-output").text
