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
