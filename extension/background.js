// Service worker — coordinates tab capture and offscreen recording

let recordingTabId = null;

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === "START_RECORDING") {
    const tabId = sender.tab?.id;
    if (!tabId) { sendResponse({ error: "No tab" }); return; }
    startRecording(tabId, msg).then(sendResponse);
    return true; // keep channel open for async response
  }

  if (msg.type === "STOP_RECORDING") {
    stopRecording().then(sendResponse);
    return true;
  }

  if (msg.type === "GET_STATUS") {
    chrome.storage.session.get(["dabRecording"], (r) => sendResponse(r.dabRecording ?? null));
    return true;
  }

  // Messages from offscreen doc — relay back to content script in the recorded tab
  if (msg.type === "RECORDING_STATUS" || msg.type === "RECORDING_DONE" || msg.type === "RECORDING_ERROR") {
    if (recordingTabId) {
      chrome.tabs.sendMessage(recordingTabId, msg).catch(() => {});
    }
    if (msg.type === "RECORDING_DONE" || msg.type === "RECORDING_ERROR") {
      chrome.storage.session.remove("dabRecording");
      recordingTabId = null;
      if (msg.type === "RECORDING_DONE" && msg.meetingUrl) {
        chrome.tabs.create({ url: msg.meetingUrl });
      }
    }
  }
});

async function startRecording(tabId, msg) {
  const { serverUrl, apiKey } = await chrome.storage.local.get(["serverUrl", "apiKey"]);
  if (!serverUrl || !apiKey) {
    return { error: "Server URL and API key not configured. Open the extension popup to configure." };
  }

  let streamId;
  try {
    streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tabId });
  } catch (e) {
    return { error: `Tab capture failed: ${e.message}` };
  }

  await ensureOffscreen();

  recordingTabId = tabId;
  chrome.storage.session.set({
    dabRecording: { tabId, title: msg.title, startedAt: Date.now() },
  });

  // Pass config to offscreen doc
  chrome.runtime.sendMessage({
    target: "offscreen",
    type: "OFFSCREEN_START",
    streamId,
    serverUrl,
    apiKey,
    title: msg.title,
    language: msg.language ?? "en",
  });

  return { ok: true };
}

async function stopRecording() {
  chrome.runtime.sendMessage({ target: "offscreen", type: "OFFSCREEN_STOP" });
  return { ok: true };
}

async function ensureOffscreen() {
  const existing = await chrome.offscreen.hasDocument();
  if (!existing) {
    await chrome.offscreen.createDocument({
      url: chrome.runtime.getURL("offscreen.html"),
      reasons: ["USER_MEDIA"],
      justification: "Capture tab audio for meeting transcription",
    });
  }
}
