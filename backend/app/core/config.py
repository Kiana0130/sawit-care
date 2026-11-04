from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Sawit Care API"
    environment: str = "development"
    api_v1_prefix: str = "/v1"
    database_url: str = "postgresql+asyncpg://sawitcare:sawitcare@localhost:5432/sawitcare"
    db_echo: bool = False
    cors_origins: str = "http://localhost:8081,http://localhost:19006"
    port: int = 8000
    jwt_secret_key: str = "development-only-secret-change-before-deploy-32-bytes"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 30

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


settings = Settings()
