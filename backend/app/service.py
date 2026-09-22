import json
import subprocess
from typing import Any


class CommandExecutionError(RuntimeError):
    """Raised when the clamweb executable cannot complete an operation."""


class ClamWebService:
    executable = "clamweb"

    def _run(self, *args: str) -> dict[str, Any]:
        command = [self.executable, *args]
        try:
            result = subprocess.run(
                command,
                capture_output=True,
                text=True,
                check=False,
                timeout=300,
            )
        except (FileNotFoundError, subprocess.TimeoutExpired, OSError) as exc:
            raise CommandExecutionError(
                f"Unable to execute {' '.join(command)}: {exc}"
            ) from exc

        output = (result.stdout or result.stderr).strip()
        if result.returncode != 0:
            raise CommandExecutionError(output or f"Command exited with code {result.returncode}")

        try:
            data = json.loads(output) if output else {}
        except json.JSONDecodeError:
            data = {"output": output}
        return {"command": " ".join(command), "success": True, "data": data}

    def version(self) -> dict[str, Any]:
        return self._run("--version")

    def scan(self, target: str) -> dict[str, Any]:
        return self._run("--scan", target)

    def update(self) -> dict[str, Any]:
        return self._run("--update")

    def check(self) -> dict[str, Any]:
        return self._run("--check")

    def history(self, clear: bool = False) -> dict[str, Any]:
        return self._run("--history", "-c") if clear else self._run("--history")

    def daemon(self, action: str) -> dict[str, Any]:
        return self._run("--daemon", action)

    def real_time(self, state: str) -> dict[str, Any]:
        return self._run("--real-time", state)

    def preferences(self, action: str) -> dict[str, Any]:
        return self._run("preferences", f"--{action}")
