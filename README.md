# ClamAV WebUI

A modern, cross-platform web dashboard for ClamAV antivirus engine management and real-time protection.

## Overview

ClamAV WebUI provides a professional, minimalist interface for managing ClamAV antivirus operations across Linux and Windows platforms. The application uses a white workspace, charcoal navigation bands, and red action buttons.

## System Requirements

- **Operating Systems**: Linux, macOS, and Windows when running under a regular user account
- **Dependencies**: Python 3.10+, the `clamweb` CLI, and the ClamAV components you want to manage
- **Deployment**: Local web server on an unprivileged port; no privileged installer required

## Core Features

### Release Roadmap

#### Version 0.0 BETA
- Initial integration of 1.0 feature set
- Software stability and bug fixes
- Core functionality validation

#### Version 1.0 - Production Release

**User Interface**
- Responsive web interface with light and dark themes, charcoal navigation bands, and red accents
- Hierarchical typography and modular, minimal design components
- Optimized for technical audiences
- The ClamAV WebUI dashboard is served locally on port 19458 by default.

**System Integration**
- Detection of installed components (clamweb, clamscan, clamd, and freshclam)
- Clear reporting of missing dependencies and the CLI system-check output
- Native packaging for multiple distributions

**Scanning Capabilities**
- **Quick Scan**: Home directories (/home on Linux, C:\Users on Windows)
- **Full Scan**: Entire filesystem (/ on Linux, C:\ on Windows)
- **Custom Scan**: User-defined paths and parameters
- Scan profiles for flexible malware detection

**Real-Time Protection**
- Custom daemon for continuous monitoring
- Protected directories:
  - Linux: /home, /media, /dev, /mnt, /run
  - Windows: C:\Users
- Automatic threat detection and response

**Configuration Management**
- Import/export ClamAV configuration parameters
- Import/export ClamAV-WebUI application settings
- Automated ClamAV configuration interface
- Customizable scanning profiles and protection rules

**Quarantine Management (Planned)**
- Not available until quarantine operations are exposed by the supplied CLI

**Analytics & Reporting**
- Comprehensive scan history
- Statistical analysis of scan results
- Performance metrics and threat trends
- Historical data tracking

## Technical Stack

- **Backend**: Python 3.10+ with FastAPI and Uvicorn
- **Frontend**: English HTML, CSS, and vanilla JavaScript in the root `frontend/` directory, served by FastAPI
- **CLI integration**: the backend executes the `clamweb` command with validated operation arguments

## Installation

### Development setup

```bash
python -m venv .venv
source .venv/bin/activate       # Linux/macOS
# .venv\Scripts\activate        # Windows
python -m pip install -r backend/requirements.txt
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 19458
```

The dashboard is then available at `http://127.0.0.1:19458`. Run it as your regular user; the backend explicitly refuses to start as root on Linux/macOS. The `clamweb` executable is launched with the same permissions as the web application. Some daemon controls, database updates, or paths may be unavailable to an unprivileged account; the web application never elevates permissions. ClamAV components and the `clamweb` CLI must be installed separately. Set `CLAMWEB_CLI` if the executable uses a different name or location. Open the dashboard through this local server to enable its backend features; the relative stylesheet and script also work in direct frontend previews.

The project currently provides the Python development setup above; privileged system installers are not required or provided.

## Usage

### Starting the Application

The web interface will be accessible at `http://localhost:19458` (default port).

### Initial Setup

1. Install ClamAV WebUI and the `clamweb` command-line tool.
2. Start the local web server and open `http://localhost:19458`.
3. Review detected ClamAV executables and the system check output on the overview.
4. Use Scan, Protection, and Settings to run the corresponding `clamweb` operations.
5. Use the theme button in the top bar to switch between light and dark mode. Your choice is saved in this browser.

The dashboard reports missing components; it does not install system packages.

### Scanning Files

