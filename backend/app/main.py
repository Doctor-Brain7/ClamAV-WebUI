from __future__ import annotations

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
import os
import shutil
import subprocess
from pathlib import Path
from typing import Literal
from urllib.parse import urlsplit

from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, field_validator
from starlette.middleware.base import RequestResponseEndpoint


PROJECT_ROOT = Path(__file__).resolve().parents[2]
FRONTEND_DIR = PROJECT_ROOT / "frontend"
CLI_NAME = os.environ.get("CLAMWEB_CLI", "clamweb")
CLI_TIMEOUT_SECONDS = 30
SCAN_TIMEOUT_SECONDS = 60 * 60


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    if os.name == "posix" and os.geteuid() == 0:
        raise RuntimeError(
            "ClamAV WebUI must run as an unprivileged user; "
            "do not launch it with sudo or as root."
        )
    yield


class CLIError(RuntimeError):
    def __init__(self, message: str, status_code: int = 502) -> None:
        super().__init__(message)
        self.status_code = status_code


class ScanRequest(BaseModel):
    profile: Literal["quick", "full", "custom"] = "custom"
    path: str | None = Field(default=None, max_length=4096)

    @field_validator("path")
    @classmethod
    def validate_path(cls, value: str | None) -> str | None:
        if value is None:
            return value
        value = value.strip()
        if not value or "\x00" in value:
            raise ValueError("Enter a valid file or directory path.")
        return value


def resolve_scan_target(request: ScanRequest) -> str:
    if request.profile == "custom":
        if request.path is None:
            raise HTTPException(
                status_code=422,
                detail="A file or directory path is required for a custom scan.",
            )
        return request.path
    if request.profile == "quick":
        return (
            os.path.join(os.environ.get("SystemDrive", "C:"), os.sep, "Users")
            if os.name == "nt"
            else "/home"
        )
    return (
        os.path.join(os.environ.get("SystemDrive", "C:"), os.sep)
        if os.name == "nt"
        else "/"
    )


class PreferenceRequest(BaseModel):
    action: Literal["import", "export", "clear"]


def resolve_cli() -> str:
    executable = shutil.which(CLI_NAME)
    if executable is None:
        raise CLIError(
            f"The clamweb CLI was not found ({CLI_NAME!r}). Install it or set CLAMWEB_CLI.",
            status_code=503,
        )
    return executable


def run_cli(*arguments: str, timeout: int = CLI_TIMEOUT_SECONDS) -> dict[str, object]:
    executable = resolve_cli()
    try:
        result = subprocess.run(
            [executable, *arguments],
            capture_output=True,
            text=True,
            check=False,
            timeout=timeout,
            shell=False,
        )
    except subprocess.TimeoutExpired as error:
        raise CLIError(
            f"clamweb command timed out after {timeout} seconds: {error.cmd!r}",
            status_code=504,
        ) from error
    except OSError as error:
        raise CLIError(f"Could not execute the clamweb CLI: {error}") from error

    output = "\n".join(
        part.strip() for part in (result.stdout, result.stderr) if part.strip()
    )
    if result.returncode != 0:
        message = output or f"clamweb exited with status {result.returncode}."
        raise CLIError(message)

    return {
        "command": ["clamweb", *arguments],
        "output": output,
        "exit_code": result.returncode,
    }


def run_cli_for_status(*arguments: str) -> dict[str, object]:
    try:
        return run_cli(*arguments)
    except CLIError as error:
        return {"error": str(error)}


def raise_http_cli_error(error: CLIError) -> None:
    raise HTTPException(status_code=error.status_code, detail=str(error)) from error


app = FastAPI(
    title="ClamAV WebUI",
    description="Local dashboard API for ClamAV and the clamweb command-line tool.",
    version="0.0.1",
    lifespan=lifespan,
)


