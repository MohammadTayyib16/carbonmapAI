import os
from typing import List
from pathlib import Path
from dotenv import load_dotenv

# Locate and load backend .env if it exists
BASE_DIR = Path(__file__).resolve().parent.parent.parent
ENV_FILE = BASE_DIR / ".env"
if ENV_FILE.exists():
    load_dotenv(ENV_FILE)
else:
    load_dotenv()

# Default SQLite path inside backend directory for persistent local dev
DEFAULT_DB_PATH = (BASE_DIR / "carbonmap.db").as_posix()

class Settings:
    APP_NAME: str = os.getenv("APP_NAME", "CarbonMap AI")
    VERSION: str = os.getenv("VERSION", "0.1.0")
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    DEBUG: bool = os.getenv("DEBUG", "True").lower() in ("true", "1", "yes")
    API_V1_PREFIX: str = os.getenv("API_V1_PREFIX", "/api/v1")

    # CORS configuration
    _allowed_origins_raw: str = os.getenv(
        "ALLOWED_ORIGINS",
        "http://localhost:3000,http://127.0.0.1:3000"
    )
    ALLOWED_ORIGINS: List[str] = [
        origin.strip() for origin in _allowed_origins_raw.split(",") if origin.strip()
    ]

    # Database configuration (PostgreSQL compatible with persistent local SQLite fallback)
    DATABASE_URL: str = os.getenv("DATABASE_URL", f"sqlite:///{DEFAULT_DB_PATH}")

    # Server configuration
    HOST: str = os.getenv("HOST", "127.0.0.1")
    PORT: int = int(os.getenv("PORT", "8000"))

    # Gemini AI configuration
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    GEMINI_MODEL: str = os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite")

settings = Settings()
