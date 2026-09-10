from datetime import datetime, timezone

from apscheduler.schedulers.background import BackgroundScheduler

from app.database import SessionLocal
from app.models import FxRateHistory
from app.services import fetch_live_rates

WATCHED_PAIRS = [
    ("USD", "ZAR"),
    ("EUR", "USD"),
    ("GBP", "ZAR"),
    ("JPY", "USD"),
]


def poll_and_store_rates():
    db = SessionLocal()
    try:
        rates_by_base: dict[str, dict[str, float]] = {}
        for base, quote in WATCHED_PAIRS:
            if base not in rates_by_base:
                rates_by_base[base] = fetch_live_rates(base)
            rate = rates_by_base[base].get(quote)
            if rate is None:
                print(f"[rate_history_job] No rate for {base}/{quote}, skipping")
                continue
            db.add(
                FxRateHistory(
                    base_currency=base,
                    quote_currency=quote,
                    rate=rate,
                    recorded_at=datetime.now(timezone.utc),
                )
            )
        db.commit()
        print(f"[rate_history_job] Stored snapshots at {datetime.now(timezone.utc).isoformat()}")
    finally:
        db.close()


def start_scheduler() -> BackgroundScheduler:
    scheduler = BackgroundScheduler()
    scheduler.add_job(
        poll_and_store_rates,
        "interval",
        minutes=15,
        next_run_time=datetime.now(timezone.utc),
    )
    scheduler.start()
    return scheduler