from pathlib import Path
from typing import Callable, Literal, Any

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from .service import CommandExecutionError, ClamWebService

ROOT = Path(__file__).resolve().parents[2]
FRONTEND_DIR = ROOT / "frontend"

app = FastAPI(title="ClamAV WebUI", version="1.0.0")
service = ClamWebService()
app.mount("/assets", StaticFiles(directory=FRONTEND_DIR / "assets"), name="assets")


class ScanRequest(BaseModel):
    target: str = Field(min_length=1, max_length=4096)


class PreferencesRequest(BaseModel):
    action: Literal["import", "export", "clear"]


def run_command(operation: Callable[[], Any]) -> Any:
    try:
        return operation()
    except CommandExecutionError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc


@app.get("/", include_in_schema=False)
def dashboard():
    return FileResponse(FRONTEND_DIR / "index.html")


@app.get("/api/status")
def status():
    return run_command(service.version)


@app.post("/api/scan")
def scan(request: ScanRequest):
    return run_command(lambda: service.scan(request.target))


@app.post("/api/update")
def update_database():
    return run_command(service.update)


@app.get("/api/check")
def check_dependencies():
    return run_command(service.check)


@app.get("/api/history")
def history(clear: bool = False):
    return run_command(lambda: service.history(clear=clear))


@app.post("/api/daemon/{action}")
def daemon(action: Literal["reboot", "shutdown", "start", "status"]):
    return run_command(lambda: service.daemon(action))


@app.post("/api/real-time/{state}")
def real_time(state: Literal["on", "off"]):
    return run_command(lambda: service.real_time(state))


@app.post("/api/preferences")
def preferences(request: PreferencesRequest):
    return run_command(lambda: service.preferences(request.action))
