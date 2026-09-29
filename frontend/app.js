const componentLabels = {
  clamweb: ["ClamAV WebUI CLI", "CL"],
  clamav_scanner: ["ClamAV scanner", "AV"],
  clamav_daemon: ["ClamAV daemon", "D"],
  virus_database_updater: ["Virus database updater", "DB"],
};

const views = ["overview", "scan", "history", "protection", "settings"];
const statusElements = {
  daemon: document.querySelector("#daemon-status"),
  daemonPill: document.querySelector("#daemon-pill"),
  protectionDaemonPill: document.querySelector("#protection-daemon-pill"),
};

function applyTheme(theme) {
  const selectedTheme = theme === "dark" ? "dark" : "light";
  document.documentElement.dataset.theme = selectedTheme;
  const toggle = document.querySelector("#theme-toggle");
  const nextTheme = selectedTheme === "dark" ? "light" : "dark";
  const label = selectedTheme === "dark" ? "Light mode" : "Dark mode";
  toggle.setAttribute("aria-label", `Switch to ${nextTheme} mode`);
  toggle.setAttribute("aria-pressed", String(selectedTheme === "dark"));
  document.querySelector("#theme-label").textContent = label;
  document.querySelector('meta[name="theme-color"]').content = selectedTheme === "dark" ? "#18191b" : "#222222";
}

function loadSavedTheme() {
  try {
    return localStorage.getItem("clamav-webui-theme")
      || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  } catch (error) {
    showToast(`Could not read the saved theme preference: ${error.message}`, true);
    return "light";
  }
}

function saveTheme(theme) {
  try {
    localStorage.setItem("clamav-webui-theme", theme);
  } catch (error) {
    showToast(`Theme changed, but could not save the preference: ${error.message}`, true);
  }
}

function showToast(message, isError = false) {
  const toast = document.querySelector("#toast");
  toast.textContent = message;
  toast.classList.remove("hidden");
  toast.style.borderLeft = `3px solid ${isError ? "#f23d41" : "#4ab386"}`;
  window.clearTimeout(showToast.timeout);
  showToast.timeout = window.setTimeout(() => toast.classList.add("hidden"), 4500);
}

applyTheme(loadSavedTheme());
document.querySelector("#theme-toggle").addEventListener("click", () => {
  const theme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  applyTheme(theme);
  saveTheme(theme);
});

async function apiRequest(url, options = {}) {
  if (window.location.protocol === "file:") {
    throw new Error("The backend API is unavailable in a direct file preview. Start the local server and open http://127.0.0.1:19458.");
  }
  const response = await fetch(url, {
    ...options,
    headers: { Accept: "application/json", ...options.headers },
  });
  let payload;
  try {
    payload = JSON.parse(await response.text());
  } catch {
    if (!response.ok) throw new Error(`Request failed (${response.status}).`);
    throw new Error(`The local API returned an invalid response (${response.status}).`);
  }
  if (!response.ok) {
    const detail = typeof payload.detail === "string" ? payload.detail : `Request failed (${response.status}).`;
    throw new Error(detail);
  }
  return payload;
}

function outputText(result) {
  if (!result) return "No output returned.";
  if (result.error) return result.error;
  return result.output || "Command completed successfully with no output.";
}

function setPill(element, label, state) {
  element.textContent = label;
  element.className = `status-pill ${state}`;
}

function updateDaemonStatus(output) {
  const daemonText = outputText(output);
  statusElements.daemon.textContent = daemonText.split("\n")[0];
  const healthy = !output?.error && /\b(running|active|started)\b/i.test(daemonText);
  const missing = output?.error || /\b(stopped|inactive|not running)\b/i.test(daemonText);
  const tone = healthy ? "good" : missing ? "warn" : "neutral";
  setPill(statusElements.daemonPill, healthy ? "Running" : missing ? "Needs attention" : "See output", tone);
  setPill(statusElements.protectionDaemonPill, healthy ? "Running" : missing ? "Needs attention" : "See output", tone);
}

