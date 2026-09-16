import os
import uuid

from sqlalchemy.types import TypeDecorator, CHAR
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./currency_exchange.db")
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

class GUID(TypeDecorator):
        """
        Platform-independent UUID type. Uses PostgreSQL's native UUID
        column in production, and a stringified CHAR(36) column
        everywhere else (SQLite, used in CI/local testing) — so the
        same models work correctly against both backends without
        duplicating column definitions.
        """
        impl = CHAR
        cache_ok = True
 
        def load_dialect_impl(self, dialect):
            if dialect.name == "postgresql":
                return dialect.type_descriptor(PG_UUID(as_uuid=True))
            return dialect.type_descriptor(CHAR(36))
 
        def process_bind_param(self, value, dialect):
            if value is None:
                return value
            if dialect.name == "postgresql":
                return str(value)
            if not isinstance(value, uuid.UUID):
                value = uuid.UUID(str(value))
            return str(value)
 
        def process_result_value(self, value, dialect):
            if value is None:
                return value
            if not isinstance(value, uuid.UUID):
                value = uuid.UUID(value)
            return value
