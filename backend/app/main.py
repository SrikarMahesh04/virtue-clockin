from time import perf_counter
from uuid import uuid4

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from starlette.exceptions import HTTPException as StarletteHTTPException

from app import attendance, auth, personal, workforce
from app.core.config import settings
from app.db import engine
from app.schemas import Health
from app.operational_logs import write_event

app = FastAPI(title="Virtue ClockIn API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings().allowed_frontend_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Content-Type", "X-CSRF-Token"],
)


@app.middleware("http")
async def request_context(request: Request, call_next):
    request.state.request_id = str(uuid4())
    started = perf_counter()
    try:
        response = await call_next(request)
    except Exception:
        write_event(
            "http.failed",
            method=request.method,
            route=getattr(request.scope.get("route"), "path", "unmatched"),
            status=500,
            request_id=request.state.request_id,
        )
        raise
    write_event(
        "http.request",
        method=request.method,
        route=getattr(request.scope.get("route"), "path", "unmatched"),
        status=response.status_code,
        request_id=request.state.request_id,
        elapsed_ms=round((perf_counter() - started) * 1000, 2),
    )
    response.headers["X-Request-ID"] = request.state.request_id
    response.headers["Cache-Control"] = "no-store"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Referrer-Policy"] = "no-referrer"
    return response


def error_response(request: Request, status: int, code: str, message: str, details=None):
    return JSONResponse(
        status_code=status,
        content={
            "error": {"code": code, "message": message, "details": details or []},
            "request_id": getattr(request.state, "request_id", "unknown"),
        },
    )


@app.exception_handler(StarletteHTTPException)
async def http_error(request: Request, error: StarletteHTTPException):
    raw = str(error.detail)
    code, separator, message = raw.partition(": ")
    return error_response(
        request,
        error.status_code,
        code if separator else "HTTP_ERROR",
        message if separator else raw,
    )


@app.exception_handler(RequestValidationError)
async def validation_error(request: Request, error: RequestValidationError):
    # Pydantic input payloads can include passwords/tokens. Return only safe locations and messages.
    details = [{"field": ".".join(map(str, e["loc"])), "message": e["msg"]} for e in error.errors()]
    return error_response(request, 422, "VALIDATION_ERROR", "Check the submitted fields", details)


@app.exception_handler(IntegrityError)
async def conflict(request: Request, error: IntegrityError):
    return error_response(
        request,
        409,
        "RECORD_CONFLICT",
        "A unique record or relationship conflicts with this change",
    )


@app.exception_handler(SQLAlchemyError)
async def database_error(request: Request, error: SQLAlchemyError):
    write_event("database.unavailable", request_id=request.state.request_id)
    return error_response(
        request, 503, "DEPENDENCY_UNAVAILABLE", "Database unavailable or migrations required"
    )


@app.get("/health", response_model=Health)
def health():
    return {"status": "ok"}


@app.get("/ready", response_model=Health)
def ready():
    try:
        with engine().connect() as connection:
            revision = connection.execute(
                text("SELECT version_num FROM alembic_version")
            ).scalar_one_or_none()
            if revision != "0007":
                raise HTTPException(
                    503, "MIGRATIONS_REQUIRED: Database schema is not at the supported revision"
                )
    except HTTPException:
        raise
    except SQLAlchemyError:
        raise HTTPException(
            503, "DEPENDENCY_UNAVAILABLE: Database or migrations unavailable"
        ) from None
    return {"status": "ready"}


for router in (auth.router, workforce.router, attendance.router, personal.router):
    app.include_router(router)
