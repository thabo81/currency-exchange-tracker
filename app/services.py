import json
import os
from datetime import datetime, timezone
from typing import Any
from urllib.error import URLError
from urllib.request import Request, urlopen

from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models import RateCache

DEFAULT_RATES = {
    "USD": 1.0,
    "ZAR": 18.2,
    "EUR": 0.92,
    "JPY": 157.86,
    "GBP": 0.79,
    "CHF": 0.88,
    "CAD": 1.36,
    "AUD": 1.51,
    "NOK": 10.62,
    "SEK": 10.26,
}


def parse_rate_payload(payload: dict[str, Any]) -> dict[str, float]:
    """Extract valid rates from a provider response.

    Raise ValueError for an unexpected or empty response instead of silently
    returning default rates, which could incorrectly be labelled as live data.
    """
    if not isinstance(payload, dict) or not isinstance(payload.get("rates"), dict):
        raise ValueError("Unexpected exchange-rate provider response: missing rates object")

    raw_rates = payload["rates"]
    if not raw_rates:
        raise ValueError("Unexpected exchange-rate provider response: rates object is empty")

    try:
        rates = {str(key).upper(): float(value) for key, value in raw_rates.items()}
    except (TypeError, ValueError, OverflowError) as exc:
        raise ValueError("Unexpected exchange-rate provider response: invalid rate value") from exc

    return rates


def _fetch_rates_with_source(base_currency: str = "USD") -> tuple[dict[str, float], str]:
    """Fetch live rates and report whether the result came from the provider or fallback."""
    api_key = os.getenv("RATE_API_KEY")
    base_currency = base_currency.upper()
    url = f"https://open.er-api.com/v6/latest/{base_currency}"

    if api_key:
        url = f"https://api.exchangerate.host/live?access_key={api_key}&source={base_currency}&format=1"

    request = Request(url, headers={"User-Agent": "currency-exchange-tracker/1.0"})
    try:
        with urlopen(request, timeout=8) as response:
            payload = json.loads(response.read().decode("utf-8"))
            rates = parse_rate_payload(payload)
            save_rate_cache(base_currency, rates)
            return rates, "live"
    except (URLError, ValueError, TypeError, TimeoutError):
        return fetch_cached_rates(base_currency), "cached"


def fetch_live_rates(base_currency: str = "USD") -> dict[str, float]:
    """Return rates while preserving the original public function interface."""
    rates, _source = _fetch_rates_with_source(base_currency)
    return rates


def save_rate_cache(base_currency: str, rates: dict[str, float]) -> None:
    """Persist the latest rate snapshot for use when the provider is unavailable."""
    db: Session = SessionLocal()
    try:
        record = db.query(RateCache).filter(RateCache.base_currency == base_currency.upper()).first()
        payload = json.dumps(rates)
        if record is None:
            record = RateCache(base_currency=base_currency.upper(), rates=payload, updated_at=datetime.now(timezone.utc))
            db.add(record)
        else:
            record.rates = payload
            record.updated_at = datetime.now(timezone.utc)
        db.commit()
    finally:
        db.close()


def fetch_cached_rates(base_currency: str = "USD") -> dict[str, float]:
    """Return cached rates, falling back to built-in defaults if no cache exists."""
    db: Session = SessionLocal()
    try:
        record = db.query(RateCache).filter(RateCache.base_currency == base_currency.upper()).first()
        if record and record.rates:
            payload = json.loads(record.rates)
            if isinstance(payload, dict):
                return {str(key).upper(): float(value) for key, value in payload.items()}
    except Exception:
        # A corrupt cache must not prevent the application from using default rates.
        pass
    finally:
        db.close()

    return DEFAULT_RATES.copy()


def convert_currency(amount: float, from_currency: str, to_currency: str) -> tuple[float, float, str]:
    """Convert using a real rate entry; never invent a rate for an unknown target."""
    rates, source = _fetch_rates_with_source(from_currency)
    from_code = from_currency.upper().strip()
    to_code = to_currency.upper().strip()

    # The requested base is expected to have a rate of 1.0 in its own snapshot.
    if from_code not in rates:
        raise ValueError(f"Unsupported source currency: {from_code}")
    if to_code not in rates:
        raise ValueError(f"Unsupported target currency: {to_code}")

    base_rate = float(rates[from_code])
    target_rate = float(rates[to_code])
    if base_rate <= 0 or target_rate <= 0:
        raise ValueError("Exchange rates must be positive numbers")

    rate = target_rate / base_rate
    converted = amount * rate
    return converted, rate, source


def get_rate_snapshot(base_currency: str = "USD") -> dict[str, Any]:
    """Return a rate snapshot with an accurate live-versus-fallback source label."""
    rates, source = _fetch_rates_with_source(base_currency)
    return {
        "base_currency": base_currency.upper(),
        "rates": {code.upper(): round(float(value), 6) for code, value in rates.items()},
        "source": source,
        "last_updated": datetime.now(timezone.utc).isoformat(),
    }