1. Navigate to the Scan section.
2. Select Quick, Full, or Custom.
3. For a custom scan, enter a path readable by the account running the backend.
4. Start the scan and review the output returned by `clamweb`.

Scans always run without elevated privileges. A full filesystem scan can therefore report unreadable system paths.

### Managing Real-Time Protection

1. Open Protection.
2. Start, reboot, or shut down the daemon, or enable/disable real-time protection.
3. Review the command output and daemon status returned by `clamweb`.

### Quarantine

Quarantine management is not available in this dashboard because the supplied `clamweb` CLI does not include quarantine commands.

## CLI

The backend integrates the following `clamweb` commands:

```bash
clamweb --version
clamweb --scan /path/or/file
clamweb --update
clamweb --check
clamweb --history
clamweb --history -c
clamweb --daemon reboot
clamweb --daemon shutdown
clamweb --daemon start
clamweb --daemon status
clamweb --real-time on
clamweb --real-time off
clamweb preferences --import
clamweb preferences --export
clamweb preferences --clear
```

The local web API exposes these operations:

| Method | Endpoint | Operation |
| --- | --- | --- |
| `GET` | `/api/status` | Detect CLI components and read version, system check, and daemon status |
| `GET` | `/api/check` | Run `clamweb --check` |
| `POST` | `/api/scan` | Scan a target; JSON body: `{"profile":"quick"}`, `{"profile":"full"}`, or `{"profile":"custom","path":"/path"}` |
| `POST` | `/api/update` | Run `clamweb --update` |
| `GET` / `DELETE` | `/api/history` | Read or clear scan history |
| `GET` | `/api/daemon` | Read daemon status |
| `POST` | `/api/daemon/{start\|reboot\|shutdown}` | Control the daemon |
| `POST` | `/api/real-time/{on\|off}` | Set real-time protection |
| `POST` | `/api/preferences` | JSON body `{"action":"import"}`, `{"action":"export"}`, or `{"action":"clear"}` |

## Technical Architecture

### Frontend
- Responsive HTML/CSS/JavaScript dashboard
- Frontend files live in `frontend/` at the project root; the stylesheet and JavaScript use relative URLs so they also load in a direct frontend preview
- FastAPI serves the files from both `/styles.css` and `/app.js` and the legacy `/assets/` URLs, with caching disabled
- Persistent light and dark themes
- `#222222` header and navigation bands
- `#f23d41` action buttons and `#ffffff` page background
- System status, component availability, and operation results

### Backend
- FastAPI service with typed request validation
- ClamAV engine and `clamweb` CLI integration
- Daemon, real-time protection, quick/full/custom scan, history, update, and preferences endpoints
- Static frontend hosting and explicit command errors

### Security
- CLI calls use argument lists rather than shell command strings
- Cross-origin state-changing browser requests are rejected
- The backend refuses to start as root on Linux/macOS and never elevates CLI commands
- Scan profile and preference inputs are validated by the API
- CLI failures and timeouts are returned explicitly
- Run the local service as an account with only the permissions required for its scans

## Configuration

Preference storage and import/export behavior are managed by the installed `clamweb` CLI.

## Troubleshooting

### ClamAV Components Not Detected

Ensure ClamAV is installed and accessible in system PATH:
```bash
which clamweb clamscan clamd freshclam  # Linux
where clamweb.exe clamscan.exe clamd.exe freshclam.exe  # Windows
```

### Daemon Not Starting

Check system permissions and verify ClamAV daemon dependencies are installed.

### Database Update Issues

Verify freshclam configuration and internet connectivity for virus definition updates.

## Project Status

This project is under active development. Version 0.0 BETA focuses on stability and core feature integration. A production release date has not been set.

## Contributing

Code contributions are welcome. Please ensure:
- All code is written in English
- Minimal, focused code comments
- Adherence to modular architecture principles
- Cross-platform compatibility testing

## Support

For issues, questions, or feature requests, please open an issue on the project repository.

---

**Last Updated**: September 2026