function renderComponents(components = {}) {
  const grid = document.querySelector("#component-grid");
  grid.replaceChildren();
  for (const [key, [label, icon]] of Object.entries(componentLabels)) {
    const component = components[key] || { installed: false, executable: "Unknown" };
    const card = document.createElement("article");
    card.className = "component-card";
    const top = document.createElement("div");
    top.className = "component-top";
    const symbol = document.createElement("span");
    symbol.className = "component-icon";
    symbol.textContent = icon;
    const description = document.createElement("div");
    const name = document.createElement("div");
    name.className = "component-name";
    name.textContent = label;
    const executable = document.createElement("div");
    executable.className = "component-executable";
    executable.textContent = component.executable;
    description.append(name, executable);
    top.append(symbol, description);
    const state = document.createElement("div");
    state.className = `component-state ${component.installed ? "installed" : "missing"}`;
    const dot = document.createElement("span");
    dot.className = "state-dot";
    state.append(dot, document.createTextNode(component.installed ? "Installed" : "Not detected"));
    card.append(top, state);
    grid.append(card);
  }
}

async function loadOverview() {
  const [status, history] = await Promise.allSettled([
    apiRequest("/api/status"),
    apiRequest("/api/history"),
  ]);

  if (status.status === "fulfilled") {
    const data = status.value;
    renderComponents(data.components);
    document.querySelector("#engine-version").textContent = outputText(data.version).split("\n")[0];
    document.querySelector("#check-output").textContent = outputText(data.system_check);
    document.querySelector("#database-status").textContent = data.system_check?.error ? "Check unavailable" : "Review system check";
    updateDaemonStatus(data.daemon);
    const cliInstalled = Boolean(data.components?.clamweb?.installed);
    const allComponentsInstalled = Object.values(data.components || {}).every((item) => item.installed);
    const banner = document.querySelector("#health-banner");
    const isHealthy = cliInstalled
      && allComponentsInstalled
      && !data.version?.error
      && !data.system_check?.error
      && !data.daemon?.error;
    const isWarning = cliInstalled;
    banner.className = `health-banner ${isHealthy ? "healthy" : isWarning ? "warning" : "unhealthy"}`;
    document.querySelector("#health-title").textContent = isHealthy ? "All detected components are available" : isWarning ? "Some components need attention" : "ClamAV CLI is unavailable";
    document.querySelector("#health-copy").textContent = isHealthy
      ? "The CLI, ClamAV components, and system check responded successfully."
      : "Review component availability and the system check output below.";
  } else {
    document.querySelector("#health-title").textContent = "Could not read system status";
    document.querySelector("#health-copy").textContent = status.reason.message;
    document.querySelector("#check-output").textContent = status.reason.message;
    showToast(status.reason.message, true);
  }

  if (history.status === "fulfilled") {
    document.querySelector("#overview-history").textContent = outputText(history.value);
  } else {
    document.querySelector("#overview-history").textContent = history.reason.message;
  }
  document.querySelector("#last-checked").textContent = `Checked ${new Date().toLocaleTimeString()}`;
}

async function loadHistory() {
  const result = await apiRequest("/api/history");
  document.querySelector("#history-output").textContent = outputText(result);
}

function navigateTo(view) {
  const selected = views.includes(view) ? view : "overview";
  for (const name of views) {
    document.querySelector(`#${name}-view`).classList.toggle("hidden", name !== selected);
  }
  for (const link of document.querySelectorAll(".nav-link")) {
    const active = link.dataset.view === selected;
    link.classList.toggle("active", active);
    if (active) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  }
  if (selected === "history") loadHistory().catch((error) => showToast(error.message, true));
}

document.querySelectorAll("[data-navigate]").forEach((button) => {
  button.addEventListener("click", () => {
    window.location.hash = button.dataset.navigate;
  });
});
window.addEventListener("hashchange", () => navigateTo(window.location.hash.slice(1)));

document.querySelector("#refresh-button").addEventListener("click", () => {
  loadOverview().catch((error) => showToast(error.message, true));
});
document.querySelector("#history-refresh").addEventListener("click", () => {
  loadHistory().catch((error) => showToast(error.message, true));
});

document.querySelector("#update-database").addEventListener("click", async (event) => {
  const button = event.currentTarget;
  const resultElement = document.querySelector("#update-result");
  button.disabled = true;
  resultElement.textContent = "Updating virus definitions…";
  let updateSucceeded = false;
  try {
    const result = await apiRequest("/api/update", { method: "POST" });
    resultElement.textContent = outputText(result);
    showToast("Virus database update completed.");
    updateSucceeded = true;
  } catch (error) {
    resultElement.textContent = error.message;
    showToast(error.message, true);
  } finally {
    button.disabled = false;
  }
  if (updateSucceeded) {
    try {
      const check = await apiRequest("/api/check");
      document.querySelector("#check-output").textContent = outputText(check);
    } catch (error) {
      document.querySelector("#check-output").textContent = `System check failed: ${error.message}`;
    }
  }
});

