import pytest
from datetime import datetime, timedelta, timezone

from app.verification import CHALLENGE_STORE


# ---------------------------------------------------------------------------
# Auth flow — updated for /verify-code (replaces the old /verify-otp tests)
# ---------------------------------------------------------------------------

@pytest.mark.parametrize(
    "payload, expected_status",
    [
        ({"email": "user@example.com", "password": "wrongpass"}, 401),
    ],
)
def test_invalid_login(client, payload, expected_status):
    response = client.post("/login", json=payload)
    assert response.status_code == expected_status


def test_register_no_longer_leaks_code(client, captured_emails):
    """Regression test for the fix that removed the plaintext code from
    the /register response — this should never come back."""
    register_payload = {
        "email": "verify@example.com",
        "password": "StrongPass1!",
        "first_name": "Test",
        "surname": "User",
        "country": "South Africa",
    }
    response = client.post("/register", json=register_payload)
    assert response.status_code == 200
    body = response.json()
    assert "otp" not in body
    assert "code" not in body
    
    assert len(captured_emails) == 1
    assert captured_emails[0]["email"] == "verify@example.com"


def test_register_verify_and_login(client, captured_emails):
    register_payload = {
        "email": "verify2@example.com",
        "password": "StrongPass1!",
        "first_name": "Test",
        "surname": "User",
        "country": "South Africa",
    }
    register_response = client.post("/register", json=register_payload)
    assert register_response.status_code == 200

    code = captured_emails[-1]["code"]

    verify_response = client.post(
        "/verify-code", json={"email": "verify2@example.com", "code": code}
    )
    assert verify_response.status_code == 200

    login_response = client.post(
        "/login", json={"email": "verify2@example.com", "password": "StrongPass1!"}
    )
    assert login_response.status_code == 200
    payload = login_response.json()
    assert "access_token" in payload
    assert payload["token_type"] == "bearer"


def test_refresh_token_rotation(client, captured_emails):
    register_payload = {
        "email": "rotate@example.com",
        "password": "StrongPass1!",
        "first_name": "Rotate",
        "surname": "Token",
        "country": "Botswana",
    }
    client.post("/register", json=register_payload)
    code = captured_emails[-1]["code"]
    client.post("/verify-code", json={"email": "rotate@example.com", "code": code})

    login_response = client.post(
        "/login", json={"email": "rotate@example.com", "password": "StrongPass1!"}
    )
    tokens = login_response.json()
    refresh_response = client.post("/refresh-token", params={"token": tokens["refresh_token"]})
    assert refresh_response.status_code == 200
    assert "access_token" in refresh_response.json()


# ---------------------------------------------------------------------------
# EP / BVA — verification code TTL (90s)
# real rule (app/verification.py): expired if now > expires_at (strictly greater)
# ---------------------------------------------------------------------------

def _register_and_get_code(client, captured_emails, email):
    client.post(
        "/register",
        json={
            "email": email,
            "password": "StrongPass1!",
            "first_name": "TTL",
            "surname": "Test",
            "country": "South Africa",
        },
    )
    return captured_emails[-1]["code"]


def test_verify_code_within_ttl_succeeds(client, captured_emails):
    """EP: time-remaining class — well inside the valid window."""
    email = "ttl-valid@example.com"
    code = _register_and_get_code(client, captured_emails, email)
    response = client.post("/verify-code", json={"email": email, "code": code})
    assert response.status_code == 200


def test_verify_code_exactly_at_expiry_boundary_fails(client, captured_emails):
    """BVA: manipulate expires_at to the exact boundary instant.
    Real rule is `now > expires_at`, so at the exact boundary it should
    still be valid — but one microsecond past should fail. This test
    checks the failing side (just past the boundary) since real time
    always advances past whatever instant we set."""
    email = "ttl-boundary@example.com"
    code = _register_and_get_code(client, captured_emails, email)

    # Force the stored entry to have expired one second ago
    CHALLENGE_STORE[email]["expires_at"] = datetime.now(timezone.utc) - timedelta(seconds=1)

    response = client.post("/verify-code", json={"email": email, "code": code})
    assert response.status_code == 400


def test_verify_code_well_past_expiry_fails(client, captured_emails):
    """EP: time-remaining class — well outside the valid window."""
    email = "ttl-expired@example.com"
    code = _register_and_get_code(client, captured_emails, email)
    CHALLENGE_STORE[email]["expires_at"] = datetime.now(timezone.utc) - timedelta(minutes=5)

    response = client.post("/verify-code", json={"email": email, "code": code})
    assert response.status_code == 400


def test_verify_code_wrong_code_fails(client, captured_emails):
    """EP: invalid-code class (correct format, wrong value)."""
    email = "wrong-code@example.com"
    _register_and_get_code(client, captured_emails, email)
    response = client.post("/verify-code", json={"email": email, "code": "ZZZZZZ"})
    assert response.status_code == 400


def test_verify_code_case_insensitive(client, captured_emails):
    """The store lowercases/uppercases for comparison — confirm a
    lowercase-typed code still matches an uppercase-generated one."""
    email = "case-test@example.com"
    code = _register_and_get_code(client, captured_emails, email)
    response = client.post("/verify-code", json={"email": email, "code": code.lower()})
    assert response.status_code == 200


# ---------------------------------------------------------------------------
# EP / BVA — resend limit (MAX_RESENDS = 3)
# ---------------------------------------------------------------------------

