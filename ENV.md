# Environment configuration

Copy the separate frontend/backend `.env.example` files to ignored local environment files. Never commit actual credentials. Restart the API after configuration changes.

| Backend variable | Meaning |
|---|---|
| APP_ENV | development/test/staging/production; production requires HTTPS frontend and secure cookies |
| DATABASE_URL | PostgreSQL SQLAlchemy DSN; required for readiness and protected workflows |
| FRONTEND_ORIGIN | Exact browser origin; local default http://localhost:3000. Development/test also accept its localhost/127.0.0.1 alias at the same port; production/staging stay exact. |
| FRONTEND_ADDITIONAL_ORIGINS | Comma-separated exact LAN browser origins in development/test only; Windows launcher adds current private IPv4 origins. |
| APP_BASE_URL | Frontend origin used for account links |
| COOKIE_SECURE | false locally, true on production HTTPS |
| TRUSTED_PROXY_CIDRS | Comma-separated trusted proxies; empty for direct local requests |
| SMTP_HOST / SMTP_PORT | Optional SMTP endpoint |
| SMTP_USERNAME / SMTP_PASSWORD / SMTP_FROM | Private credentials and approved sender |
| SMTP_STARTTLS | true by default |

Frontend: `NEXT_PUBLIC_API_BASE_URL` is the browser-safe API origin, default http://localhost:8000. For local HTTP loopback addresses, its hostname follows the browser (localhost or 127.0.0.1) to keep session cookies same-site. Custom remote API URLs remain unchanged. No API proxy is used, preserving the backend's direct office-network verification. Office timezone comes from the API.

Tests: `TEST_DATABASE_URL` must target a separate PostgreSQL database with test in its name. Synthetic fixtures stay in isolated schemas. Optional Windows `DISABLE_SQLALCHEMY_CEXT_RUNTIME=1` selects SQLAlchemy's supported pure-Python runtime.

Coordinates, geofence, accuracy, approved office CIDRs and weekly offs belong in System settings with internal change logs. Shift start/end intervals belong in shift definitions and effective assignments. No real office values are hardcoded.

Google Maps: set `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` and `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID` in `frontend/.env.local`. Enable Maps JavaScript API and Geocoding API in your billing-enabled Google project. Use a browser key restricted to your frontend websites and those APIs. Restart/rebuild the frontend after changing these variables. See [Google Maps setup](docs/GOOGLE_MAPS.md). Missing configuration is shown explicitly; no live provider success is assumed.

Missing database => readiness fails. Missing office policy => punches blocked. Missing SMTP => email recovery/dispatch explicitly unavailable. SSO and scheduled reminders are deferred.

Phone development: loopback API configuration follows the browser's local/private hostname and protocol (including LAN IPv4 and `.local` names). Both ports must be reachable. Use trusted HTTPS for mobile location access; [phone setup](docs/PHONE_ACCESS.md) covers TLS and a local-subnet-only Windows firewall rule.
