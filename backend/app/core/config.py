from pydantic_settings import BaseSettings
from pydantic import ConfigDict
from pathlib import Path
from typing import Optional

BASE_DIR = Path(__file__).resolve().parent.parent.parent


class Settings(BaseSettings):
    APP_NAME: str = "Rapor Asistan"
    APP_TAGLINE: str = "Trainable Text-to-SQL reporting cockpit"
    ASSISTANT_NAME: str = "Rapor-AI"
    APP_VERSION: str = "4.2.0"

    ACTIVE_PACK: str = "demo"

    LLM_PROVIDER: str = "gemini"

    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-2.0-flash"

    GROQ_API_KEY: str = ""
    GROQ_MODEL: str = "openai/gpt-oss-20b"

    OLLAMA_BASE_URL: str = "http://localhost:11434"
    LLM_MODEL: str = "qwen2.5-coder:7b"

    SCHEMA_METADATA_PATH: str = str(BASE_DIR.parent / "database" / "schema_metadata.json")
    GOLDEN_SQL_PATH: str = str(BASE_DIR.parent / "database" / "golden_sql.json")

    DB_BACKEND: str = "sqlite"
    SQLITE_PATH: str = ""
    MSSQL_SERVER: str = "localhost"
    MSSQL_DATABASE: str = ""
    MSSQL_USER: str = ""
    MSSQL_PASSWORD: str = ""
    MSSQL_DRIVER: str = "ODBC Driver 17 for SQL Server"

    DEFAULT_FIRM: str = "MAIN"
    DEFAULT_DATABASE: str = "demo"
    SQL_DIALECT: str = "sqlite"

    ADMIN_USERNAME: str = "admin"
    ADMIN_PASSWORD: str = "admin123"
    ADMIN_FULL_NAME: str = "System Admin"

    SETUP_COMPLETE: bool = False
    KNOWLEDGE_DB_PATH: str = ""

    model_config = ConfigDict(
        env_file=str(BASE_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
