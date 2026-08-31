import json
import os
from datetime import datetime, timezone
from typing import Any
from urllib.error import URLError
from urllib.request import Request, urlopen

from sqlalchemy.orm import Session

from app.auth import hash_token
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
    if "rates" in payload and isinstance(payload["rates"], dict):
        return {key.upper(): float(value) for key, value in payload["rates"].items()}
    return DEFAULT_RATES.copy()


def fetch_live_rates(base_currency: str = "USD") -> dict[str, float]:
    api_key = os.getenv("RATE_API_KEY")
    base_currency = base_currency.upper()
    url = f"https://open.er-api.com/v6/latest/{base_currency}"

    if api_key:
        url = f"https://api.exchangerate.host/live?access_key={api_key}&source={base_currency}&format=1"

    headers = {"User-Agent": "currency-exchange-tracker/1.0"}
    req = Request(url, headers=headers)
    try:
        with urlopen(req, timeout=8) as response:
            payload = json.loads(response.read().decode("utf-8"))
            rates = parse_rate_payload(payload)
            if base_currency not in rates:
                rates[base_currency] = 1.0
            save_rate_cache(base_currency, rates)
            return rates
    except (URLError, ValueError, TimeoutError):
        return fetch_cached_rates(base_currency)


def save_rate_cache(base_currency: str, rates: dict[str, float]) -> None:
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
    db: Session = SessionLocal()
    try:
        record = db.query(RateCache).filter(RateCache.base_currency == base_currency.upper()).first()
        if record and record.rates:
            payload = json.loads(record.rates)
            if isinstance(payload, dict):
                return {str(k).upper(): float(v) for k, v in payload.items()}
    except Exception:
        pass
    finally:
        db.close()

    return DEFAULT_RATES.copy()


def convert_currency(amount: float, from_currency: str, to_currency: str) -> tuple[float, float, str]:
    rates = fetch_live_rates(from_currency)
    from_code = from_currency.upper()
    to_code = to_currency.upper()

    if from_code not in rates:
        rates[from_code] = 1.0
    if to_code not in rates:
        rates[to_code] = rates.get(from_code, 1.0)

    rate = rates.get(to_code, 1.0) / rates.get(from_code, 1.0)
    converted = amount * rate
    return converted, rate, "live" if len(rates) > 0 else "cached"


def get_rate_snapshot(base_currency: str = "USD") -> dict[str, Any]:
    rates = fetch_live_rates(base_currency)
    return {
        "base_currency": base_currency.upper(),
        "rates": {code.upper(): round(float(value), 6) for code, value in rates.items()},
        "source": "live" if rates != DEFAULT_RATES.copy() else "cached",
        "last_updated": datetime.now(timezone.utc).isoformat(),
    }
