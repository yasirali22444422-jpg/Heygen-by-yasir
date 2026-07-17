// Background service worker. All heavy/async HeyGen API work happens here
// so it survives the popup closing (common on mobile browsers when a file
// picker opens or the popup loses focus).

const storage = {
  get: (keys) => chrome.storage.local.get(keys),
  set: (obj) => chrome.storage.local.set(obj),
};

function base64ToBlob(base64Data, mimeType) {
  const byteChars = atob(base64Data.split(",")[1] || base64Data);
  const byteNumbers = new Array(byteChars.length);
  for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i);
  return new Blob([new Uint8Array(byteNumbers)], { type: mimeType });
}

// Registers the uploaded photo as a proper HeyGen "look" via POST /v3/avatars.
// This is a SEPARATE id-space from image_key (Avatar IV) / talking_photo_id (Avatar III) —
// it's the only kind of avatar_id that the Video Agent (/v3/video-agents) and
// /v3/videos accept for pinning a specific avatar. Best-effort: if this fails,
// the normal photo-avatar upload above still works fine, the person just won't
// be able to pin their own avatar for Agent videos.
async function registerAvatarLook({ apiKey, base64, mimeType, name }) {
  const rawData = base64.split(",")[1] || base64;
  const res = await fetch("https://api.heygen.com/v3/avatars", {
    method: "POST",
    headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "photo",
      name: name || "My Avatar",
      file: { type: "base64", media_type: mimeType, data: rawData },
    }),
  });
  const json = await res.json();
  if (!res.ok || json.error) {
    throw new Error(json.error?.message || `Avatar look register nahi hua (HTTP ${res.status})`);
  }
  const lookId = json.data?.avatar_item?.id;
  const previewUrl = json.data?.avatar_item?.preview_image_url;
  if (!lookId) throw new Error("avatar_item.id response me nahi mila");
  return { lookId, previewUrl };
}

