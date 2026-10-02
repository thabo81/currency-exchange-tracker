"""Authentication and request-validation tests for direct account registration."""
import pytest


def registration_payload(email="user@example.com", password="StrongPass1!"):
    """Build valid registration data while allowing fields to be varied in tests."""
    return {
        "email": email,
        "password": password,
        "first_name": "Test",
        "surname": "User",
        "country": "South Africa",
    }


def register_and_login(client, email="user@example.com", password="StrongPass1!"):
    """Create a user and return a successful login response."""
    response = client.post("/register", json=registration_payload(email, password))
    assert response.status_code == 200, response.text
    return client.post("/login", json={"email": email, "password": password})


def test_invalid_login_returns_401(client):
    response = client.post("/login", json={"email": "missing@example.com", "password": "wrongpass"})
    assert response.status_code == 401


def test_register_creates_account_without_verification(client):
    response = client.post("/register", json=registration_payload())
    assert response.status_code == 200
    body = response.json()
    assert body["email"] == "user@example.com"
    assert "code" not in body
    assert "otp" not in body
    assert "verify" not in body["message"].lower()


def test_register_then_login_succeeds(client):
    login_response = register_and_login(client)
    assert login_response.status_code == 200
    body = login_response.json()
    assert body["access_token"]
    assert body["refresh_token"]
    assert body["token_type"] == "bearer"


def test_duplicate_registration_returns_409(client):
    client.post("/register", json=registration_payload())
    duplicate = client.post("/register", json=registration_payload())
    assert duplicate.status_code == 409


def test_refresh_token_can_issue_new_access_token(client):
    tokens = register_and_login(client).json()
    response = client.post("/refresh-token", params={"token": tokens["refresh_token"]})
    assert response.status_code == 200
    assert response.json()["access_token"]


def test_access_token_cannot_be_used_as_refresh_token(client):
    tokens = register_and_login(client).json()
    response = client.post("/refresh-token", params={"token": tokens["access_token"]})
    assert response.status_code == 401


def test_refresh_token_cannot_be_used_as_access_token(client):
    tokens = register_and_login(client).json()
    response = client.get(
        "/favorites",
        headers={"Authorization": f"Bearer {tokens['refresh_token']}"},
    )
    assert response.status_code == 401


@pytest.mark.parametrize(
    "password, expected_status",
    [
        ("short7x", 422),      # One character below the minimum length.
        ("exactly8", 200),     # Exactly at the minimum length.
        ("a" * 128, 200),      # Exactly at the maximum length.
        ("a" * 129, 422),      # One character above the maximum length.
    ],
)
def test_register_password_length_boundaries(client, password, expected_status):
    response = client.post(
        "/register",
        json=registration_payload(email=f"pwlen-{len(password)}@example.com", password=password),
    )
    assert response.status_code == expected_status


@pytest.mark.parametrize(
    "amount, expected_status",
    [
        (0, 422),
        (0.01, 200),
        (-1, 422),
        (1_000_000_000, 200),  # No upper amount limit is currently defined.
    ],
)
def test_convert_amount_boundaries(client, amount, expected_status):
    response = client.post(
        "/convert", json={"amount": amount, "from_currency": "USD", "to_currency": "ZAR"}
    )
    assert response.status_code == expected_status


@pytest.mark.parametrize(
    "currency_code, expected_status",
    [("US", 422), ("USD", 200), ("USDD", 422)],
)
def test_convert_currency_code_length_boundaries(client, currency_code, expected_status):
    response = client.post(
        "/convert",
        json={"amount": 100, "from_currency": currency_code, "to_currency": "ZAR"},
    )
    assert response.status_code == expected_status


def test_authenticated_conversion_is_saved_to_history(client):
    """Authenticated conversions must be associated with the logged-in user."""
    tokens = register_and_login(
        client,
        email="conversion-history@example.com",
    ).json()

    headers = {"Authorization": f"Bearer {tokens['access_token']}"}

    conversion = client.post(
        "/convert",
        json={
            "amount": 100,
            "from_currency": "USD",
            "to_currency": "ZAR",
        },
        headers=headers,
    )
    assert conversion.status_code == 200

    history = client.get("/history/recent", headers=headers)
    assert history.status_code == 200

    rows = history.json()
    assert len(rows) == 1
    assert rows[0]["amount"] == 100
    assert rows[0]["base_currency"] == "USD"
    assert rows[0]["quote_currency"] == "ZAR"
    assert rows[0]["converted_amount"] > 0


def test_invalid_access_token_is_rejected_for_authenticated_conversion(client):
    """An explicitly supplied invalid token must not silently become guest access."""
    response = client.post(
        "/convert",
        json={
            "amount": 100,
            "from_currency": "USD",
            "to_currency": "ZAR",
        },
        headers={"Authorization": "Bearer invalid-token"},
    )
    assert response.status_code == 401


def test_portfolio_negative_amount_currently_accepted(client):
    """Documents a known validation gap until amount_held gets a positive-value constraint."""
    tokens = register_and_login(client, email="portfolio-gap@example.com").json()
    response = client.post(
        "/portfolio",
        json={"currency": "USD", "amount_held": -500, "notes": "validation gap"},
        headers={"Authorization": f"Bearer {tokens['access_token']}"},
    )
    assert response.status_code == 200


@pytest.mark.parametrize(
    "direction, expected_status",
    [("above", 200), ("below", 200), ("sideways", 422)],
)
def test_alert_direction_equivalence_classes(client, direction, expected_status):
    tokens = register_and_login(client, email=f"alert-{direction}@example.com").json()
    response = client.post(
        "/alerts",
        json={
            "base_currency": "USD",
            "quote_currency": "ZAR",
            "target_rate": 18.5,
            "direction": direction,
        },
        headers={"Authorization": f"Bearer {tokens['access_token']}"},
    )
    assert response.status_code == expected_status
