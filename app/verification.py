"""
NEW FILE: app/verification.py

In-memory store for the 90-second registration verification codes.
Same single-process pattern as the old OTP_STORE — fine given
WEB_CONCURRENCY=1 on Render. If you ever scale to multiple workers/
instances, this would need to move to Redis or the database instead,
since each process would have its own separate dict.
"""

import secrets
import string
from datetime import datetime, timedelta, timezone

from app.auth import hash_token

CODE_TTL_SECONDS = 90
MAX_RESENDS = 3

# keyed by normalized email -> {"code_hash": str, "expires_at": datetime, "resend_count": int}
CHALLENGE_STORE: dict[str, dict] = {}


def generate_challenge_code() -> str:
    alphabet = string.ascii_uppercase + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(6))


def create_challenge(email: str) -> str:
    code = generate_challenge_code()
    CHALLENGE_STORE[email] = {
        "code_hash": hash_token(code),
        "expires_at": datetime.now(timezone.utc) + timedelta(seconds=CODE_TTL_SECONDS),
        "resend_count": 0,
    }
    return code


def verify_challenge(email: str, code: str) -> bool:
    entry = CHALLENGE_STORE.get(email)
    if not entry:
        return False

    if datetime.now(timezone.utc) > entry["expires_at"]:
        del CHALLENGE_STORE[email]
        return False

    if hash_token(code.strip().upper()) != entry["code_hash"]:
        return False

    del CHALLENGE_STORE[email]
    return True


def resend_challenge(email: str) -> str | None:
    """Returns the new code, or None if the resend limit was hit."""
    entry = CHALLENGE_STORE.get(email)

    if not entry:
        # No active challenge (already verified/expired/never created) — start fresh
        return create_challenge(email)

    if entry["resend_count"] >= MAX_RESENDS:
        return None

    code = generate_challenge_code()
    entry["code_hash"] = hash_token(code)
    entry["expires_at"] = datetime.now(timezone.utc) + timedelta(seconds=CODE_TTL_SECONDS)
    entry["resend_count"] += 1
    return code