async function uploadAvatar({ apiKey, base64, mimeType, fileName, engine }) {
  const blob = base64ToBlob(base64, mimeType);

  // Best-effort: register a pinnable "look" for Agent videos in parallel with
  // whichever generate-flow upload runs below. Failure here must not block
  // the main upload — it only means the "use my avatar" Agent checkbox won't
  // have anything to pin yet.
  storage.set({ customAvatarLookState: { state: "loading", message: "Avatar ko Agent ke liye bhi register kiya ja raha hai..." } });
  registerAvatarLook({ apiKey, base64, mimeType, name: fileName || "My Avatar" })
    .then(({ lookId, previewUrl }) =>
      storage.set({
        customAvatarLookId: lookId,
        customAvatarLookPreview: previewUrl,
        customAvatarLookState: { state: "success", message: "Ab Agent video me bhi ye avatar pin ho sakta hai" },
      })
    )
    .catch((err) =>
      storage.set({
        customAvatarLookId: null,
        customAvatarLookState: { state: "error", message: "Agent ke liye register nahi ho paya: " + err.message },
      })
    );

  if (engine === "avatar_iii") {
    // Avatar III (legacy/unlimited engine) needs a talking_photo_id from this
    // dedicated upload endpoint — different ID space from v3/assets.
    const res = await fetch("https://upload.heygen.com/v1/talking_photo", {
      method: "POST",
      headers: { "x-api-key": apiKey, "Content-Type": mimeType },
      body: blob,
    });
    const json = await res.json();
    if (!res.ok || json.error) {
      throw new Error(json.error?.message || `Upload fail hua (HTTP ${res.status})`);
    }
    const talkingPhotoId = json.data.talking_photo_id;
    const previewUrl = json.data.talking_photo_url;
    if (!talkingPhotoId) throw new Error("talking_photo_id response me nahi mila");

    await storage.set({
      talkingPhotoId,
      avatarPreviewUrl: previewUrl,
      avatarMode: "photo",
      avatarEngine: "avatar_iii",
      avatarUploadState: { state: "success", message: "Avatar (Avatar III) save ho gaya" },
    });
    return { talkingPhotoId, previewUrl };
  }

  // Avatar IV — existing flow via v3/assets -> image_key, used with av4/generate.
  const form = new FormData();
  form.append("file", blob, fileName || "avatar.jpg");

  const res = await fetch("https://api.heygen.com/v3/assets", {
    method: "POST",
    headers: { "x-api-key": apiKey },
    body: form,
  });
  const json = await res.json();
  if (!res.ok || json.error) {
    throw new Error(json.error?.message || `Upload fail hua (HTTP ${res.status})`);
  }

  const uploadUrl = json.data.url;
  const imageKey = new URL(uploadUrl).pathname.replace(/^\//, "");

  await storage.set({
    imageKey,
    avatarAssetId: json.data.asset_id,
    avatarPreviewUrl: uploadUrl,
    avatarMode: "photo",
    avatarEngine: "avatar_iv",
    avatarUploadState: { state: "success", message: "Avatar (Avatar IV) save ho gaya" },
  });
  return { imageKey, uploadUrl };
}

async function cloneVoice({ apiKey, base64, mimeType, fileName, name }) {
  const blob = base64ToBlob(base64, mimeType);
  const form = new FormData();
  form.append("file", blob, fileName || "voice.mp3");
  form.append("name", name || "My Cloned Voice");

  const res = await fetch("https://api.heygen.com/v3/voices/clone", {
    method: "POST",
    headers: { "x-api-key": apiKey },
    body: form,
  });
  const json = await res.json();
  if (!res.ok || json.error) {
    throw new Error(json.error?.message || `Clone fail hua (HTTP ${res.status})`);
  }
  const voiceId = json.data.voice_id || json.data.id;
  if (!voiceId) throw new Error("voice_id response me nahi mila");

  await storage.set({
    voiceId,
    voiceCloneState: { state: "success", message: "Voice clone ho gayi (" + voiceId + ")" },
  });
  return { voiceId };
}

// Fetch ALL videos from HeyGen (all pages) — agent + non-agent
async function fetchAllHeygenVideos({ apiKey }) {
  const videos = [];
  let pageToken = "";
  let safetyLimit = 10; // max 10 pages (1000 videos)

  while (safetyLimit-- > 0) {
    const url = pageToken
      ? `https://api.heygen.com/v1/video.list?limit=100&page_token=${encodeURIComponent(pageToken)}`
      : `https://api.heygen.com/v1/video.list?limit=100`;

    const res = await fetch(url, { headers: { "x-api-key": apiKey } });
    const json = await res.json();

    if (!res.ok || json.error) {
      throw new Error(json.error?.message || `Videos load nahi hui (HTTP ${res.status})`);
    }

    const batch = json.data?.videos || [];
    videos.push(...batch);

    pageToken = json.data?.token || "";
    if (!pageToken || batch.length === 0) break;
  }

  // Normalize each video into history-entry shape
  const normalized = videos.map((v) => ({
    id: v.video_id,
    title: v.title || "Untitled",
    createdAt: v.created_at ? v.created_at * 1000 : Date.now(),
    status: v.status === "completed" ? "success" : v.status === "failed" ? "error" : "loading",
    message: v.status === "failed" ? "Video render fail hui (HeyGen)" : "",
    videoUrl: v.video_url || null,
    thumbnailUrl: v.thumbnail_url || null,
    source: "heygen", // mark as fetched from HeyGen (not local-only)
  }));

  return { videos: normalized };
}

async function listAvatars({ apiKey }) {
  const res = await fetch("https://api.heygen.com/v2/avatars", {
    headers: { "x-api-key": apiKey },
  });
  const json = await res.json();
  if (!res.ok || json.error) {
    throw new Error(json.error?.message || `Avatars load nahi hue (HTTP ${res.status})`);
  }
  const avatars = json.data?.avatars || [];
  return { avatars };
}

async function listVoices({ apiKey }) {
  const res = await fetch("https://api.heygen.com/v3/voices", {
    headers: { "x-api-key": apiKey },
  });
  const json = await res.json();
  if (!res.ok || json.error) {
    throw new Error(json.error?.message || `Voices load nahi hui (HTTP ${res.status})`);
  }
  // API response shape has varied across versions — handle both.
  const voices = Array.isArray(json.data) ? json.data : json.data?.voices || [];
  return { voices };
}

async function startGenerate({
  apiKey,
  mode,
  imageKey,
  talkingPhotoId,
  avatarEngine,
  avatarId,
  voiceId,
  title,
  script,
  scriptChunks,
  isTest,
  kind, // "preview" (Render Scene, free) or "final" (real generate, uses credits)
}) {
  const isPreview = kind === "preview";
  const stateKey = isPreview ? "renderState" : "generateState";
  const pendingKey = isPreview ? "pendingRenderVideoId" : "pendingVideoId";

  await storage.set({
    [stateKey]: {
      state: "loading",
      message: isPreview ? "Preview render ho raha hai (free, watermark ke sath)..." : "Final video generate ho raha hai...",
    },
  });

  // HeyGen's Avatar Input (input_text) is capped at 5,000 characters per docs
  // (developers.heygen.com/docs/usage-limits). /v2/video/generate accepts a
  // video_inputs ARRAY though, so for prebuilt/Avatar III we split a long
  // script into multiple same-avatar scenes instead of sending one oversized
  // input_text and getting a render failure back from HeyGen.
  const chunks =
    Array.isArray(scriptChunks) && scriptChunks.length > 1 ? scriptChunks : [script];

  let url, body;
  if (mode === "prebuilt") {
    url = "https://api.heygen.com/v2/video/generate";
    body = {
      video_inputs: chunks.map((chunk) => ({
        character: { type: "avatar", avatar_id: avatarId, avatar_style: "normal" },
        voice: { type: "text", input_text: chunk, voice_id: voiceId },
      })),
      dimension: { width: 1280, height: 720 },
      title,
      test: !!isTest,
    };
  } else if (avatarEngine === "avatar_iii") {
    // Legacy/unlimited talking-photo engine — supports "test" preview mode.
    url = "https://api.heygen.com/v2/video/generate";
    body = {
      video_inputs: chunks.map((chunk) => ({
        character: { type: "talking_photo", talking_photo_id: talkingPhotoId, talking_photo_style: "square" },
        voice: { type: "text", input_text: chunk, voice_id: voiceId },
      })),
      dimension: { width: 1280, height: 720 },
      title,
      test: !!isTest,
    };
  } else {
    // Avatar IV photo engine — this endpoint only takes ONE script field, no
    // multi-scene support, so this path assumes the caller already validated
    // script.length <= 5000 before calling.
    url = "https://api.heygen.com/v2/video/av4/generate";
    body = {
      image_key: imageKey,
      video_title: title,
      script,
      voice_id: voiceId,
      test: !!isTest,
    };
  }

  const res = await fetch(url, {
    method: "POST",
    headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok || json.error) {
    const msg = json.error?.message || `Request fail hui (HTTP ${res.status})`;
    await storage.set({ [stateKey]: { state: "error", message: msg } });
    throw new Error(msg);
  }

  const videoId = json.data.video_id;
  if (!videoId) {
    const msg = "video_id response me nahi mila";
    await storage.set({ [stateKey]: { state: "error", message: msg } });
    throw new Error(msg);
  }

  await storage.set({
    [stateKey]: { state: "loading", message: "Processing... (status check shuru)" },
    [pendingKey]: videoId,
    [isPreview ? "renderPollAttempts" : "pollAttempts"]: 0,
  });

  // quick first check after 8s (best-effort; alarm below is the reliable backstop)
  setTimeout(() => checkVideoStatus(apiKey, videoId, kind).catch(() => {}), 8000);
  // reliable backstop: fires even if the service worker was suspended
  chrome.alarms.create(isPreview ? "pollRenderVideo" : "pollVideo", { periodInMinutes: 1 });

  return { videoId };
}

async function checkVideoStatus(apiKey, videoId, kind) {
  const isPreview = kind === "preview";
  const stateKey = isPreview ? "renderState" : "generateState";
  const pendingKey = isPreview ? "pendingRenderVideoId" : "pendingVideoId";
  const attemptsKey = isPreview ? "renderPollAttempts" : "pollAttempts";
  const alarmName = isPreview ? "pollRenderVideo" : "pollVideo";

  const res = await fetch(
    `https://api.heygen.com/v1/video_status.get?video_id=${encodeURIComponent(videoId)}`,
    { headers: { "x-api-key": apiKey } }
  );
  const json = await res.json();
  const status = json.data?.status;

  if (status === "completed") {
    await chrome.alarms.clear(alarmName);
    await storage.set({
      [stateKey]: {
        state: "success",
        message: isPreview ? "Preview ready hai — dekh lo!" : "Video ready hai",
        videoUrl: json.data.video_url,
      },
      [pendingKey]: null,
    });
    return true;
  }
  if (status === "failed") {
    await chrome.alarms.clear(alarmName);
    const msg = json.data?.error?.message || "Video generation fail hui";
    await storage.set({ [stateKey]: { state: "error", message: msg }, [pendingKey]: null });
    return true;
  }

  const data = await storage.get([attemptsKey]);
  const attempts = (data[attemptsKey] || 0) + 1;
  if (attempts > 30) {
    // ~30 min safety cap
    await chrome.alarms.clear(alarmName);
    await storage.set({
      [stateKey]: { state: "error", message: "Timeout — HeyGen dashboard me video check karo" },
      [pendingKey]: null,
    });
    return true;
  }
  await storage.set({
    [attemptsKey]: attempts,
    [stateKey]: { state: "loading", message: `Status: ${status || "processing"}...` },
  });
  return false;
}

// ---------- Agent video history (gallery of every video ever generated) ----------
const AGENT_HISTORY_LIMIT = 100;

async function addAgentHistoryEntry(entry) {
  const data = await storage.get(["agentHistory"]);
  const history = Array.isArray(data.agentHistory) ? data.agentHistory : [];
  history.unshift(entry);
  if (history.length > AGENT_HISTORY_LIMIT) history.length = AGENT_HISTORY_LIMIT;
  await storage.set({ agentHistory: history });
  return history;
}

async function updateAgentHistoryEntry(entryId, patch) {
  const data = await storage.get(["agentHistory"]);
  const history = Array.isArray(data.agentHistory) ? data.agentHistory : [];
  const idx = history.findIndex((h) => h.id === entryId);
  if (idx !== -1) {
    history[idx] = { ...history[idx], ...patch };
    await storage.set({ agentHistory: history });
  }
  return history;
}

async function startAgentVideo({ apiKey, prompt, orientation, voiceId, avatarId }) {
  const entryId = "agent_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);

  // Immediately add a "loading" entry so the popup shows it right away
  await addAgentHistoryEntry({
    id: entryId,
    title: prompt.slice(0, 80),
    createdAt: Date.now(),
    status: "loading",
    message: "HeyGen ko request bheja ja raha hai...",
    videoUrl: null,
  });

  await storage.set({
    agentState: {
      state: "loading",
      message: "Agent video bana raha hai...",
    },
  });

  const body = { prompt, orientation: orientation || "landscape" };
  if (voiceId) body.voice_id = voiceId;
  if (avatarId) body.avatar_id = avatarId;

  const res = await fetch("https://api.heygen.com/v3/video-agents", {
    method: "POST",
    headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok || json.error) {
    const msg = json.error?.message || `Agent request fail hui (HTTP ${res.status})`;
    await storage.set({ agentState: { state: "error", message: msg } });
    await updateAgentHistoryEntry(entryId, { status: "error", message: msg });
    throw new Error(msg);
  }

  const sessionId = json.data?.session_id;
  if (!sessionId) {
    const msg = "session_id response me nahi mila";
    await storage.set({ agentState: { state: "error", message: msg } });
    await updateAgentHistoryEntry(entryId, { status: "error", message: msg });
    throw new Error(msg);
  }

  // Add this session to the multi-session queue
  const stored = await storage.get(["pendingAgentSessions"]);
  const sessions = Array.isArray(stored.pendingAgentSessions) ? stored.pendingAgentSessions : [];
  sessions.push({ sessionId, entryId, videoId: null, attempts: 0 });

  await storage.set({
    agentState: { state: "loading", message: "Video render ho raha hai..." },
    pendingAgentSessions: sessions,
  });

  await updateAgentHistoryEntry(entryId, { status: "loading", message: "Video render ho raha hai..." });

  setTimeout(() => checkAllAgentSessions(apiKey).catch(() => {}), 8000);
  // Start alarm only if not already running
  chrome.alarms.get("pollAgentVideo", (existing) => {
    if (!existing) chrome.alarms.create("pollAgentVideo", { periodInMinutes: 1 });
  });

  return { sessionId };
}

// Check a single pending session; returns true if session is finished (success/fail/timeout)
// Mutates `session.videoId` and `session.attempts` in-place.
async function checkSingleSession(apiKey, session) {
  const { sessionId, entryId } = session;

  // Stage 1: session -> video_id
  if (!session.videoId) {
    const res = await fetch(`https://api.heygen.com/v3/video-agents/${encodeURIComponent(sessionId)}`, {
      headers: { "x-api-key": apiKey },
    });
    const json = await res.json();

    if (!res.ok || json.error) {
      const msg = json.error?.message || `Session check fail hui (HTTP ${res.status})`;
      if (entryId) await updateAgentHistoryEntry(entryId, { status: "error", message: msg });
      return true; // done (failed)
    }

    if (json.data?.status === "failed") {
      const msg =
        json.data?.failure_message ||
        json.data?.error?.message ||
        json.data?.message ||
        "HeyGen video generate nahi kar paya — dobara koshish karo";
      if (entryId) await updateAgentHistoryEntry(entryId, { status: "error", message: msg });
      return true; // done (failed)
    }

    const vid = json.data?.video_id;
    if (vid) {
      session.videoId = vid;
    } else {
      // still composing — check attempt cap
      session.attempts = (session.attempts || 0) + 1;
      if (session.attempts > 30) {
        const msg = "Timeout — HeyGen dashboard me check karo: app.heygen.com";
        if (entryId) await updateAgentHistoryEntry(entryId, { status: "error", message: msg });
        return true; // done (timeout)
      }
      const loadingMsg = "Agent script compose kar raha hai...";
      if (entryId) await updateAgentHistoryEntry(entryId, { status: "loading", message: loadingMsg });
      return false; // still pending
    }
  }

  // Stage 2: video_id -> render status
  const res2 = await fetch(`https://api.heygen.com/v3/videos/${encodeURIComponent(session.videoId)}`, {
    headers: { "x-api-key": apiKey },
  });
  const json2 = await res2.json();
  const status = json2.data?.status;

  if (status === "completed") {
    if (entryId)
      await updateAgentHistoryEntry(entryId, {
        status: "success",
        message: "Ready",
        videoUrl: json2.data.video_url,
      });
    // Update top-level agentState for the last completed video
    await storage.set({
      agentState: { state: "success", message: "Video ready hai! ✅", videoUrl: json2.data.video_url },
    });
    return true; // done
  }

  if (status === "failed") {
    const msg =
      json2.data?.failure_message ||
      json2.data?.error?.message ||
      "Video render fail hui — HeyGen ki dikkat hai, thodi der baad dobara karo";
    if (entryId) await updateAgentHistoryEntry(entryId, { status: "error", message: msg });
    return true; // done (failed)
  }

  // Still rendering
  session.attempts = (session.attempts || 0) + 1;
  if (session.attempts > 30) {
    const msg = "Timeout — HeyGen dashboard me check karo: app.heygen.com";
    if (entryId) await updateAgentHistoryEntry(entryId, { status: "error", message: msg });
    return true; // done (timeout)
  }
  const processingMsg = `Render ho raha hai... (${status || "processing"})`;
  if (entryId) await updateAgentHistoryEntry(entryId, { status: "loading", message: processingMsg });
  return false; // still pending
}

// Poll ALL pending sessions at once — allows multiple concurrent video tracking
async function checkAllAgentSessions(apiKey) {
  const stored = await storage.get(["pendingAgentSessions"]);
  const sessions = Array.isArray(stored.pendingAgentSessions) ? stored.pendingAgentSessions : [];
  if (sessions.length === 0) {
    await chrome.alarms.clear("pollAgentVideo");
    return;
  }

  const stillPending = [];
  for (const session of sessions) {
    try {
      const done = await checkSingleSession(apiKey, session);
      if (!done) stillPending.push(session); // keep mutated session (updated videoId/attempts)
    } catch (_err) {
      // network blip — keep session, try again next alarm
      stillPending.push(session);
    }
  }

  await storage.set({ pendingAgentSessions: stillPending });

  if (stillPending.length === 0) {
    await chrome.alarms.clear("pollAgentVideo");
  } else {
    // Update status indicator with live count
    await storage.set({
      agentState: {
        state: "loading",
        message: `${stillPending.length} video${stillPending.length > 1 ? "s" : ""} ban rahi hai...`,
      },
    });
  }
}

// ---------- Render Scene: direct script → avatar → video ----------
// Split long script into <=5000-char chunks at sentence boundaries
function splitScript(script, maxLen = 4900) {
  if (script.length <= maxLen) return [script];
  const chunks = [];
  let remaining = script;
  while (remaining.length > maxLen) {
    // Try to break at last sentence-ending punctuation before maxLen
    let cut = remaining.lastIndexOf(".", maxLen);
    if (cut < maxLen * 0.4) cut = remaining.lastIndexOf(" ", maxLen);
    if (cut < 1) cut = maxLen;
    chunks.push(remaining.slice(0, cut + 1).trim());
    remaining = remaining.slice(cut + 1).trim();
  }
  if (remaining.length > 0) chunks.push(remaining);
  return chunks;
}

async function startRenderScene({ apiKey, avatarId, avatarMode, talkingPhotoId, avatarEngine, voiceId, script, orientation, title }) {
  const entryId = "render_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8);
  const dim = orientation === "portrait" ? { width: 720, height: 1280 } : { width: 1280, height: 720 };

  // Split long scripts into multiple scenes (HeyGen allows max 5000 chars per input_text)
  const chunks = splitScript(script, 4900);

  await addAgentHistoryEntry({
    id: entryId,
    title: title || script.slice(0, 80),
    createdAt: Date.now(),
    status: "loading",
    message: `Render shuru ho raha hai... (${chunks.length} scene${chunks.length > 1 ? "s" : ""})`,
    videoUrl: null,
    type: "render",
  });

  let body;
  if (avatarMode === "prebuilt") {
    body = {
      video_inputs: chunks.map((chunk) => ({ character: { type: "avatar", avatar_id: avatarId, avatar_style: "normal" }, voice: { type: "text", input_text: chunk, voice_id: voiceId } })),
      dimension: dim,
      title: title || "Render Scene",
    };
  } else {
    // talking_photo (Avatar III)
    body = {
      video_inputs: chunks.map((chunk) => ({ character: { type: "talking_photo", talking_photo_id: talkingPhotoId, talking_photo_style: "square" }, voice: { type: "text", input_text: chunk, voice_id: voiceId } })),
      dimension: dim,
      title: title || "Render Scene",
    };
  }

  const res = await fetch("https://api.heygen.com/v2/video/generate", {
    method: "POST",
    headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok || json.error) {
    const msg = json.error?.message || `Render fail hui (HTTP ${res.status})`;
    await updateAgentHistoryEntry(entryId, { status: "error", message: msg });
    throw new Error(msg);
  }

  const videoId = json.data?.video_id;
  if (!videoId) {
    const msg = "video_id response me nahi mila";
    await updateAgentHistoryEntry(entryId, { status: "error", message: msg });
    throw new Error(msg);
  }

  const stored = await storage.get(["pendingRenderSessions"]);
  const sessions = Array.isArray(stored.pendingRenderSessions) ? stored.pendingRenderSessions : [];
  sessions.push({ videoId, entryId, attempts: 0 });
  await storage.set({ pendingRenderSessions: sessions });
  await updateAgentHistoryEntry(entryId, { status: "loading", message: "Render ho raha hai... (thoda wait karo)" });

  setTimeout(() => checkAllRenderSessions(apiKey).catch(() => {}), 10000);
  chrome.alarms.get("pollRenderScene", (existing) => {
    if (!existing) chrome.alarms.create("pollRenderScene", { periodInMinutes: 1 });
  });

  return { videoId, entryId };
}

async function checkAllRenderSessions(apiKey) {
  const stored = await storage.get(["pendingRenderSessions"]);
  const sessions = Array.isArray(stored.pendingRenderSessions) ? stored.pendingRenderSessions : [];
  if (sessions.length === 0) { await chrome.alarms.clear("pollRenderScene"); return; }

  const stillPending = [];
  for (const session of sessions) {
    try {
      const res = await fetch(`https://api.heygen.com/v1/video_status.get?video_id=${encodeURIComponent(session.videoId)}`, { headers: { "x-api-key": apiKey } });
      const json = await res.json();
      const status = json.data?.status;

      if (status === "completed") {
        await updateAgentHistoryEntry(session.entryId, {
          status: "success", message: "Ready ✅",
          videoUrl: json.data.video_url,
          thumbnailUrl: json.data.thumbnail_url || null,
        });
      } else if (status === "failed") {
        const msg = json.data?.error?.message || "Render fail hui — dobara koshish karo";
        await updateAgentHistoryEntry(session.entryId, { status: "error", message: msg });
      } else {
        session.attempts = (session.attempts || 0) + 1;
        if (session.attempts > 40) {
          await updateAgentHistoryEntry(session.entryId, { status: "error", message: "Timeout — HeyGen dashboard me check karo: app.heygen.com" });
        } else {
          await updateAgentHistoryEntry(session.entryId, { status: "loading", message: `Render: ${status || "processing"}... (${session.attempts}/40)` });
          stillPending.push(session);
        }
      }
    } catch (_err) {
      stillPending.push(session); // network blip — try again next alarm
    }
  }

  await storage.set({ pendingRenderSessions: stillPending });
  if (stillPending.length === 0) await chrome.alarms.clear("pollRenderScene");
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "pollVideo") {
    const data = await storage.get(["heygenApiKey", "pendingVideoId"]);
    if (!data.pendingVideoId || !data.heygenApiKey) {
      await chrome.alarms.clear("pollVideo");
      return;
    }
    try {
      await checkVideoStatus(data.heygenApiKey, data.pendingVideoId, "final");
    } catch (err) {
      await storage.set({ generateState: { state: "error", message: "Error: " + err.message } });
    }
  } else if (alarm.name === "pollRenderVideo") {
    const data = await storage.get(["heygenApiKey", "pendingRenderVideoId"]);
    if (!data.pendingRenderVideoId || !data.heygenApiKey) {
      await chrome.alarms.clear("pollRenderVideo");
      return;
    }
    try {
      await checkVideoStatus(data.heygenApiKey, data.pendingRenderVideoId, "preview");
    } catch (err) {
      await storage.set({ renderState: { state: "error", message: "Error: " + err.message } });
    }
  } else if (alarm.name === "pollRenderScene") {
    const data = await storage.get(["heygenApiKey", "pendingRenderSessions"]);
    const sessions = Array.isArray(data.pendingRenderSessions) ? data.pendingRenderSessions : [];
    if (!data.heygenApiKey || sessions.length === 0) {
      await chrome.alarms.clear("pollRenderScene");
      return;
    }
    try {
      await checkAllRenderSessions(data.heygenApiKey);
    } catch (err) {
      console.error("pollRenderScene error:", err);
    }
  } else if (alarm.name === "pollAgentVideo") {
    const data = await storage.get(["heygenApiKey", "pendingAgentSessions"]);
    const sessions = Array.isArray(data.pendingAgentSessions) ? data.pendingAgentSessions : [];
    if (!data.heygenApiKey || sessions.length === 0) {
      await chrome.alarms.clear("pollAgentVideo");
      return;
    }
    try {
      await checkAllAgentSessions(data.heygenApiKey);
    } catch (err) {
      await storage.set({ agentState: { state: "error", message: "Polling error: " + err.message } });
    }
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  (async () => {
    try {
      if (msg.type === "UPLOAD_AVATAR") {
        await storage.set({ avatarUploadState: { state: "loading", message: "Photo upload ho rahi hai..." } });
        const result = await uploadAvatar(msg.payload);
        sendResponse({ ok: true, result });
      } else if (msg.type === "LIST_AVATARS") {
        const result = await listAvatars(msg.payload);
        sendResponse({ ok: true, result });
      } else if (msg.type === "LIST_VOICES") {
        const result = await listVoices(msg.payload);
        sendResponse({ ok: true, result });
      } else if (msg.type === "CLONE_VOICE") {
        await storage.set({ voiceCloneState: { state: "loading", message: "Voice clone ho rahi hai..." } });
        const result = await cloneVoice(msg.payload);
        sendResponse({ ok: true, result });
      } else if (msg.type === "START_GENERATE") {
        const result = await startGenerate(msg.payload);
        sendResponse({ ok: true, result });
      } else if (msg.type === "START_AGENT_VIDEO") {
        const result = await startAgentVideo(msg.payload);
        sendResponse({ ok: true, result });
      } else if (msg.type === "FETCH_ALL_VIDEOS") {
        const result = await fetchAllHeygenVideos(msg.payload);
        sendResponse({ ok: true, result });
      } else if (msg.type === "START_RENDER_SCENE") {
        const result = await startRenderScene(msg.payload);
        sendResponse({ ok: true, result });
      } else {
        sendResponse({ ok: false, error: "Unknown message type" });
      }
    } catch (err) {
      if (msg.type === "UPLOAD_AVATAR") {
        await storage.set({ avatarUploadState: { state: "error", message: "Error: " + err.message } });
      } else if (msg.type === "CLONE_VOICE") {
        await storage.set({ voiceCloneState: { state: "error", message: "Error: " + err.message } });
      }
      sendResponse({ ok: false, error: err.message });
    }
  })();
  return true; // keep the message channel open for async sendResponse
});
