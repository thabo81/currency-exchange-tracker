from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.by import By

from pages.base_page import BasePage


class LoginPage(BasePage):
    LOGIN_EMAIL = (By.ID, "login-email")
    LOGIN_PASSWORD = (By.ID, "login-password")
    REMEMBER_ME = (By.ID, "remember-me")
    LOGIN_SUBMIT = (By.CSS_SELECTOR, "#login-form button[type='submit']")
    SHOW_REGISTER = (By.ID, "show-register")
    REGISTER_FIRST_NAME = (By.ID, "register-first-name")
    REGISTER_SURNAME = (By.ID, "register-surname")
    REGISTER_EMAIL = (By.ID, "register-email")
    REGISTER_COUNTRY = (By.ID, "register-country")
    REGISTER_PASSWORD = (By.ID, "register-password")
    REGISTER_SUBMIT = (By.CSS_SELECTOR, "#register-form button[type='submit']")
    AUTH_MESSAGE = (By.ID, "auth-message")

   
    def open_login(self):
        self.open(f"{self.base_url}/login")

    def login(self, email: str, password: str, remember_me: bool = False):
        self.type(*self.LOGIN_EMAIL, email)
        self.type(*self.LOGIN_PASSWORD, password)
        if remember_me:
            self.driver.find_element(*self.REMEMBER_ME).click()
        self.click(*self.LOGIN_SUBMIT)

    def register(self, first_name: str, surname: str, email: str, country: str, password: str):
        self.click(*self.SHOW_REGISTER)
        self.type(*self.REGISTER_FIRST_NAME, first_name)
        self.type(*self.REGISTER_SURNAME, surname)
        self.type(*self.REGISTER_EMAIL, email)
        self.type(*self.REGISTER_COUNTRY, country)
        self.type(*self.REGISTER_PASSWORD, password)
        self.click(*self.REGISTER_SUBMIT)

    def get_auth_message(self) -> str:
        """Return the success or error message shown by the authentication form."""
        return self.driver.find_element(*self.AUTH_MESSAGE).text.strip()
