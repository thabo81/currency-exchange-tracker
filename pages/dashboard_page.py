from selenium.webdriver.common.by import By

from pages.base_page import BasePage


class DashboardPage(BasePage):
    AMOUNT_INPUT = (By.ID, "amount-input")
    BASE_CURRENCY = (By.ID, "base-currency")
    TARGET_CURRENCY = (By.ID, "target-currency")
    SWAP_BUTTON = (By.ID, "swap-currency")
    CONVERT_BUTTON = (By.ID, "convert-button")
    CONVERTED_OUTPUT = (By.ID, "converted-output")
    RATE_BADGE = (By.ID, "rate-badge")
    RATE_SOURCE = (By.ID, "rate-source")
    HISTORY_LIST = (By.CSS_SELECTOR, "#history-list li")

    
    def open_dashboard(self):
        self.open(f"{self.base_url}/dashboard")

    def enter_amount(self, amount: str):
        self.type(*self.AMOUNT_INPUT, amount)

    def select_base_currency(self, value: str):
        self.driver.find_element(*self.BASE_CURRENCY).send_keys(value)

    def select_target_currency(self, value: str):
        self.driver.find_element(*self.TARGET_CURRENCY).send_keys(value)

    def swap_currencies(self):
        self.click(*self.SWAP_BUTTON)

    def convert(self):
        self.click(*self.CONVERT_BUTTON)

    def get_converted_output(self):
        return self.get_text(*self.CONVERTED_OUTPUT)

    def get_rate_badge(self):
        return self.get_text(*self.RATE_BADGE)

    def get_rate_source(self):
        return self.get_text(*self.RATE_SOURCE)
