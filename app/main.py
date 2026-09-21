import os
from datetime import datetime, timedelta, timezone
from typing import Any
from uuid import uuid4

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from sqlalchemy.orm import Session
from starlette.responses import RedirectResponse

from app.auth import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    hash_token,
    send_challenge_email,
    verify_password,
)
from app.database import Base, engine, get_db
from app.models import ConversionHistory, RateCache, User, UserSession
from app.schemas import (
    ConvertRequest,
    ResendChallengeRequest,
    UserLoginRequest,
    UserRegisterRequest,
    VerifyChallengeRequest,
)
from app.verification import create_challenge, resend_challenge, verify_challenge
from app.services import convert_currency, get_rate_snapshot

from app.dependencies import get_optional_user
from app.rate_history_job import start_scheduler
from app.routers.features import router as features_router

APP_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(APP_DIR, "static")
TEMPLATE_DIR = os.path.join(APP_DIR, "templates")

app = FastAPI(title="Currency Exchange Tracker")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(features_router) 

app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")
templates = Jinja2Templates(directory=TEMPLATE_DIR)




@app.on_event("startup")
def startup() -> None:
    Base.metadata.create_all(bind=engine)
    start_scheduler()


@app.get("/", response_class=HTMLResponse)
async def landing_page(request: Request):
    return templates.TemplateResponse(request, "login.html")

@app.get("/login", response_class=HTMLResponse)
async def login_page(request: Request):
    return templates.TemplateResponse(request, "login.html")

@app.get("/dashboard", response_class=HTMLResponse)
async def dashboard_page(request: Request):
    return templates.TemplateResponse(request, "dashboard.html")


@app.post("/register")
def register_user(payload: UserRegisterRequest, db: Session = Depends(get_db)):
    normalized_email = payload.email.lower().strip()
    existing = db.query(User).filter(User.email == normalized_email).first()
    if existing:
        raise HTTPException(status_code=409, detail="User already exists")

    user = User(
        email=normalized_email,
        password_hash=hash_password(payload.password),
        first_name=payload.first_name,
        surname=payload.surname,
        country=payload.country,
        is_verified=False,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    code = create_challenge(normalized_email)
    try:
        send_challenge_email(normalized_email, code)
    except Exception:
        # Account + challenge code are already created/stored even if the
        # email itself failed to send — the user can retry via /resend-code
        # once the issue is resolved, rather than getting a hard 500 here.
        pass
 
    return {
        "message": "Registration successful. Enter the verification code sent to your email within 90 seconds.",
        "email": normalized_email,
    }
    


@app.post("/verify-code")
def verify_code(payload: VerifyChallengeRequest, db: Session = Depends(get_db)):
    normalized_email = payload.email.lower().strip()
    user = db.query(User).filter(User.email == normalized_email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if not verify_challenge(normalized_email, payload.code):
        raise HTTPException(status_code=400, detail="Invalid or expired code")

    user.is_verified = True
    db.commit()
    return {"message": "Account verified successfully", "email": normalized_email}


@app.post("/resend-code")
def resend_code(payload: ResendChallengeRequest, db: Session = Depends(get_db)):
    normalized_email = payload.email.lower().strip()
    user = db.query(User).filter(User.email == normalized_email).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.is_verified:
        raise HTTPException(status_code=400, detail="Account already verified")

    code = resend_challenge(normalized_email)
    if code is None:
        raise HTTPException(status_code=429, detail="Maximum resend attempts reached")

    try:
        send_challenge_email(normalized_email, code)
    except Exception:
        # The new code is already stored server-side even if the email
        # itself failed to send — don't 500 the whole request for that.
        pass

    return {"message": "Code resent"}


@app.post("/login")
def login(payload: UserLoginRequest, db: Session = Depends(get_db)):
    normalized_email = payload.email.lower().strip()
    user = db.query(User).filter(User.email == normalized_email).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not user.is_verified:
        raise HTTPException(status_code=403, detail="User not verified")

    access_token = create_access_token(str(user.user_id))
    refresh_token = create_refresh_token(str(user.user_id))

    if payload.remember_me:
        remember_token = os.urandom(32).hex()
        token_hash = hash_token(remember_token)
        expires_at = datetime.now(timezone.utc) + timedelta(days=30)
        session = UserSession(user_id=user.user_id, token_hash=token_hash, expires_at=expires_at)
        db.add(session)
        db.commit()
        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "remember_me_token": remember_token,
            "token_type": "bearer",
            "user": {"email": user.email, "first_name": user.first_name, "surname": user.surname},
        }

    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": {"email": user.email, "first_name": user.first_name, "surname": user.surname},
    }


@app.post("/rates")
def get_rates(base_currency: str = "USD"):
    snapshot = get_rate_snapshot(base_currency)
    return JSONResponse(content=snapshot)


@app.post("/convert")
def convert(
    payload: ConvertRequest,
    db: Session = Depends(get_db),
    user: User | None = Depends(get_optional_user),
):
    converted_amount, rate, source = convert_currency(float(payload.amount), payload.from_currency, payload.to_currency)

    history_entry = ConversionHistory(
        user_id=user.user_id if user else None,
        base_currency=payload.from_currency.upper(),
        quote_currency=payload.to_currency.upper(),
        amount=float(payload.amount),
        converted_amount=round(converted_amount, 4),
        rate_used=round(rate, 6),
    )
    db.add(history_entry)
    db.commit()

    return {
        "amount": float(payload.amount),
        "from_currency": payload.from_currency.upper(),
        "to_currency": payload.to_currency.upper(),
        "converted_amount": round(converted_amount, 4),
        "rate": round(rate, 6),
        "source": source
    }

@app.post("/refresh-token")
def refresh_token(token: str):
    try:
        payload = decode_token(token)
    except Exception as exc:
        raise HTTPException(status_code=401, detail="Invalid token") from exc

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token")

    new_access_token = create_access_token(user_id)
    return {"access_token": new_access_token, "token_type": "bearer"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=int(os.getenv("PORT", 8000)), reload=True)
