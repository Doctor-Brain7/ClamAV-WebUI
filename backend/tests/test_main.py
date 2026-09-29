import asyncio
import subprocess
import unittest
from pathlib import Path
from unittest.mock import patch

from backend.app import main


class RunCliTests(unittest.TestCase):
    def test_frontend_assets_are_served_with_no_cache(self):
        for response, filename, media_type in (
            (main.styles(), "styles.css", "text/css"),
            (main.javascript(), "app.js", "text/javascript"),
        ):
            self.assertEqual(Path(response.path), main.FRONTEND_DIR / filename)
            self.assertEqual(response.media_type, media_type)
            self.assertEqual(response.headers["cache-control"], "no-store")

    def test_frontend_asset_routes_include_relative_and_legacy_paths(self):
        paths = {route.path for route in main.app.routes}

        self.assertIn("/styles.css", paths)
        self.assertIn("/app.js", paths)
        self.assertIn("/assets/styles.css", paths)
        self.assertIn("/assets/app.js", paths)

    def test_frontend_uses_versioned_relative_asset_urls(self):
        html = (main.FRONTEND_DIR / "index.html").read_text(encoding="utf-8")

        self.assertIn('./styles.css?v=3', html)
        self.assertIn('./app.js?v=3', html)
        self.assertIn('../icons/Square71x71Logo.png?v=1', html)

    def test_startup_rejects_root_user(self):
        async def start_as_root():
            async with main.lifespan(main.app):
                pass

        with patch("backend.app.main.os.geteuid", return_value=0):
            with self.assertRaisesRegex(RuntimeError, "must run as an unprivileged user"):
                asyncio.run(start_as_root())

    def test_custom_profile_requires_path(self):
        request = main.ScanRequest(profile="custom")

        with self.assertRaises(main.HTTPException) as error:
            main.resolve_scan_target(request)

        self.assertEqual(error.exception.status_code, 422)

    def test_custom_profile_uses_supplied_path(self):
        request = main.ScanRequest(profile="custom", path=" /tmp/sample ")

        self.assertEqual(main.resolve_scan_target(request), "/tmp/sample")

    def test_linux_profiles_use_documented_targets(self):
        with patch("backend.app.main.os.name", "posix"):
            self.assertEqual(
                main.resolve_scan_target(main.ScanRequest(profile="quick")),
                "/home",
            )
            self.assertEqual(
                main.resolve_scan_target(main.ScanRequest(profile="full")),
                "/",
            )

    @patch("backend.app.main.shutil.which", return_value="/usr/bin/clamweb")
    @patch("backend.app.main.subprocess.run")
    def test_passes_arguments_without_a_shell(self, run, _which):
        run.return_value = subprocess.CompletedProcess(
            args=["clamweb", "--version"],
            returncode=0,
            stdout="clamweb 1.0",
            stderr="",
        )

        result = main.run_cli("--version")

        self.assertEqual(result["output"], "clamweb 1.0")
        self.assertEqual(run.call_args.args[0], ["/usr/bin/clamweb", "--version"])
        self.assertFalse(run.call_args.kwargs["shell"])

    @patch("backend.app.main.shutil.which", return_value=None)
    def test_reports_missing_cli(self, _which):
        with self.assertRaises(main.CLIError) as error:
            main.run_cli("--check")

        self.assertEqual(error.exception.status_code, 503)
        self.assertIn("was not found", str(error.exception))

    @patch("backend.app.main.shutil.which", return_value="/usr/bin/clamweb")
    @patch("backend.app.main.subprocess.run")
    def test_reports_cli_failure(self, run, _which):
        run.return_value = subprocess.CompletedProcess(
            args=["clamweb", "--check"],
            returncode=2,
            stdout="",
            stderr="daemon unavailable",
        )

        with self.assertRaises(main.CLIError) as error:
            main.run_cli("--check")

        self.assertEqual(error.exception.status_code, 502)
        self.assertEqual(str(error.exception), "daemon unavailable")


if __name__ == "__main__":
    unittest.main()
