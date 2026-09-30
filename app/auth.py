
import os
import secrets

from datetime import datetime, timedelta, timezone
from hashlib import sha256

import jwt
from dotenv import load_dotenv
from passlib.context import CryptContext

# Load local development settings without overriding environment variables.
load_dotenv()
JWT_SECRET = os.getenv("JWT_SECRET")
if not JWT_SECRET:
    raise RuntimeError("JWT_SECRET must be set in the environment or local .env file")
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


def hash_token(token: str) -> str:
    return sha256(token.encode("utf-8")).hexdigest()


def create_remember_me_token(user_id: str) -> tuple[str, str]:
    token = secrets.token_urlsafe(32)
    return token, hash_token(token)


def rotate_remember_me_token(existing_token_hash: str, user_id: str) -> tuple[str, str]:
    new_token = secrets.token_urlsafe(32)
    return new_token, hash_token(new_token)
