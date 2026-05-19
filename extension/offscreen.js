// Offscreen document — handles MediaRecorder and API submission

let mediaRecorder = null;
let chunks = [];
let meta = null;
let audioContext = null;

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.target !== "offscreen") return;
  if (msg.type === "OFFSCREEN_START") startRecording(msg);
  if (msg.type === "OFFSCREEN_STOP") stopRecording();
});

async function startRecording({ streamId, serverUrl, apiKey, title, language }) {
  meta = { serverUrl, apiKey, title, language };
  chunks = [];

  // Get tab audio stream using the stream ID from tabCapture
  const tabStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      mandatory: {
        chromeMediaSource: "tab",
        chromeMediaSourceId: streamId,
      },
    },
    video: false,
  });

  // Try to mix in microphone
  let finalStream = tabStream;
  try {
    const micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    audioContext = new AudioContext();
    const dest = audioContext.createMediaStreamDestination();
    audioContext.createMediaStreamSource(tabStream).connect(dest);
    audioContext.createMediaStreamSource(micStream).connect(dest);
    finalStream = dest.stream;
  } catch {
    // Mic unavailable — tab audio only
  }

  const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
    ? "audio/webm;codecs=opus"
    : "audio/webm";

  mediaRecorder = new MediaRecorder(finalStream, { mimeType });
  mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
  mediaRecorder.onstop = submitRecording;
  mediaRecorder.start(5000);
}

function stopRecording() {
  if (mediaRecorder?.state !== "inactive") {
    mediaRecorder.stop();
  }
}

async function submitRecording() {
  if (audioContext) { audioContext.close(); audioContext = null; }

  const { serverUrl, apiKey, title, language } = meta;
  const blob = new Blob(chunks, { type: "audio/webm" });
  const authHeaders = { "Authorization": `Bearer ${apiKey}` };

  notify("RECORDING_STATUS", { status: "uploading" });

  try {
    // 1. Create meeting record
    const createRes = await fetch(`${serverUrl}/api/meetings`, {
      method: "POST",
      headers: { ...authHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ title, language }),
    });
    if (!createRes.ok) throw new Error(`Create meeting failed: ${createRes.status}`);
    const meeting = await createRes.json();

    notify("RECORDING_STATUS", { status: "transcribing", meetingId: meeting.id });

    // 2. Send audio for transcription
    const params = language ? `?lang=${encodeURIComponent(language)}` : "";
    const transcribeRes = await fetch(`${serverUrl}/api/transcribe${params}`, {
      method: "POST",
      headers: { ...authHeaders, "content-type": blob.type },
      body: blob,
    });
    if (!transcribeRes.ok) {
      const err = await transcribeRes.json().catch(() => ({}));
      throw new Error(err.error ?? `Transcription failed: ${transcribeRes.status}`);
    }
    const transcribeData = await transcribeRes.json();

    let transcript = "";
    if (transcribeData.assemblyJobId) {
      notify("RECORDING_STATUS", { status: "processing", meetingId: meeting.id });
      transcript = await pollAssemblyJob(serverUrl, authHeaders, transcribeData.assemblyJobId);
    } else {
      transcript = transcribeData.text ?? "";
    }

    // 3. Save transcript
    await fetch(`${serverUrl}/api/meetings/${meeting.id}`, {
      method: "PUT",
      headers: { ...authHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ transcript }),
    });

    notify("RECORDING_DONE", {
      meetingId: meeting.id,
      meetingUrl: `${serverUrl}/meetings/${meeting.id}`,
    });
  } catch (err) {
    notify("RECORDING_ERROR", { error: err.message });
  }
}

async function pollAssemblyJob(serverUrl, headers, jobId) {
  for (let i = 0; i < 120; i++) {
    await delay(5000);
    const res = await fetch(`${serverUrl}/api/transcribe/assemblyai-status`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ jobId }),
    });
    const data = await res.json();
    if (data.status === "completed") return data.text ?? "";
    if (data.status === "error") throw new Error(data.error ?? "Transcription failed");
  }
  throw new Error("Transcription timed out after 10 minutes");
}

function notify(type, payload) {
  chrome.runtime.sendMessage({ type, ...payload });
}

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
