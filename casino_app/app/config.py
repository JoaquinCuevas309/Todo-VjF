from pydantic import SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )

    # Base de datos
    DB_HOST: str
    DB_PORT: int = 5432
    DB_NAME: str
    DB_USER: str
    DB_PASSWORD: SecretStr
    DB_POOL_SIZE: int = 10
    DB_MAX_OVERFLOW: int = 5
    DB_POOL_TIMEOUT: int = 30

    # JWT
    JWT_SECRET_KEY: SecretStr
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Rate limiting
    RATE_LIMIT_AUTH: str = "5/minute"
    RATE_LIMIT_API: str = "100/minute"

    # Entorno
    ENVIRONMENT: str = "production"
    LOG_LEVEL: str = "INFO"

    @field_validator("JWT_SECRET_KEY")
    @classmethod
    def secret_must_be_strong(cls, v: SecretStr) -> SecretStr:
        if len(v.get_secret_value()) < 32:
            raise ValueError("JWT_SECRET_KEY must be at least 32 characters")
        return v

    @property
    def database_url(self) -> str:
        pwd = self.DB_PASSWORD.get_secret_value()
        return (
            f"postgresql+asyncpg://{self.DB_USER}:{pwd}"
            f"@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"
        )

    @property
    def database_url_safe(self) -> str:
        return (
            f"postgresql+asyncpg://{self.DB_USER}:***"
            f"@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"
        )


settings = Settings()  # type: ignore[call-arg]
