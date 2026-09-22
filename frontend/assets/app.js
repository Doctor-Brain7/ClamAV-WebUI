const notice = document.querySelector("#notice");

function showNotice(message) {
  notice.textContent = message;
  notice.hidden = false;
}

function renderResult(element, result) {
  element.textContent = JSON.stringify(result, null, 2);
  element.hidden = false;
}

async function request(url, options = {}) {
  const response = await fetch(url, { headers: { "Content-Type": "application/json" }, ...options });
  const payload = await response.json().catch(() => ({ detail: "The server returned an invalid response." }));
  if (!response.ok) throw new Error(payload.detail || "The request failed.");
  return payload;
}

async function refreshStatus() {
  try {
    const [version, daemon] = await Promise.all([request("/api/status"), request("/api/daemon/status", { method: "POST" })]);
    document.querySelector("#engineVersion").textContent = version.data?.version || version.data?.output || "Available";
    document.querySelector("#daemonState").textContent = daemon.data?.status || daemon.data?.output || "Available";
    document.querySelector("#protectionState").textContent = "Ready";
    notice.hidden = true;
  } catch (error) {
    document.querySelector("#engineVersion").textContent = "Unavailable";
    document.querySelector("#daemonState").textContent = "Unavailable";
    document.querySelector("#protectionState").textContent = "Unavailable";
    showNotice(error.message);
  }
}

document.querySelector("#refreshButton").addEventListener("click", refreshStatus);
document.querySelector("#scanForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const result = await request("/api/scan", { method: "POST", body: JSON.stringify({ target: document.querySelector("#scanTarget").value }) });
    renderResult(document.querySelector("#scanResult"), result);
  } catch (error) { showNotice(error.message); }
});
document.querySelectorAll("[data-realtime]").forEach((button) => button.addEventListener("click", async () => {
  try { const result = await request(`/api/real-time/${button.dataset.realtime}`, { method: "POST" }); renderResult(document.querySelector("#toolResult"), result); } catch (error) { showNotice(error.message); }
}));
document.querySelectorAll("[data-daemon]").forEach((button) => button.addEventListener("click", async () => {
  try { const result = await request(`/api/daemon/${button.dataset.daemon}`, { method: "POST" }); renderResult(document.querySelector("#toolResult"), result); } catch (error) { showNotice(error.message); }
}));
document.querySelectorAll("[data-action]").forEach((button) => button.addEventListener("click", async () => {
  try {
    const method = button.dataset.action === "update" ? "POST" : "GET";
    const result = await request(`/api/${button.dataset.action}`, { method });
    renderResult(document.querySelector("#toolResult"), result);
  } catch (error) { showNotice(error.message); }
}));
refreshStatus();
