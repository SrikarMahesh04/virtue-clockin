from functools import lru_cache
from typing import Literal
from urllib.parse import urlsplit, urlunsplit

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    app_env: str = "development"
    database_url: str = ""
    frontend_origin: str = "http://localhost:3000"
    frontend_additional_origins: str = ""
    app_base_url: str = "http://localhost:3000"
    cookie_secure: bool = False
    trusted_proxy_cidrs: str = ""
    clockin_proxy_secret: str = ""
    email_provider: Literal["smtp", "gmail_api"] = "smtp"
    gmail_client_id: str = ""
    gmail_client_secret: SecretStr = SecretStr("")
    gmail_refresh_token: SecretStr = SecretStr("")
    gmail_sender: str = ""
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_from: str = ""
    smtp_starttls: bool = True

    @property
    def allowed_frontend_origins(self) -> list[str]:
        origins = [self.frontend_origin]
        # Only local development/test gets loopback aliases. Production stays exact.
        if self.app_env in ("development", "test"):
            origins.extend(
                value.strip()
                for value in self.frontend_additional_origins.split(",")
                if value.strip()
            )
            origins.extend(["http://localhost:3000", "http://127.0.0.1:3000"])
            origin = urlsplit(self.frontend_origin)
            if origin.scheme == "http" and origin.hostname in ("localhost", "127.0.0.1"):
                alias = "127.0.0.1" if origin.hostname == "localhost" else "localhost"
                authority = f"{alias}:{origin.port}" if origin.port else alias
                origins.append(urlunsplit((origin.scheme, authority, "", "", "")))
        return list(dict.fromkeys(origins))

    @property
    def email_configured(self) -> bool:
        if self.email_provider == "gmail_api":
            return bool(
                self.gmail_client_id
                and self.gmail_client_secret.get_secret_value()
                and self.gmail_refresh_token.get_secret_value()
                and self.gmail_sender
            )
        return bool(self.smtp_host and self.smtp_from)

    @property
    def email_sender(self) -> str:
        return self.gmail_sender if self.email_provider == "gmail_api" else self.smtp_from


@lru_cache
def settings() -> Settings:
    value = Settings()
    if value.app_env == "production" and (
        not value.cookie_secure or not value.frontend_origin.startswith("https://")
    ):
        raise ValueError("Production requires secure cookies and an HTTPS frontend origin")
    if value.app_env == "production" and len(value.clockin_proxy_secret) < 32:
        raise ValueError(
            "Production requires a private CLOCKIN_PROXY_SECRET of at least 32 characters"
        )
    if value.app_env == "production":
        for origin in (value.frontend_origin, value.app_base_url):
            parsed = urlsplit(origin)
            if (
                parsed.scheme != "https"
                or not parsed.hostname
                or parsed.hostname in ("localhost", "127.0.0.1", "::1")
                or parsed.username
                or parsed.password
                or parsed.path
                or parsed.query
                or parsed.fragment
            ):
                raise ValueError(
                    "Production frontend/link origins must be exact public HTTPS origins"
                )
        if value.app_base_url != value.frontend_origin:
            raise ValueError("Production account links must use the configured frontend origin")
        if not value.database_url:
            raise ValueError("Production requires DATABASE_URL")
    return value
