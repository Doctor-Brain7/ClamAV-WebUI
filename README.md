# ClamAV WebUI

A modern, cross-platform web dashboard for ClamAV antivirus engine management and real-time protection.

## Overview

ClamAV WebUI provides a professional, minimalist interface for managing ClamAV antivirus operations across Linux and Windows platforms. The application combines a dark, sleek design with powerful functionality tailored for technical users.

## System Requirements

- **Operating Systems**: Linux (Debian/Ubuntu-based, AppImage), Windows (portable .exe, .msi installer)
- **Dependencies**: ClamAV engine, clamav-daemon, clamav-freshclam
- **Architecture**: Multi-platform support with platform-specific packaging

## Core Features

### Release Roadmap

#### Version 0.0 BETA
- Initial integration of 1.0 feature set
- Software stability and bug fixes
- Core functionality validation

#### Version 1.0 - Production Release

**User Interface**
- Ultra-modern web interface with dark theme and vibrant red accents
- Hierarchical typography and modular, minimal design components
- Optimized for technical audiences
- The ClamAV WebUI dashboard is served locally on port 19458 by default.

**System Integration**
- Automatic detection of installed components (clamav, clamav-daemon, clamav-freshclam, engine version, virus database)
- Guided installation of missing dependencies
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

**Quarantine Management**
- Access and manage quarantined files
- Restore or permanently delete threats
- Quarantine history and inspection

**Analytics & Reporting**
- Comprehensive scan history
- Statistical analysis of scan results
- Performance metrics and threat trends
- Historical data tracking

## Technical Stack

- **Backend**: Python 3.10+ with FastAPI and Uvicorn
- **Frontend**: English HTML, CSS, and vanilla JavaScript served by FastAPI
- **CLI integration**: the backend executes the `clamweb` command with validated operation arguments

## Installation

### Development setup

```bash
python -m venv .venv
source .venv/bin/activate       # Linux/macOS
# .venv\Scripts\activate        # Windows
pip install -r backend/requirements.txt
uvicorn backend.app.main:app --host 127.0.0.1 --port 19458
```

The dashboard is then available at `http://localhost:19458`. The `clamweb` executable must be installed and available in `PATH`.

### Linux (Debian/Ubuntu-based)

**DEB Package**
```bash
sudo dpkg -i clamav-webui_1.0_amd64.deb
```

**AppImage**
```bash
chmod +x ClamAV-WebUI-1.0.AppImage
./ClamAV-WebUI-1.0.AppImage
```

### Windows

**Portable Executable**
```
ClamAV-WebUI-1.0-portable.exe
```

**MSI Installer**
```
ClamAV-WebUI-1.0-setup.msi
```

## Usage

### Starting the Application

The web interface will be accessible at `http://localhost:19458` (default port).

### Initial Setup

1. Launch ClamAV WebUI
2. Application automatically detects installed ClamAV components
3. If components are missing, follow the guided installation process
4. Configure scanning profiles and real-time protection settings
5. Access the dashboard for active monitoring

### Scanning Files

1. Navigate to the Scan section
2. Select desired scan profile (Quick, Full, or Custom)
3. Choose target directories if using Custom profile
4. Initiate scan and monitor progress
5. Review results and manage detected threats

### Managing Real-Time Protection

1. Access Protection settings
2. Enable/disable real-time daemon
3. Configure monitored directories
4. Adjust threat response actions
5. Review real-time activity logs

### Quarantine Operations

1. Navigate to Quarantine section
2. View all quarantined items with detection details
3. Restore files or permanently delete threats
4. Export quarantine logs for compliance

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

The web API exposes the supported dashboard operations under `/api/status`, `/api/scan`, `/api/update`, `/api/check`, `/api/history`, `/api/daemon/{action}`, `/api/real-time/{state}`, and `/api/preferences`.

## Technical Architecture

### Frontend
- Responsive HTML/CSS/JavaScript dashboard
- Dark `#222222` header and navigation bands
- `#f23d41` action buttons and `#ffffff` page background
- Real-time status updates and operation results

### Backend
- FastAPI service with typed request validation
- ClamAV engine and `clamweb` CLI integration
- Daemon, real-time protection, scan, history, update, and preferences endpoints
- Static frontend hosting and explicit command errors

### Security
- Privilege escalation handling for system scans
- Secure file quarantine storage
- Configuration validation
- Audit logging

## Configuration

Configuration files are stored in platform-specific locations:

- **Linux**: `~/.config/clamav-webui/`
- **Windows**: `%APPDATA%\ClamAV-WebUI\`

Import and export functionality allows backup and migration of settings.

## Troubleshooting

### ClamAV Components Not Detected

Ensure ClamAV is installed and accessible in system PATH:
```bash
which clamav      # Linux
where clamav.exe  # Windows
```

### Daemon Not Starting

Check system permissions and verify ClamAV daemon dependencies are installed.

### Database Update Issues

Verify freshclam configuration and internet connectivity for virus definition updates.

## Project Status

This project is under active development. Version 0.0 BETA focuses on stability and core feature integration. Production release (1.0) targets Q2 2024.

## Contributing

Code contributions are welcome. Please ensure:
- All code is written in English
- Minimal, focused code comments
- Adherence to modular architecture principles
- Cross-platform compatibility testing

## Support

For issues, questions, or feature requests, please open an issue on the project repository.

---

**Last Updated**: September 2024
