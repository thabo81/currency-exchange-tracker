from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import Select
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
    NAV_PILL_OVERVIEW = (By.CSS_SELECTOR, '.nav-pill[data-panel="overview-panel"]')
    NAV_PILL_PORTFOLIO = (By.CSS_SELECTOR, '.nav-pill[data-panel="portfolio-panel"]')
    NAV_PILL_ALERTS = (By.CSS_SELECTOR, '.nav-pill[data-panel="alerts-panel"]')
 
    FAVORITE_TOGGLE = (By.ID, "favorite-toggle")
    FAVORITE_CHIPS = (By.CSS_SELECTOR, "#favorite-chips .chip")
 
    PORTFOLIO_PANEL = (By.ID, "portfolio-panel")
    PORTFOLIO_CURRENCY_INPUT = (By.ID, "portfolio-currency")
    PORTFOLIO_AMOUNT_INPUT = (By.ID, "portfolio-amount")
    PORTFOLIO_NOTES_INPUT = (By.ID, "portfolio-notes")
    PORTFOLIO_SUBMIT = (By.CSS_SELECTOR, "#portfolio-form button[type='submit']")
    PORTFOLIO_LIST_ITEMS = (By.CSS_SELECTOR, "#portfolio-list li")
 
    ALERTS_PANEL = (By.ID, "alerts-panel")
    ALERT_BASE = (By.ID, "alert-base")
    ALERT_QUOTE = (By.ID, "alert-quote")
    ALERT_DIRECTION = (By.ID, "alert-direction")
    ALERT_TARGET_INPUT = (By.ID, "alert-target")
    ALERT_SUBMIT = (By.CSS_SELECTOR, "#alert-form button[type='submit']")
    ALERTS_LIST_ITEMS = (By.CSS_SELECTOR, "#alerts-list li")
 
    SPARKLINE = (By.ID, "sparkline")

    
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

    def go_to_portfolio(self):
        self.click(*self.NAV_PILL_PORTFOLIO)
        WebDriverWait(self.driver, 5).until(EC.visibility_of_element_located(self.PORTFOLIO_PANEL))
 
    def go_to_alerts(self):
        self.click(*self.NAV_PILL_ALERTS)
        WebDriverWait(self.driver, 5).until(EC.visibility_of_element_located(self.ALERTS_PANEL))
 
    def go_to_overview(self):
        self.click(*self.NAV_PILL_OVERVIEW)
 
    def toggle_favorite(self):
        self.click(*self.FAVORITE_TOGGLE)
 
    def get_favorite_star_text(self):
        return self.get_text(*self.FAVORITE_TOGGLE)
 
    def get_favorite_chip_texts(self):
        return [el.text for el in self.driver.find_elements(*self.FAVORITE_CHIPS)]
 
    def click_favorite_chip(self, index=0):
        self.driver.find_elements(*self.FAVORITE_CHIPS)[index].click()
 
    def add_portfolio_holding(self, currency: str, amount: str, notes: str = ""):
        self.type(*self.PORTFOLIO_CURRENCY_INPUT, currency)
        self.type(*self.PORTFOLIO_AMOUNT_INPUT, amount)
        if notes:
            self.type(*self.PORTFOLIO_NOTES_INPUT, notes)
        self.click(*self.PORTFOLIO_SUBMIT)
 
    def get_portfolio_list_texts(self):
        return [el.text for el in self.driver.find_elements(*self.PORTFOLIO_LIST_ITEMS)]
 
    def remove_portfolio_item(self, index=0):
        item = self.driver.find_elements(*self.PORTFOLIO_LIST_ITEMS)[index]
        item.find_element(By.CSS_SELECTOR, "button").click()
 
    def add_alert(self, base: str, quote: str, direction: str, target_rate: str):
        Select(self.driver.find_element(*self.ALERT_BASE)).select_by_value(base)
        Select(self.driver.find_element(*self.ALERT_QUOTE)).select_by_value(quote)
        Select(self.driver.find_element(*self.ALERT_DIRECTION)).select_by_value(direction)
        self.type(*self.ALERT_TARGET_INPUT, target_rate)
        self.click(*self.ALERT_SUBMIT)
 
    def get_alerts_list_texts(self):
        return [el.text for el in self.driver.find_elements(*self.ALERTS_LIST_ITEMS)]
 
    def remove_alert_item(self, index=0):
        item = self.driver.find_elements(*self.ALERTS_LIST_ITEMS)[index]
        item.find_element(By.CSS_SELECTOR, "button").click()
 
    def is_sparkline_showing_chart(self) -> bool:
        return len(self.driver.find_elements(By.CSS_SELECTOR, "#sparkline svg")) > 0
 
    def get_sparkline_text(self):
        return self.get_text(*self.SPARKLINE)

    def wait_for_favorite_chip_count(self, expected_count: int, timeout: int = 5):
        WebDriverWait(self.driver, timeout).until(
            lambda d: len(self.get_favorite_chip_texts()) == expected_count
        )
 
    def wait_for_list_change(self, get_texts_fn, previous_texts, timeout: int = 5):
        WebDriverWait(self.driver, timeout).until(
            lambda d: get_texts_fn() != previous_texts
        )
