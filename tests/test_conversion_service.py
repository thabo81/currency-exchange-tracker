"""Unit tests for currency conversion validation and rate-source reporting.

These tests replace the external rate provider with deterministic sample data,
so they are repeatable and do not require network access.
"""

import pytest

from app import services


def test_convert_currency_uses_rate_ratio_for_supported_pair(monkeypatch):
    """Converting between supported currencies uses target/base rate ratio."""
    monkeypatch.setattr(
        services,
        "_fetch_rates_with_source",
        lambda base: ({"USD": 1.0, "ZAR": 18.5}, "live"),
    )

    converted, rate, source = services.convert_currency(10, "USD", "ZAR")

    assert converted == pytest.approx(185.0)
    assert rate == pytest.approx(18.5)
    assert source == "live"


def test_convert_currency_rejects_missing_target_currency(monkeypatch):
    """A missing target rate must not be replaced with an invented rate."""
    monkeypatch.setattr(
        services,
        "_fetch_rates_with_source",
        lambda base: ({"USD": 1.0, "ZAR": 18.5}, "live"),
    )

    with pytest.raises(ValueError, match="Unsupported target currency: XYZ"):
        services.convert_currency(10, "USD", "XYZ")


def test_convert_currency_reports_cached_fallback_source(monkeypatch):
    """The conversion response should preserve the source returned by the fallback."""
    monkeypatch.setattr(
        services,
        "_fetch_rates_with_source",
        lambda base: ({"USD": 1.0, "ZAR": 18.0}, "cached"),
    )

    converted, rate, source = services.convert_currency(2, "USD", "ZAR")

    assert converted == pytest.approx(36.0)
    assert rate == pytest.approx(18.0)
    assert source == "cached"


def test_rate_snapshot_reports_cached_source(monkeypatch):
    """Rate snapshots must not label cached rates as live rates."""
    monkeypatch.setattr(
        services,
        "_fetch_rates_with_source",
        lambda base: ({"USD": 1.0, "ZAR": 18.0}, "cached"),
    )

    snapshot = services.get_rate_snapshot("USD")

    assert snapshot["source"] == "cached"
    assert snapshot["base_currency"] == "USD"
    assert snapshot["rates"]["ZAR"] == pytest.approx(18.0)


def test_convert_currency_rejects_non_positive_rates(monkeypatch):
    """Invalid zero or negative rates should never be used for conversion."""
    monkeypatch.setattr(
        services,
        "_fetch_rates_with_source",
        lambda base: ({"USD": 1.0, "ZAR": 0.0}, "live"),
    )

    with pytest.raises(ValueError, match="Exchange rates must be positive"):
        services.convert_currency(10, "USD", "ZAR")


def test_convert_currency_rejects_missing_source_currency(monkeypatch):
    """An unavailable source currency must not be assigned an invented base rate."""
    monkeypatch.setattr(
        services,
        "_fetch_rates_with_source",
        lambda base: ({"USD": 1.0, "ZAR": 18.5}, "cached"),
    )

    with pytest.raises(ValueError, match="Unsupported source currency: XYZ"):
        services.convert_currency(10, "XYZ", "ZAR")


@pytest.mark.parametrize(
    "payload",
    [
        {},
        {"success": True},
        {"rates": {}},
        {"rates": {"USD": "not-a-number"}},
    ],
)
def test_parse_rate_payload_rejects_malformed_provider_data(payload):
    """Malformed provider data must not silently become default rates."""
    with pytest.raises(ValueError):
        services.parse_rate_payload(payload)


def test_malformed_provider_response_uses_cached_rates(monkeypatch):
    """A malformed live response must use fallback rates and report cached source."""

    class FakeResponse:
        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc_value, traceback):
            return False

        def read(self):
            return b'{"success": true, "message": "unexpected response"}'

    cached_rates = {"USD": 1.0, "ZAR": 18.0}
    monkeypatch.setattr(services, "urlopen", lambda request, timeout: FakeResponse())
    monkeypatch.setattr(services, "fetch_cached_rates", lambda base: cached_rates)
    monkeypatch.setattr(
        services,
        "save_rate_cache",
        lambda base, rates: pytest.fail("Malformed live rates must not be cached"),
    )

    rates, source = services._fetch_rates_with_source("USD")

    assert rates == cached_rates
    assert source == "cached"
