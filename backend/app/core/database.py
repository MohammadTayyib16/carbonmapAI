import logging
from typing import Generator
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from app.core.config import settings

logger = logging.getLogger(__name__)

# Normalize PostgreSQL URLs for SQLAlchemy
db_url = settings.DATABASE_URL
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql+psycopg2://", 1)

# Connect arguments (SQLite requires check_same_thread: False)
connect_args = {}
if db_url.startswith("sqlite"):
    connect_args["check_same_thread"] = False

try:
    engine = create_engine(
        db_url,
        connect_args=connect_args,
        pool_pre_ping=True,
    )
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
except Exception as e:
    logger.warning("Failed to initialize database engine with URL %s: %s", db_url, e)
    engine = None
    SessionLocal = None

Base = declarative_base()

def get_db() -> Generator:
    """
    FastAPI dependency yielding a database session.
    Closes the session automatically upon request completion.
    """
    if SessionLocal is None:
        yield None
        return

    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def init_db():
    """
    Initialize database tables safely and populate initial synthetic seed data if empty.
    """
    if engine is not None and SessionLocal is not None:
        try:
            Base.metadata.create_all(bind=engine)
            logger.info("Database tables verified.")

            # Seed initial demo data
            from app.core.seed import seed_database
            with SessionLocal() as db:
                seed_database(db)
        except Exception as e:
            logger.warning("Database initialization skipped or encountered error: %s", e)