@app.middleware("http")
async def reject_cross_origin_mutations(
    request: Request,
    call_next: RequestResponseEndpoint,
) -> Response:
    if request.method in {"POST", "PUT", "PATCH", "DELETE"}:
        origin = request.headers.get("origin")
        if origin is not None:
            try:
                origin_parts = urlsplit(origin)
            except ValueError:
                origin_parts = None
            host = request.headers.get("host", "")
            if (
                origin_parts is None
                or origin_parts.scheme not in {"http", "https"}
                or origin_parts.scheme != request.url.scheme
                or origin_parts.netloc.casefold() != host.casefold()
                or origin_parts.path not in {"", "/"}
                or origin_parts.query
                or origin_parts.fragment
            ):
                return JSONResponse(
                    status_code=403,
                    content={"detail": "Cross-origin state-changing requests are not allowed."},
                )
    return await call_next(request)


@app.get("/api/status")
def get_status() -> dict[str, object]:
    component_names = {
        "clamweb": CLI_NAME,
        "clamav_scanner": "clamscan",
        "clamav_daemon": "clamd",
        "virus_database_updater": "freshclam",
    }
    components = {
        name: {"executable": executable, "installed": shutil.which(executable) is not None}
        for name, executable in component_names.items()
    }
    return {
        "components": components,
        "version": run_cli_for_status("--version"),
        "system_check": run_cli_for_status("--check"),
        "daemon": run_cli_for_status("--daemon", "status"),
    }


@app.get("/api/daemon")
def get_daemon_status() -> dict[str, object]:
    try:
        return run_cli("--daemon", "status")
    except CLIError as error:
        raise_http_cli_error(error)


@app.get("/api/check")
def check_system() -> dict[str, object]:
    try:
        return run_cli("--check")
    except CLIError as error:
        raise_http_cli_error(error)


@app.post("/api/scan")
def scan(request: ScanRequest) -> dict[str, object]:
    try:
        return run_cli(
            "--scan",
            resolve_scan_target(request),
            timeout=SCAN_TIMEOUT_SECONDS,
        )
    except CLIError as error:
        raise_http_cli_error(error)


@app.post("/api/update")
def update_virus_database() -> dict[str, object]:
    try:
        return run_cli("--update", timeout=SCAN_TIMEOUT_SECONDS)
    except CLIError as error:
        raise_http_cli_error(error)


@app.get("/api/history")
def get_history() -> dict[str, object]:
    try:
        return run_cli("--history")
    except CLIError as error:
        raise_http_cli_error(error)


@app.delete("/api/history")
def clear_history() -> dict[str, object]:
    try:
        return run_cli("--history", "-c")
    except CLIError as error:
        raise_http_cli_error(error)


@app.post("/api/daemon/{action}")
def control_daemon(action: Literal["start", "reboot", "shutdown"]) -> dict[str, object]:
    try:
        return run_cli("--daemon", action)
    except CLIError as error:
        raise_http_cli_error(error)


@app.post("/api/real-time/{state}")
def control_real_time(state: Literal["on", "off"]) -> dict[str, object]:
    try:
        return run_cli("--real-time", state)
    except CLIError as error:
        raise_http_cli_error(error)


@app.post("/api/preferences")
def manage_preferences(request: PreferenceRequest) -> dict[str, object]:
    try:
        return run_cli("preferences", f"--{request.action}")
    except CLIError as error:
        raise_http_cli_error(error)


@app.get("/", include_in_schema=False)
def index() -> FileResponse:
    return FileResponse(
        FRONTEND_DIR / "index.html",
        headers={"Cache-Control": "no-store"},
    )


@app.get("/assets/styles.css", include_in_schema=False)
@app.get("/styles.css", include_in_schema=False)
def styles() -> FileResponse:
    return FileResponse(
        FRONTEND_DIR / "styles.css",
        media_type="text/css",
        headers={"Cache-Control": "no-store"},
    )


@app.get("/assets/app.js", include_in_schema=False)
@app.get("/app.js", include_in_schema=False)
def javascript() -> FileResponse:
    return FileResponse(
        FRONTEND_DIR / "app.js",
        media_type="text/javascript",
        headers={"Cache-Control": "no-store"},
    )


app.mount(
    "/icons",
    StaticFiles(directory=PROJECT_ROOT / "icons"),
    name="icons",
)