def test_resend_within_limit_succeeds(client, captured_emails):
    """EP: resend count below the limit (0, 1, 2 already used)."""
    email = "resend-ok@example.com"
    _register_and_get_code(client, captured_emails, email)

    for _ in range(3):
        response = client.post("/resend-code", json={"email": email})
        assert response.status_code == 200


def test_resend_at_limit_boundary_blocks(client, captured_emails):
    """BVA: the 4th resend attempt (1 past the MAX_RESENDS=3 boundary)
    should be rejected with 429."""
    email = "resend-limit@example.com"
    _register_and_get_code(client, captured_emails, email)

    for _ in range(3):
        client.post("/resend-code", json={"email": email})

    fourth_attempt = client.post("/resend-code", json={"email": email})
    assert fourth_attempt.status_code == 429


def test_resend_after_already_verified_fails(client, captured_emails):
    """EP: resend requested for an already-verified account."""
    email = "already-verified@example.com"
    code = _register_and_get_code(client, captured_emails, email)
    client.post("/verify-code", json={"email": email, "code": code})

    response = client.post("/resend-code", json={"email": email})
    assert response.status_code == 400


# ---------------------------------------------------------------------------
# EP / BVA — registration password length (min_length=8, max_length=128)
# ---------------------------------------------------------------------------

@pytest.mark.parametrize(
    "password, expected_status",
    [
        ("short7x", 422),      # 7 chars — just below the minimum boundary
        ("exactly8", 200),     # 8 chars — exactly at the minimum boundary
        ("a" * 128, 200),      # 128 chars — exactly at the maximum boundary
        ("a" * 129, 422),      # 129 chars — just above the maximum boundary
    ],
)
def test_register_password_length_boundaries(client, captured_emails, password, expected_status):
    unique_email = f"pwlen-{len(password)}@example.com"
    response = client.post(
        "/register",
        json={
            "email": unique_email,
            "password": password,
            "first_name": "Pw",
            "surname": "Test",
            "country": "South Africa",
        },
    )
    assert response.status_code == expected_status


# ---------------------------------------------------------------------------
# EP / BVA — /convert amount (real rule: gt=0, NO upper bound in the schema)
# Note: an earlier manual test doc assumed a 1,000,000 max — the actual
# ConvertRequest schema doesn't enforce one. These tests check the REAL
# rule, not the assumed one.
# ---------------------------------------------------------------------------

@pytest.mark.parametrize(
    "amount, expected_status",
    [
        (0, 422),          # boundary: exactly 0 — invalid (gt=0 excludes it)
        (0.01, 200),       # boundary: smallest realistic positive amount — valid
        (-1, 422),         # EP: negative class — invalid
        (1_000_000_000, 200),  # EP: very large amount — currently VALID (no upper cap exists)
    ],
)
def test_convert_amount_boundaries(client, amount, expected_status):
    response = client.post(
        "/convert", json={"amount": amount, "from_currency": "USD", "to_currency": "ZAR"}
    )
    assert response.status_code == expected_status


@pytest.mark.parametrize(
    "currency_code, expected_status",
    [
        ("US", 422),    # boundary: 2 chars — below the required length
        ("USD", 200),   # boundary: exactly 3 chars — valid
        ("USDD", 422),  # boundary: 4 chars — above the required length
    ],
)
def test_convert_currency_code_length_boundaries(client, currency_code, expected_status):
    response = client.post(
        "/convert",
        json={"amount": 100, "from_currency": currency_code, "to_currency": "ZAR"},
    )
    assert response.status_code == expected_status


# ---------------------------------------------------------------------------
# Gap test — PortfolioHoldingRequest has NO validation on amount_held
# (no gt=0 constraint exists in the schema). This test documents that gap
# rather than assuming it's already handled — useful to know before
# treating it as "tested and safe."
# ---------------------------------------------------------------------------

def test_portfolio_negative_amount_currently_accepted(client, captured_emails):
    """
    KNOWN GAP: PortfolioHoldingRequest.amount_held has no positivity
    constraint. This test documents current (permissive) behavior —
    if you later add validation, this test SHOULD start failing, which
    is your signal to update it to expect 422 instead.
    """
    email = "portfolio-gap@example.com"
    code = _register_and_get_code(client, captured_emails, email)
    client.post("/verify-code", json={"email": email, "code": code})
    login = client.post("/login", json={"email": email, "password": "StrongPass1!"})
    token = login.json()["access_token"]

    response = client.post(
        "/portfolio",
        json={"currency": "USD", "amount_held": -500, "notes": "should this be allowed?"},
        headers={"Authorization": f"Bearer {token}"},
    )
    # Documenting CURRENT behavior — update this assertion if you add validation
    assert response.status_code == 200


# ---------------------------------------------------------------------------
# EP — alert direction (app-level check, not schema-level)
# ---------------------------------------------------------------------------

@pytest.mark.parametrize(
    "direction, expected_status",
    [
        ("above", 200),
        ("below", 200),
        ("sideways", 422),  # invalid class — checked manually in the endpoint, not by Pydantic
    ],
)
def test_alert_direction_equivalence_classes(client, captured_emails, direction, expected_status):
    email = f"alert-{direction}@example.com"
    code = _register_and_get_code(client, captured_emails, email)
    client.post("/verify-code", json={"email": email, "code": code})
    login = client.post("/login", json={"email": email, "password": "StrongPass1!"})
    token = login.json()["access_token"]

    response = client.post(
        "/alerts",
        json={
            "base_currency": "USD",
            "quote_currency": "ZAR",
            "target_rate": 18.5,
            "direction": direction,
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == expected_status
