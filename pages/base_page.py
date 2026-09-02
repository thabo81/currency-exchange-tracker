from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait


class BasePage:
    def __init__(self, driver, base_url="http://localhost:8000"):
        self.driver = driver
        self.base_url = base_url
        self.wait = WebDriverWait(driver, 15)

    def open(self, url: str):
        self.driver.get(url)

    def click(self, by, value):
        element = self.wait.until(EC.element_to_be_clickable((by, value)))
        element.click()
        return element

    def type(self, by, value, text: str):
        element = self.wait.until(EC.visibility_of_element_located((by, value)))
        element.clear()
        element.send_keys(text)
        return element

    def get_text(self, by, value):
        element = self.wait.until(EC.visibility_of_element_located((by, value)))
        return element.text

    def is_visible(self, by, value):
        try:
            self.wait.until(EC.visibility_of_element_located((by, value)))
            return True
        except Exception:
            return False

    def wait_for_url(self, url_fragment: str):
        self.wait.until(EC.url_contains(url_fragment))
