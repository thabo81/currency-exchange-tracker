from __future__ import annotations

from datetime import datetime
from uuid import uuid4

from sqlalchemy import UUID, Boolean, Column, DateTime, Float, ForeignKey, String, Text
from app.database import GUID
from sqlalchemy.orm import relationship

from app.database import Base


class User(Base):
    __tablename__ = "users"

    user_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid4, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    first_name = Column(String(100), nullable=False)
    surname = Column(String(100), nullable=False)
    country = Column(String(100), nullable=False)
    is_verified = Column(Boolean, default=False, nullable=False)

    sessions = relationship("UserSession", back_populates="user", cascade="all, delete-orphan")


class UserSession(Base):
    __tablename__ = "user_sessions"
 
    session_id = Column(GUID(), primary_key=True, default=uuid4)
    user_id = Column(GUID(), ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False, index=True)
    token_hash = Column(String(255), nullable=False, index=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
 
    user = relationship("User", back_populates="sessions")
 
 
class RateCache(Base):
    __tablename__ = "rate_cache"
 
    cache_id = Column(GUID(), primary_key=True, default=uuid4)
    base_currency = Column(String(10), nullable=False, index=True)
    rates = Column(Text, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
 
 
class FavoritePair(Base):
    __tablename__ = "favorite_pairs"
 
    favorite_id = Column(GUID(), primary_key=True, default=uuid4)
    user_id = Column(GUID(), ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False, index=True)
    base_currency = Column(String(10), nullable=False)
    quote_currency = Column(String(10), nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
 
 
class ConversionHistory(Base):
    __tablename__ = "conversion_history"
 
    history_id = Column(GUID(), primary_key=True, default=uuid4)
    user_id = Column(GUID(), ForeignKey("users.user_id", ondelete="CASCADE"), nullable=True, index=True)
    base_currency = Column(String(10), nullable=False)
    quote_currency = Column(String(10), nullable=False)
    amount = Column(Float, nullable=False)
    converted_amount = Column(Float, nullable=False)
    rate_used = Column(Float, nullable=False)
    timestamp = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
 
 
class PortfolioHolding(Base):
    __tablename__ = "portfolio_holdings"
 
    holding_id = Column(GUID(), primary_key=True, default=uuid4)
    user_id = Column(GUID(), ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False, index=True)
    currency = Column(String(10), nullable=False)
    amount_held = Column(Float, nullable=False)
    notes = Column(String(255), nullable=True)
 
 
class Alert(Base):
    __tablename__ = "alerts"
 
    alert_id = Column(GUID(), primary_key=True, default=uuid4)
    user_id = Column(GUID(), ForeignKey("users.user_id", ondelete="CASCADE"), nullable=False, index=True)
    base_currency = Column(String(10), nullable=False)
    quote_currency = Column(String(10), nullable=False)
    target_rate = Column(Float, nullable=False)
    direction = Column(String(10), nullable=False)  # "above" or "below"
    triggered = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
 
 
class FxRateHistory(Base):
    __tablename__ = "fx_rate_history"
 
    snapshot_id = Column(GUID(), primary_key=True, default=uuid4)
    base_currency = Column(String(10), nullable=False, index=True)
    quote_currency = Column(String(10), nullable=False, index=True)
    rate = Column(Float, nullable=False)
    recorded_at = Column(DateTime(timezone=True), default=datetime.utcnow, nullable=False, index=True)
