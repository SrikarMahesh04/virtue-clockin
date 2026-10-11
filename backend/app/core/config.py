from functools import lru_cache
from urllib.parse import urlsplit, urlunsplit

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
        return bool(self.smtp_host and self.smtp_from)


@lru_cache
def settings() -> Settings:
    value = Settings()
    if value.app_env == "production" and (
        not value.cookie_secure or not value.frontend_origin.startswith("https://")
    ):
        raise ValueError("Production requires secure cookies and an HTTPS frontend origin")
    return value
