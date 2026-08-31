import os
import secrets
from datetime import datetime, timedelta, timezone
from hashlib import sha256

import jwt
from passlib.context import CryptContext

JWT_SECRET = os.getenv("JWT_SECRET", "change-me")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 15
REFRESH_TOKEN_EXPIRE_DAYS = 30

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


def send_otp_email(email: str, otp: str) -> None:
    print(f"Mock OTP dispatch: {email} => {otp}")


def hash_token(token: str) -> str:
    return sha256(token.encode("utf-8")).hexdigest()


def create_remember_me_token(user_id: str) -> tuple[str, str]:
    token = secrets.token_urlsafe(32)
    return token, hash_token(token)


def rotate_remember_me_token(existing_token_hash: str, user_id: str) -> tuple[str, str]:
    new_token = secrets.token_urlsafe(32)
    return new_token, hash_token(new_token)
