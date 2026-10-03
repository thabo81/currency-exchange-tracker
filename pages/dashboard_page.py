from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import Select, WebDriverWait

from pages.base_page import BasePage


class DashboardPage(BasePage):
    """Page object for the premium dashboard UI."""

    AMOUNT_INPUT = (By.ID, "amount-input")
    BASE_CURRENCY = (By.ID, "base-currency")
    TARGET_CURRENCY = (By.ID, "target-currency")
    SWAP_BUTTON = (By.ID, "swap-currency")
    CONVERT_BUTTON = (By.CSS_SELECTOR, "#convert-form button[type='submit']")
    CONVERTED_OUTPUT = (By.ID, "converted-output")
    RATE_BADGE = (By.ID, "rate-badge")
    RATE_SOURCE = (By.ID, "rate-source")

    FAVORITE_STARS = (By.CSS_SELECTOR, "#overview-pairs .star-button")
    FAVORITE_CARDS = (By.CSS_SELECTOR, "#overview-pairs .pair-card")

    PORTFOLIO_PANEL = (By.ID, "view-portfolio")
    PORTFOLIO_OPEN = (By.ID, "open-holding-modal")
    PORTFOLIO_CURRENCY_INPUT = (By.ID, "holding-currency")
    PORTFOLIO_AMOUNT_INPUT = (By.ID, "holding-amount")
    PORTFOLIO_LABEL_INPUT = (By.ID, "holding-label")
    PORTFOLIO_SUBMIT = (By.CSS_SELECTOR, "#holding-form button[type='submit']")
    PORTFOLIO_ROWS = (By.CSS_SELECTOR, "#portfolio-list .table-row")
    PORTFOLIO_MODAL = (By.ID, "holding-modal")

    ALERTS_PANEL = (By.ID, "view-alerts")
    ALERT_OPEN = (By.ID, "open-alert-modal")
    ALERT_PAIR = (By.ID, "alert-pair")
    ALERT_DIRECTION = (By.ID, "alert-direction")
    ALERT_TARGET_INPUT = (By.ID, "alert-target")
    ALERT_SUBMIT = (By.CSS_SELECTOR, "#alert-create-form button[type='submit']")
    ALERT_ROWS = (By.CSS_SELECTOR, "#alerts-list .alert-card")

    TREND_CHART = (By.CSS_SELECTOR, "#trend-chart svg")
    TREND_MESSAGE = (By.ID, "trend-threshold-message")

    def open_dashboard(self):
        self.open(f"{self.base_url}/dashboard")

    def enter_amount(self, amount: str):
        self.type(*self.AMOUNT_INPUT, amount)

    def select_base_currency(self, value: str):
        Select(self.driver.find_element(*self.BASE_CURRENCY)).select_by_value(value)

    def select_target_currency(self, value: str):
        Select(self.driver.find_element(*self.TARGET_CURRENCY)).select_by_value(value)

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

    def go_to_view(self, view: str):
        locator = (By.CSS_SELECTOR, f'.nav-link[data-view="{view}"]')
        self.click(*locator)
        WebDriverWait(self.driver, 5).until(
            EC.visibility_of_element_located((By.ID, f"view-{view}"))
        )

    def go_to_overview(self):
        self.go_to_view("overview")

    def go_to_portfolio(self):
        self.go_to_view("portfolio")

    def go_to_alerts(self):
        self.go_to_view("alerts")

    def go_to_trends(self):
        self.go_to_view("trends")

    def toggle_first_favorite(self):
        self.driver.find_elements(*self.FAVORITE_STARS)[0].click()

    def get_first_favorite_star_text(self):
        return self.driver.find_elements(*self.FAVORITE_STARS)[0].text

    def get_favorite_card_texts(self):
        return [element.text for element in self.driver.find_elements(*self.FAVORITE_CARDS)]

    def add_portfolio_holding(self, currency: str, amount: str, notes: str = ""):
        self.click(*self.PORTFOLIO_OPEN)
        WebDriverWait(self.driver, 5).until(
            EC.visibility_of_element_located(self.PORTFOLIO_MODAL)
        )

        self.driver.find_element(*self.PORTFOLIO_CURRENCY_INPUT).send_keys(currency)
        self.type(*self.PORTFOLIO_AMOUNT_INPUT, amount)
        if notes:
            self.type(*self.PORTFOLIO_LABEL_INPUT, notes)
        self.click(*self.PORTFOLIO_SUBMIT)

        WebDriverWait(self.driver, 5).until(
            EC.invisibility_of_element_located(self.PORTFOLIO_MODAL)
        )

    def get_portfolio_list_texts(self):
        return [el.text for el in self.driver.find_elements(*self.PORTFOLIO_ROWS)]

    def remove_portfolio_item(self, index=0):
        row = self.driver.find_elements(*self.PORTFOLIO_ROWS)[index]
        row.find_element(By.CSS_SELECTOR, "button[data-remove-holding]").click()

    def add_alert(self, base: str, quote: str, direction: str, target_rate: str):
        self.click(*self.ALERT_OPEN)
        WebDriverWait(self.driver, 5).until(
            EC.visibility_of_element_located((By.ID, "alert-modal"))
        )

        pair = f"{base}/{quote}"
        Select(self.driver.find_element(*self.ALERT_PAIR)).select_by_value(pair)
        Select(self.driver.find_element(*self.ALERT_DIRECTION)).select_by_value(direction)
        self.type(*self.ALERT_TARGET_INPUT, target_rate)
        self.click(*self.ALERT_SUBMIT)

        WebDriverWait(self.driver, 5).until(
            EC.invisibility_of_element_located((By.ID, "alert-modal"))
        )

    def get_alerts_list_texts(self):
        return [el.text for el in self.driver.find_elements(*self.ALERT_ROWS)]

    def remove_alert_item(self, index=0):
        row = self.driver.find_elements(*self.ALERT_ROWS)[index]
        row.find_element(By.CSS_SELECTOR, "button[data-remove-alert]").click()

    def is_trend_chart_showing(self) -> bool:
        return bool(self.driver.find_elements(*self.TREND_CHART))

    def get_trend_message(self):
        return self.get_text(*self.TREND_MESSAGE)

    def wait_for_list_change(self, get_texts_fn, previous_texts, timeout: int = 5):
        WebDriverWait(self.driver, timeout).until(
            lambda _driver: get_texts_fn() != previous_texts
        )
