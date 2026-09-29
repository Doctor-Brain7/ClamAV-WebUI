# Changelog

## Unreleased

- Added a responsive English dashboard for system health, component availability, scan history, and detections.
- Moved frontend files to the root `frontend/` directory, fixed static asset serving, and switched to the requested smaller Square71x71Logo icon.
- Added persistent light/dark theme switching and rootless-only backend startup; scans and CLI commands run as the current user.
- Fixed stylesheet and script loading with versioned relative URLs that work both from FastAPI and direct frontend previews; file previews explain that backend operations require the local server.
- Added a FastAPI backend for scans, updates, daemon and real-time controls, history, and preferences through the `clamweb` CLI.
- Added the MIT license to the web interface and documented setup, CLI commands, and API routes.