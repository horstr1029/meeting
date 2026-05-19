const serverUrlInput = document.getElementById("serverUrl");
const apiKeyInput = document.getElementById("apiKey");
const saveBtn = document.getElementById("saveBtn");
const statusEl = document.getElementById("status");
const toggleKeyBtn = document.getElementById("toggleKey");
const recIndicator = document.getElementById("recording-indicator");
const recLabel = document.getElementById("rec-label");

// Load saved settings
chrome.storage.local.get(["serverUrl", "apiKey"], ({ serverUrl, apiKey }) => {
  if (serverUrl) serverUrlInput.value = serverUrl;
  if (apiKey) apiKeyInput.value = apiKey;
});

// Check if currently recording
chrome.runtime.sendMessage({ type: "GET_STATUS" }, (rec) => {
  if (rec) {
    recIndicator.classList.add("show");
    const elapsed = Math.round((Date.now() - rec.startedAt) / 1000);
    recLabel.textContent = `Recording "${rec.title}" (${formatDuration(elapsed)})`;
  }
});

toggleKeyBtn.addEventListener("click", () => {
  const isPassword = apiKeyInput.type === "password";
  apiKeyInput.type = isPassword ? "text" : "password";
  toggleKeyBtn.textContent = isPassword ? "Hide" : "Show";
});

saveBtn.addEventListener("click", async () => {
  const serverUrl = serverUrlInput.value.trim().replace(/\/$/, "");
  const apiKey = apiKeyInput.value.trim();

  if (!serverUrl) { showStatus("Server URL is required", "error"); return; }
  if (!serverUrl.startsWith("http")) { showStatus("Server URL must start with http:// or https://", "error"); return; }
  if (!apiKey) { showStatus("API key is required", "error"); return; }

  saveBtn.disabled = true;
  saveBtn.textContent = "Verifying…";

  // Test the key against the server
  try {
    const res = await fetch(`${serverUrl}/api/meetings`, {
      headers: { "Authorization": `Bearer ${apiKey}` },
    });
    if (res.status === 401) {
      showStatus("Invalid API key — check settings in the DAB Meetings app", "error");
      return;
    }
    if (!res.ok && res.status !== 200) {
      showStatus(`Server returned ${res.status} — check the URL`, "error");
      return;
    }
  } catch {
    showStatus("Could not reach server — check the URL", "error");
    return;
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = "Save Settings";
  }

  chrome.storage.local.set({ serverUrl, apiKey }, () => {
    showStatus("Settings saved and verified!", "success");
  });
});

function showStatus(msg, type) {
  statusEl.textContent = msg;
  statusEl.className = `status show ${type}`;
  setTimeout(() => { statusEl.className = "status"; }, 4000);
}

function formatDuration(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
