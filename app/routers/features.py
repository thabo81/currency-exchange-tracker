"""
NEW FILE: app/routers/features.py
 
Mount this in main.py:
    from app.routers.features import router as features_router
    app.include_router(features_router)
"""

from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import desc
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user
from app.models import Alert, ConversionHistory, FavoritePair, FxRateHistory, PortfolioHolding, User
from app.schemas import AlertRequest, FavoritePairRequest, PortfolioHoldingRequest

router = APIRouter()


# ---------- Favorites ----------

@router.get("/favorites")
def list_favorites(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    rows = db.query(FavoritePair).filter(FavoritePair.user_id == user.user_id).all()
    return [
        {"id": str(r.favorite_id), "base_currency": r.base_currency, "quote_currency": r.quote_currency}
        for r in rows
    ]


@router.post("/favorites")
def add_favorite(
    payload: FavoritePairRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    base = payload.base_currency.upper()
    quote = payload.quote_currency.upper()

    existing = (
        db.query(FavoritePair)
        .filter(
            FavoritePair.user_id == user.user_id,
            FavoritePair.base_currency == base,
            FavoritePair.quote_currency == quote,
        )
        .first()
    )
    if existing:
        raise HTTPException(status_code=409, detail="Pair already in favorites")

    favorite = FavoritePair(user_id=user.user_id, base_currency=base, quote_currency=quote)
    db.add(favorite)
    db.commit()
    db.refresh(favorite)
    return {"id": str(favorite.favorite_id), "base_currency": base, "quote_currency": quote}


@router.delete("/favorites/{favorite_id}")
def remove_favorite(
    favorite_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    favorite = (
        db.query(FavoritePair)
        .filter(FavoritePair.favorite_id == favorite_id, FavoritePair.user_id == user.user_id)
        .first()
    )
    if not favorite:
        raise HTTPException(status_code=404, detail="Favorite not found")

    db.delete(favorite)
    db.commit()
    return {"message": "Removed from favorites"}


# ---------- Portfolio ----------

@router.get("/portfolio")
def list_portfolio(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    rows = db.query(PortfolioHolding).filter(PortfolioHolding.user_id == user.user_id).all()
    return [
        {"id": str(r.holding_id), "currency": r.currency, "amount_held": r.amount_held, "notes": r.notes}
        for r in rows
    ]


@router.post("/portfolio")
def add_holding(
    payload: PortfolioHoldingRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    holding = PortfolioHolding(
        user_id=user.user_id,
        currency=payload.currency.upper(),
        amount_held=payload.amount_held,
        notes=payload.notes,
    )
    db.add(holding)
    db.commit()
    db.refresh(holding)
    return {"id": str(holding.holding_id), "currency": holding.currency, "amount_held": holding.amount_held}


@router.delete("/portfolio/{holding_id}")
def remove_holding(
    holding_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    holding = (
        db.query(PortfolioHolding)
        .filter(PortfolioHolding.holding_id == holding_id, PortfolioHolding.user_id == user.user_id)
        .first()
    )
    if not holding:
        raise HTTPException(status_code=404, detail="Holding not found")

    db.delete(holding)
    db.commit()
    return {"message": "Holding removed"}


# ---------- Alerts ----------

@router.get("/alerts")
def list_alerts(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    rows = db.query(Alert).filter(Alert.user_id == user.user_id).all()
    return [
        {
            "id": str(r.alert_id),
            "base_currency": r.base_currency,
            "quote_currency": r.quote_currency,
            "target_rate": r.target_rate,
            "direction": r.direction,
            "triggered": r.triggered,
        }
        for r in rows
    ]


@router.post("/alerts")
def add_alert(
    payload: AlertRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    if payload.direction not in ("above", "below"):
        raise HTTPException(status_code=422, detail="direction must be 'above' or 'below'")

    alert = Alert(
        user_id=user.user_id,
        base_currency=payload.base_currency.upper(),
        quote_currency=payload.quote_currency.upper(),
        target_rate=payload.target_rate,
        direction=payload.direction,
    )
    db.add(alert)
    db.commit()
    db.refresh(alert)
    return {"id": str(alert.alert_id), "message": "Alert created"}


@router.delete("/alerts/{alert_id}")
def remove_alert(
    alert_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    alert = db.query(Alert).filter(Alert.alert_id == alert_id, Alert.user_id == user.user_id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    db.delete(alert)
    db.commit()
    return {"message": "Alert removed"}


# ---------- History ----------

@router.get("/history/recent")
def get_recent_history(
    limit: int = 10,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    """Returns the logged-in user's most recent conversions, newest first.
    (Guest conversions are logged with user_id=None and won't show here —
    that's intentional, since there's no user to scope them to.)"""
    rows = (
        db.query(ConversionHistory)
        .filter(ConversionHistory.user_id == user.user_id)
        .order_by(desc(ConversionHistory.timestamp))
        .limit(limit)
        .all()
    )
    return [
        {
            "base_currency": r.base_currency,
            "quote_currency": r.quote_currency,
            "amount": r.amount,
            "converted_amount": r.converted_amount,
            "rate_used": r.rate_used,
            "timestamp": r.timestamp.isoformat(),
        }
        for r in rows
    ]


# ---------- Trends ----------

@router.get("/trends/{base}/{quote}")
def get_trend(base: str, quote: str, days: int = 7, db: Session = Depends(get_db)):
    """Public — no login required, since the trend chart is shown on the
    overview page even to guests. Returns rate snapshots for the pair
    over the last N days."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    rows = (
        db.query(FxRateHistory)
        .filter(
            FxRateHistory.base_currency == base.upper(),
            FxRateHistory.quote_currency == quote.upper(),
            FxRateHistory.recorded_at >= cutoff,
        )
        .order_by(FxRateHistory.recorded_at)
        .all()
    )
    return [{"rate": r.rate, "recorded_at": r.recorded_at.isoformat()} for r in rows]