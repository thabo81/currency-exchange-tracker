
import os
import secrets
import json

from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError
from datetime import datetime, timedelta, timezone
from hashlib import sha256

import jwt
from passlib.context import CryptContext

JWT_SECRET = os.getenv("JWT_SECRET", "change-me")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 15
REFRESH_TOKEN_EXPIRE_DAYS = 30
TURBOSMTP_USERNAME = os.getenv("TURBOSMTP_USERNAME")  # Consumer Key
TURBOSMTP_PASSWORD = os.getenv("TURBOSMTP_PASSWORD")  # Consumer Secret
SENDER_EMAIL = os.getenv("SENDER_EMAIL")
 

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return pwd_context.verify(password, password_hash)


def create_access_token(subject: str) -> str:
    expires = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": subject, "exp": expires, "type": "access"}
    return jwt.encode(payload, JWT_SECRET, algorithm=ALGORITHM)


def create_refresh_token(subject: str) -> str:
    expires = datetime.now(timezone.utc) + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    payload = {"sub": subject, "exp": expires, "type": "refresh"}
    return jwt.encode(payload, JWT_SECRET, algorithm=ALGORITHM)


def decode_token(token: str):
    return jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])


def generate_otp() -> str:
    return str(secrets.randbelow(1_000_000)).zfill(6)


TURBOSMTP_API_URL = "https://api.turbo-smtp.com/api/v2/mail/send"
 
 
def send_challenge_email(email: str, code: str) -> None:
        if not TURBOSMTP_USERNAME or not TURBOSMTP_PASSWORD or not SENDER_EMAIL:
            print(f"[send_challenge_email] Missing turboSMTP env vars — printing instead: {email} => {code}")
            return
 
        payload = json.dumps({
            "from": SENDER_EMAIL,
            "to": email,
            "subject": "Your Currency Tracker verification code",
            "content": (
                f"Your verification code is: {code}\n\n"
                f"This code expires in 90 seconds — enter it in the app right away."
            ),
        }).encode("utf-8")
 
        request = Request(
            TURBOSMTP_API_URL,
            data=payload,
            method="POST",
            headers={
                "Content-Type": "application/json",
                "consumerKey": TURBOSMTP_USERNAME,
                "consumerSecret": TURBOSMTP_PASSWORD,
            },
        )
 
        try:
            with urlopen(request, timeout=10) as response:
                if response.status >= 400:
                    raise RuntimeError(f"turboSMTP API returned status {response.status}")
        except (URLError, HTTPError) as exc:
            print(f"[send_challenge_email] Failed to send to {email}: {exc}")
            raise


def hash_token(token: str) -> str:
    return sha256(token.encode("utf-8")).hexdigest()


def create_remember_me_token(user_id: str) -> tuple[str, str]:
    token = secrets.token_urlsafe(32)
    return token, hash_token(token)


def rotate_remember_me_token(existing_token_hash: str, user_id: str) -> tuple[str, str]:
    new_token = secrets.token_urlsafe(32)
    return new_token, hash_token(new_token)
