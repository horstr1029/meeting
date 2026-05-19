// Injected into Google Meet and Microsoft Teams pages

(function () {
  if (document.getElementById("dab-record-btn")) return; // already injected

  let recording = false;
  let statusTimeout = null;

  const btn = document.createElement("button");
  btn.id = "dab-record-btn";
  btn.setAttribute("aria-label", "DAB Meetings: Start Recording");
  btn.innerHTML = recIcon() + "<span id='dab-btn-label'>Record</span>";
  document.body.appendChild(btn);

  const statusBadge = document.createElement("div");
  statusBadge.id = "dab-status-badge";
  statusBadge.style.display = "none";
  document.body.appendChild(statusBadge);

  btn.addEventListener("click", async () => {
    if (!recording) {
      const title = getMeetingTitle();
      const res = await chrome.runtime.sendMessage({
        type: "START_RECORDING",
        title,
        language: "en",
      });
      if (res?.error) {
        showStatus(res.error, "error");
        return;
      }
      recording = true;
      btn.classList.add("dab-recording");
      btn.querySelector("#dab-btn-label").textContent = "Stop";
      btn.setAttribute("aria-label", "DAB Meetings: Stop Recording");
      btn.innerHTML = stopIcon() + "<span id='dab-btn-label'>Stop</span>";
      showStatus("Recording…", "recording");
    } else {
      await chrome.runtime.sendMessage({ type: "STOP_RECORDING" });
      recording = false;
      btn.classList.remove("dab-recording");
      btn.innerHTML = recIcon() + "<span id='dab-btn-label'>Record</span>";
      btn.setAttribute("aria-label", "DAB Meetings: Start Recording");
      showStatus("Processing…", "info");
    }
  });

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === "RECORDING_STATUS") {
      const labels = { uploading: "Uploading audio…", transcribing: "Transcribing…", processing: "Processing…" };
      showStatus(labels[msg.status] ?? msg.status, "info");
    }
    if (msg.type === "RECORDING_DONE") {
      showStatus("Done! Opening meeting…", "success", 4000);
    }
    if (msg.type === "RECORDING_ERROR") {
      showStatus(`Error: ${msg.error}`, "error", 8000);
      recording = false;
      btn.classList.remove("dab-recording");
      btn.innerHTML = recIcon() + "<span id='dab-btn-label'>Record</span>";
    }
  });

  function showStatus(text, type, duration = 0) {
    statusBadge.textContent = text;
    statusBadge.className = `dab-status-${type}`;
    statusBadge.style.display = "block";
    if (statusTimeout) clearTimeout(statusTimeout);
    if (duration > 0) {
      statusTimeout = setTimeout(() => { statusBadge.style.display = "none"; }, duration);
    }
  }

  function getMeetingTitle() {
    // Try page title first, stripping ` - Google Meet` suffix etc.
    const raw = document.title || "";
    const cleaned = raw.replace(/\s*[-–|]\s*(Google Meet|Microsoft Teams|Teams).*$/i, "").trim();
    if (cleaned && cleaned.length > 2) return cleaned;
    // Fallback: timestamp
    return `Meeting ${new Date().toLocaleString()}`;
  }

  function recIcon() {
    return `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" style="margin-right:6px;flex-shrink:0"><circle cx="7" cy="7" r="6" fill="currentColor" opacity="0.3"/><circle cx="7" cy="7" r="3.5" fill="currentColor"/></svg>`;
  }

  function stopIcon() {
    return `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" style="margin-right:6px;flex-shrink:0"><rect x="3" y="3" width="8" height="8" rx="1.5" fill="currentColor"/></svg>`;
  }
})();
