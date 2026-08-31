import pytest


@pytest.mark.parametrize(
    "payload, expected_status",
    [
        ({"email": "user@example.com", "password": "wrongpass"}, 401),
    ],
)
def test_invalid_login(client, payload, expected_status):
    response = client.post("/login", json=payload)
    assert response.status_code == expected_status


def test_register_verify_and_login(client):
    register_payload = {
        "email": "verify@example.com",
        "password": "StrongPass1!",
        "first_name": "Test",
        "surname": "User",
        "country": "South Africa",
    }

    register_response = client.post("/register", json=register_payload)
    assert register_response.status_code == 200
    body = register_response.json()
    assert body["email"] == "verify@example.com"
    assert "otp" in body

    verify_response = client.post("/verify-otp", json={"email": "verify@example.com", "otp": body["otp"]})
    assert verify_response.status_code == 200

    login_response = client.post("/login", json={"email": "verify@example.com", "password": "StrongPass1!"})
    assert login_response.status_code == 200
    payload = login_response.json()
    assert "access_token" in payload
    assert payload["token_type"] == "bearer"


def test_refresh_token_rotation(client):
    register_payload = {
        "email": "rotate@example.com",
        "password": "StrongPass1!",
        "first_name": "Rotate",
        "surname": "Token",
        "country": "Botswana",
    }

    client.post("/register", json=register_payload)
    otp = client.post("/register", json=register_payload).json()["otp"]
    client.post("/verify-otp", json={"email": "rotate@example.com", "otp": otp})

    login_response = client.post("/login", json={"email": "rotate@example.com", "password": "StrongPass1!"})
    assert login_response.status_code == 200
    tokens = login_response.json()
    refresh_response = client.post("/refresh-token", params={"token": tokens["refresh_token"]})
    assert refresh_response.status_code == 200
    assert "access_token" in refresh_response.json()