document.querySelector("#scan-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = document.querySelector("#scan-submit");
  const result = document.querySelector("#scan-result");
  const output = result.querySelector("pre");
  button.disabled = true;
  button.textContent = "Scanning…";
  result.classList.remove("hidden");
  output.textContent = "The scan is running. This may take a while…";
  try {
    const profile = document.querySelector("#scan-profile").value;
    const scanRequest = { profile };
    if (profile === "custom") {
      scanRequest.path = document.querySelector("#scan-path").value;
    }
    const scanResult = await apiRequest("/api/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(scanRequest),
    });
    output.textContent = outputText(scanResult);
    showToast("Scan completed.");
  } catch (error) {
    output.textContent = error.message;
    showToast(error.message, true);
  } finally {
    button.disabled = false;
    button.innerHTML = 'Start scan <span aria-hidden="true">→</span>';
  }
});

document.querySelector("#scan-profile").addEventListener("change", (event) => {
  const custom = event.target.value === "custom";
  const pathInput = document.querySelector("#scan-path");
  pathInput.disabled = !custom;
  pathInput.required = custom;
  document.querySelector("#scan-path-label").classList.toggle("hidden", !custom);
  pathInput.classList.toggle("hidden", !custom);
  document.querySelector("#scan-path-hint").textContent = custom
    ? "Enter a path accessible to the account running this local service."
    : "This profile uses a platform-specific default path on the system running the backend.";
});
document.querySelector("#scan-profile").dispatchEvent(new Event("change"));

document.querySelector("#clear-history").addEventListener("click", async () => {
  if (!window.confirm("Clear the scan history reported by clamweb?")) return;
  try {
    const result = await apiRequest("/api/history", { method: "DELETE" });
    document.querySelector("#history-output").textContent = outputText(result);
    document.querySelector("#overview-history").textContent = "Scan history cleared.";
    showToast("Scan history cleared.");
  } catch (error) {
    showToast(error.message, true);
  }
});

document.querySelectorAll("[data-daemon]").forEach((button) => {
  button.addEventListener("click", async () => {
    const action = button.dataset.daemon;
    button.disabled = true;
    try {
      const result = await apiRequest(`/api/daemon/${action}`, { method: "POST" });
      document.querySelector("#daemon-result").textContent = outputText(result);
      showToast(`Daemon ${action} command completed.`);
      const status = await apiRequest("/api/daemon");
      updateDaemonStatus(status);
      document.querySelector("#daemon-result").textContent = `${outputText(result)}\n\nStatus:\n${outputText(status)}`;
    } catch (error) {
      document.querySelector("#daemon-result").textContent = error.message;
      showToast(error.message, true);
    } finally {
      button.disabled = false;
    }
  });
});

document.querySelectorAll("[data-realtime]").forEach((button) => {
  button.addEventListener("click", async () => {
    const state = button.dataset.realtime;
    button.disabled = true;
    try {
      const result = await apiRequest(`/api/real-time/${state}`, { method: "POST" });
      document.querySelector("#realtime-result").textContent = outputText(result);
      setPill(document.querySelector("#realtime-pill"), state === "on" ? "Enabled" : "Disabled", state === "on" ? "good" : "warn");
      showToast(`Real-time protection ${state === "on" ? "enabled" : "disabled"}.`);
    } catch (error) {
      document.querySelector("#realtime-result").textContent = error.message;
      showToast(error.message, true);
    } finally {
      button.disabled = false;
    }
  });
});

document.querySelectorAll("[data-preference]").forEach((button) => {
  button.addEventListener("click", async () => {
    const action = button.dataset.preference;
    if (action === "clear" && !window.confirm("Clear clamweb preferences?")) return;
    button.disabled = true;
    try {
      const result = await apiRequest("/api/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      document.querySelector("#preferences-result").textContent = outputText(result);
      showToast(`Preferences ${action} command completed.`);
    } catch (error) {
      document.querySelector("#preferences-result").textContent = error.message;
      showToast(error.message, true);
    } finally {
      button.disabled = false;
    }
  });
});

const licenseDialog = document.querySelector("#license-dialog");
document.querySelector("#license-open").addEventListener("click", () => licenseDialog.showModal());
document.querySelector("#license-close").addEventListener("click", () => licenseDialog.close());
licenseDialog.addEventListener("click", (event) => {
  if (event.target === licenseDialog) licenseDialog.close();
});

navigateTo(window.location.hash.slice(1) || "overview");
loadOverview().catch((error) => showToast(error.message, true));
