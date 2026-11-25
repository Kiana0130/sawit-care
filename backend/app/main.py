from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.core.security import validate_runtime_settings

validate_runtime_settings()

from app.api.auth import router as auth_router
from app.api.health import router as health_router
from app.api.payments import router as payments_router
from app.api.scans import dashboard_router, router as scans_router
from app.api.users import router as users_router

app = FastAPI(title=settings.app_name, version="0.1.0")


@app.exception_handler(RequestValidationError)
async def validation_error_handler(_: Request, exc: RequestValidationError) -> JSONResponse:
    errors = exc.errors()
    email_error = any("email" in error.get("loc", ()) for error in errors)
    password_error = any("password" in error.get("loc", ()) for error in errors)
    if email_error:
        detail = "INVALID_EMAIL"
    elif password_error:
        detail = "INVALID_PASSWORD"
    else:
        detail = "INVALID_INPUT"
    return JSONResponse(status_code=422, content={"detail": detail})

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health_router, prefix=settings.api_v1_prefix)
app.include_router(payments_router, prefix=settings.api_v1_prefix)
app.include_router(auth_router, prefix=settings.api_v1_prefix)
app.include_router(users_router, prefix=settings.api_v1_prefix)
app.include_router(scans_router, prefix=settings.api_v1_prefix)
app.include_router(dashboard_router, prefix=settings.api_v1_prefix)


@app.get("/")
async def root() -> dict[str, str]:
    return {"service": settings.app_name, "docs": "/docs"}
