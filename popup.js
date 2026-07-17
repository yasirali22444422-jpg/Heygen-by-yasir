// ============================================
// HEYGEN EXTENSION - TEAM UNLIMITED ACCESS
// PRIVACY COMPLETELY REMOVED
// ============================================

// ---------- MASTER KEY ----------
const MASTER_KEY = 'TEAM-HEYGEN-UNLIMITED-2024';

// ===== TEAM ACCESS - START =====
window.checkAuth = function() { return true; };
window.validateKey = function() { return true; };
window.isPremium = function() { return true; };
window.hasAccess = function() { return true; };

// ===== STORAGE OVERRIDE =====
const storage = {
  get: (keys) => {
    return new Promise((resolve) => {
      chrome.storage.local.get(keys, (result) => {
        // Agar API key maangi hai toh auto-fill karo
        if (keys === 'heygenApiKey' || (Array.isArray(keys) && keys.includes('heygenApiKey'))) {
          result.heygenApiKey = result.heygenApiKey || MASTER_KEY;
        }
        if (keys === 'apiKey' || (Array.isArray(keys) && keys.includes('apiKey'))) {
          result.apiKey = result.apiKey || MASTER_KEY;
        }
        // Premium flags hamesha true
        result.isPremium = true;
        result.isValid = true;
        result.accessGranted = true;
        resolve(result);
      });
    });
  },
  set: (obj) => new Promise((res) => chrome.storage.local.set(obj, res)),
};

// ===== ERROR HANDLING =====
window.addEventListener("error", (e) => showFatal("JS error: " + e.message));
window.addEventListener("unhandledrejection", (e) => showFatal("Error: " + (e.reason?.message || e.reason)));

function showFatal(msg) {
  let el = document.getElementById("fatalError");
  if (!el) {
    el = document.createElement("div");
    el.id = "fatalError";
    el.style.cssText = "position:fixed;bottom:0;left:0;right:0;background:#f87171;color:#000;font-size:11px;padding:6px 10px;z-index:9999;";
    document.body.appendChild(el);
  }
  el.textContent = msg;
}

function setStatus(el, msg, type) {
  el.textContent = msg;
  el.className = "status-text" + (type ? " " + type : "");
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("File read fail hui"));
    reader.readAsDataURL(file);
  });
}

function sendToBackground(type, payload) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type, payload }, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      if (!response) {
        reject(new Error("Background se koi response nahi mila"));
        return;
      }
      if (!response.ok) {
        reject(new Error(response.error || "Unknown error"));
        return;
      }
      resolve(response.result);
    });
  });
}

// ===== CHAR COUNTERS =====
function wireCharCounter(textareaId, counterId, max) {
  const el = document.getElementById(textareaId);
  const counterEl = document.getElementById(counterId);
  if (!el || !counterEl) return;
  const update = () => {
    const len = el.value.length;
    counterEl.textContent = `${len} / ${max} characters`;
    counterEl.classList.remove("warn", "danger");
    if (len > max) counterEl.classList.add("danger");
    else if (len > max * 0.9) counterEl.classList.add("warn");
  };
  el.addEventListener("input", update);
  update();
}
wireCharCounter("rsScript", "rsScriptCharCount", 30000);
wireCharCounter("avPrompt", "avPromptCharCount", 10000);

// =========================================================
// RENDER SCENE
// =========================================================

async function refreshRsSummary() {
  const data = await storage.get(["talkingPhotoId", "avatarPreviewUrl", "voiceId", "voiceName"]);

  function fillSummary(avatarTextId, avatarImgId, voiceTextId) {
    const avatarTextEl = document.getElementById(avatarTextId);
    const avatarImgEl = document.getElementById(avatarImgId);
    const voiceTextEl = document.getElementById(voiceTextId);
    if (!avatarTextEl) return;

    if (data.talkingPhotoId) {
      avatarTextEl.textContent = "✅ Apna Avatar ready hai";
      avatarTextEl.style.color = "#4ade80";
      if (data.avatarPreviewUrl && avatarImgEl) {
        avatarImgEl.src = data.avatarPreviewUrl;
        avatarImgEl.classList.remove("hidden");
      }
    } else {
      avatarTextEl.textContent = "❌ Avatar tab se apna photo upload karo";
      avatarTextEl.style.color = "#f87171";
      if (avatarImgEl) avatarImgEl.classList.add("hidden");
    }

    if (voiceTextEl) {
      if (data.voiceId) {
        voiceTextEl.textContent = "✅ Voice ready: " + (data.voiceName || data.voiceId.slice(0, 20) + "...");
        voiceTextEl.style.color = "#4ade80";
      } else {
        voiceTextEl.textContent = "❌ Voice tab se voice select karo";
        voiceTextEl.style.color = "#f87171";
      }
    }
  }

  fillSummary("rsSummaryAvatarText", "rsSummaryAvatarImg", "rsSummaryVoiceText");
  fillSummary("avSummaryAvatarText", "avSummaryAvatarImg", "avSummaryVoiceText");
}

function loadRsMyAvatar() { refreshRsSummary(); }

// =========================================================
// RENDER SCENE BUTTON
// =========================================================
document.getElementById("rsRenderBtn").addEventListener("click", async () => {
  const statusEl = document.getElementById("rsStatus");
  const apiKey = await getApiKey();
  const script = document.getElementById("rsScript").value.trim();
  const orient = document.getElementById("rsOrientation").value;

  if (!apiKey) { setStatus(statusEl, "Password auto-set hai, koi problem nahi!", "error"); return; }
  if (!script) { setStatus(statusEl, "Script likho — avatar yahi bolega", "error"); return; }
  if (script.length > 30000) { setStatus(statusEl, `Script 30000 characters se zyada hai`, "error"); return; }

  const saved = await storage.get(["talkingPhotoId", "avatarEngine", "voiceId"]);
  if (!saved.talkingPhotoId) {
    setStatus(statusEl, "Pehle Avatar tab me apna photo upload karo", "error");
    return;
  }
  if (!saved.voiceId) {
    setStatus(statusEl, "Pehle Voice tab se ek voice select karo", "error");
    return;
  }

  setStatus(statusEl, "HeyGen ko render request bheja ja raha hai...", "");
  document.getElementById("rsRenderBtn").disabled = true;

  try {
    await sendToBackground("START_RENDER_SCENE", {
      apiKey,
      avatarId: saved.talkingPhotoId,
      avatarMode: "photo",
      talkingPhotoId: saved.talkingPhotoId,
      avatarEngine: saved.avatarEngine || "avatar_iii",
      voiceId: saved.voiceId,
      script,
      orientation: orient,
      title: script.slice(0, 60),
    });
    setStatus(statusEl, "✅ Render shuru ho gayi! Neeche Meri Videos me dikhegi!", "success");
    await refreshAgentHistory();
  } catch (err) {
    setStatus(statusEl, "Error: " + err.message, "error");
  } finally {
    document.getElementById("rsRenderBtn").disabled = false;
  }
});

// ===== TABS =====
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById("tab-" + btn.dataset.tab).classList.add("active");
    if (btn.dataset.tab === "agent") {
      refreshAgentHistory();
    }
  });
});

document.querySelectorAll(".sub-tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const scope = btn.closest(".tab-panel");
    scope.querySelectorAll(".sub-tab-btn").forEach((b) => b.classList.remove("active"));
    scope.querySelectorAll(".sub-panel").forEach((p) => p.classList.remove("active"));
    btn.classList.add("active");
    scope.querySelector("#subtab-" + btn.dataset.subtab).classList.add("active");
  });
});

function renderAvatarState(state) {
  if (!state) return;
  const el = document.getElementById("avatarStatus");
  setStatus(el, state.message, state.state === "error" ? "error" : state.state === "success" ? "success" : "");
  document.getElementById("uploadAvatarBtn").disabled = state.state === "loading";
}

function renderCustomAvatarLookState(state) {
  const el = document.getElementById("avatarAgentLookStatus");
  if (!state) {
    setStatus(el, "", "");
    return;
  }
  setStatus(el, state.message, state.state === "error" ? "error" : state.state === "success" ? "success" : "");
}

function renderVoiceCloneState(state) {
  if (!state) return;
  const el = document.getElementById("cloneStatus");
  setStatus(el, state.message, state.state === "error" ? "error" : state.state === "success" ? "success" : "");
  document.getElementById("cloneVoiceBtn").disabled = state.state === "loading";
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (changes.avatarUploadState) renderAvatarState(changes.avatarUploadState.newValue);
  if (changes.customAvatarLookState) renderCustomAvatarLookState(changes.customAvatarLookState.newValue);
  if (changes.voiceCloneState) renderVoiceCloneState(changes.voiceCloneState.newValue);
  if (changes.agentState) renderAgentState(changes.agentState.newValue);
  if (changes.agentHistory) renderAgentHistory(changes.agentHistory.newValue);
  if (changes.imageKey || changes.talkingPhotoId || changes.selectedAvatarId || changes.avatarMode || changes.customAvatarLookId || changes.voiceId || changes.voiceName || changes.avatarPreviewUrl)
    refreshRsSummary();
});

setInterval(refreshAgentHistory, 30000);

// =========================================================
// INIT - AUTO SETUP
// =========================================================
(async function init() {
  // Pehle storage se key check karo
  const stored = await storage.get(['heygenApiKey']);
  const keyToUse = stored.heygenApiKey || MASTER_KEY;
  
  // MASTER KEY AUTO-SETUP
  await storage.set({
    heygenApiKey: keyToUse,
    apiKey: keyToUse,
    userKey: keyToUse,
    isPremium: true,
    isValid: true,
    expiryDate: '2099-12-31',
    accessGranted: true,
    plan: 'unlimited',
    teamAccess: true
  });

  console.log('✅ HeyGen Team Unlimited Access Activated!');
  console.log('🔑 Key:', keyToUse);

  // Auto-fill API key field
  const keyInput = document.getElementById('apiKey');
  if (keyInput) {
    keyInput.value = keyToUse;
  }
  setStatus(document.getElementById('keyStatus'), "✅ Team Access: Unlimited use!", "success");

  const data = await storage.get([
    "heygenApiKey",
    "imageKey",
    "talkingPhotoId",
    "avatarEngine",
    "avatarPreviewUrl",
    "voiceId",
    "avatarUploadState",
    "customAvatarLookState",
    "voiceCloneState",
    "agentState",
  ]);

  if (data.avatarPreviewUrl) {
    document.getElementById("avatarPreview").src = data.avatarPreviewUrl;
    document.getElementById("avatarPreviewWrap").classList.remove("hidden");
  }
  if (data.voiceId) {
    document.getElementById("voiceIdInput").value = data.voiceId;
    setStatus(document.getElementById("voiceIdStatus"), "Voice ID saved hai ✓", "success");
  }
  const engineRadio = document.querySelector(`input[name="motionEngine"][value="${data.avatarEngine === "avatar_iv" ? "avatar_iv" : "avatar_iii"}"]`);
  if (engineRadio) engineRadio.checked = true;
  renderAvatarState(data.avatarUploadState || (data.imageKey || data.talkingPhotoId ? { state: "success", message: "Avatar saved hai ✓" } : null));
  renderCustomAvatarLookState(data.customAvatarLookState);
  renderVoiceCloneState(data.voiceCloneState);
  renderAgentState(data.agentState);
  refreshAgentHistory();
  loadRsMyAvatar();
})();

async function getApiKey() {
  const data = await storage.get(['heygenApiKey']);
  return data.heygenApiKey || MASTER_KEY;
}

// =========================================================
// SAVE API KEY
// =========================================================
document.getElementById("saveKeyBtn").addEventListener("click", async () => {
  const statusEl = document.getElementById("keyStatus");
  const keyInput = document.getElementById("apiKey");
  const key = keyInput.value.trim();
  if (!key) {
    setStatus(statusEl, "Key daalo", "error");
    return;
  }
  await storage.set({ heygenApiKey: key });
  setStatus(statusEl, "✅ Key save ho gayi!", "success");
});

// =========================================================
// AVATAR UPLOAD
// =========================================================
document.getElementById("avatarFile").addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const url = URL.createObjectURL(file);
  document.getElementById("avatarPreview").src = url;
  document.getElementById("avatarPreviewWrap").classList.remove("hidden");
});

document.getElementById("uploadAvatarBtn").addEventListener("click", async () => {
  const statusEl = document.getElementById("avatarStatus");
  const fileInput = document.getElementById("avatarFile");
  const apiKey = await getApiKey();

  if (!apiKey) {
    setStatus(statusEl, "Error: Key nahi mili", "error");
    return;
  }
  const file = fileInput.files[0];
  if (!file) {
    setStatus(statusEl, "Pehle photo select karo", "error");
    return;
  }

  setStatus(statusEl, "Photo padhi ja rahi hai...", "");
  try {
    const engine = (document.querySelector('input[name="motionEngine"]:checked') || {}).value || "avatar_iii";
    const base64 = await fileToBase64(file);
    setStatus(statusEl, "Upload ho raha hai...", "");
    await sendToBackground("UPLOAD_AVATAR", {
      apiKey,
      base64,
      mimeType: file.type,
      fileName: file.name,
      engine,
    });
    setStatus(statusEl, "✅ Avatar save ho gaya!", "success");
  } catch (err) {
    setStatus(statusEl, "Error: " + err.message, "error");
  }
});

// =========================================================
// AVATAR LIST
// =========================================================
document.getElementById("loadAvatarsBtn").addEventListener("click", async () => {
  const statusEl = document.getElementById("avatarListStatus");
  const apiKey = await getApiKey();
  if (!apiKey) {
    setStatus(statusEl, "Error: Key nahi mili", "error");
    return;
  }
  setStatus(statusEl, "Avatars load ho rahe hain...", "");
  try {
    const result = await sendToBackground("LIST_AVATARS", { apiKey });
    renderAvatarGrid(result.avatars);
    setStatus(statusEl, result.avatars.length + " avatars mile!", "success");
  } catch (err) {
    setStatus(statusEl, "Error: " + err.message, "error");
  }
});

async function renderAvatarGrid(avatars) {
  const grid = document.getElementById("avatarGrid");
  const data = await storage.get(["selectedAvatarId"]);
  grid.innerHTML = "";
  avatars.forEach((av) => {
    const card = document.createElement("div");
    card.className = "avatar-card" + (av.avatar_id === data.selectedAvatarId ? " selected" : "");
    card.innerHTML = `<img src="${av.preview_image_url || ""}" alt="${av.avatar_name || "avatar"}" /><span class="avatar-name">${av.avatar_name || av.avatar_id}</span>`;
    card.addEventListener("click", async () => {
      await storage.set({
        selectedAvatarId: av.avatar_id,
        selectedAvatarPreview: av.preview_image_url || "",
        avatarMode: "prebuilt",
      });
      grid.querySelectorAll(".avatar-card").forEach((c) => c.classList.remove("selected"));
      card.classList.add("selected");
      setStatus(document.getElementById("avatarListStatus"), av.avatar_name + " select ho gaya ✓", "success");
    });
    grid.appendChild(card);
  });
}

// =========================================================
// VOICE LIST
// =========================================================
let allVoicesCache = [];

document.getElementById("loadVoicesBtn").addEventListener("click", async () => {
  const statusEl = document.getElementById("voiceListStatus");
  const apiKey = await getApiKey();
  if (!apiKey) {
    setStatus(statusEl, "Error: Key nahi mili", "error");
    return;
  }
  setStatus(statusEl, "Voices load ho rahi hain...", "");
  try {
    const result = await sendToBackground("LIST_VOICES", { apiKey });
    allVoicesCache = result.voices;
    renderVoiceList(allVoicesCache);
    setStatus(statusEl, allVoicesCache.length + " voices mili!", "success");
  } catch (err) {
    setStatus(statusEl, "Error: " + err.message, "error");
  }
});

document.getElementById("voiceSearchInput").addEventListener("input", (e) => {
  const q = e.target.value.trim().toLowerCase();
  if (!allVoicesCache.length) return;
  const filtered = !q ? allVoicesCache : allVoicesCache.filter((v) => (v.name || "").toLowerCase().includes(q) || (v.language || "").toLowerCase().includes(q) || (v.gender || "").toLowerCase().includes(q));
  renderVoiceList(filtered);
});

let currentAudio = null;

async function renderVoiceList(voices) {
  const list = document.getElementById("voiceList");
  const data = await storage.get(["voiceId"]);
  list.innerHTML = "";
  voices.slice(0, 100).forEach((v) => {
    const row = document.createElement("div");
    row.className = "voice-item" + (v.voice_id === data.voiceId ? " selected" : "");
    row.innerHTML = `
      <div class="voice-info">
        <div class="voice-name">${v.name || v.voice_id}</div>
        <div class="voice-meta">${v.language || ""} · ${v.gender || ""}</div>
      </div>
      ${v.preview_audio_url ? '<button class="voice-play-btn">▶</button>' : ""}
      <button class="voice-select-btn">${v.voice_id === data.voiceId ? "✓" : "Select"}</button>
    `;

    if (v.preview_audio_url) {
      row.querySelector(".voice-play-btn").addEventListener("click", () => {
        if (currentAudio) currentAudio.pause();
        currentAudio = new Audio(v.preview_audio_url);
        currentAudio.play();
      });
    }

    row.querySelector(".voice-select-btn").addEventListener("click", async () => {
      await storage.set({ voiceId: v.voice_id, voiceName: v.name || v.voice_id });
      document.getElementById("voiceIdInput").value = v.voice_id;
      list.querySelectorAll(".voice-item").forEach((r) => {
        r.classList.remove("selected");
        r.querySelector(".voice-select-btn").textContent = "Select";
      });
      row.classList.add("selected");
      row.querySelector(".voice-select-btn").textContent = "✓";
      setStatus(document.getElementById("voiceListStatus"), (v.name || v.voice_id) + " select ho gaya ✓", "success");
      setStatus(document.getElementById("voiceIdStatus"), "Voice ID saved hai ✓", "success");
    });

    list.appendChild(row);
  });
}

document.getElementById("saveVoiceIdBtn").addEventListener("click", async () => {
  const statusEl = document.getElementById("voiceIdStatus");
  const voiceId = document.getElementById("voiceIdInput").value.trim();
  if (!voiceId) {
    setStatus(statusEl, "Voice ID daalo", "error");
    return;
  }
  await storage.set({ voiceId, voiceName: "" });
  setStatus(statusEl, "Voice ID save ho gaya ✓", "success");
});

// =========================================================
// CLONE VOICE
// =========================================================
document.getElementById("cloneVoiceBtn").addEventListener("click", async () => {
  const statusEl = document.getElementById("cloneStatus");
  const apiKey = await getApiKey();
  const file = document.getElementById("voiceFile").files[0];
  const name = document.getElementById("voiceName").value.trim() || "My Cloned Voice";

  if (!apiKey) {
    setStatus(statusEl, "Error: Key nahi mili", "error");
    return;
  }
  if (!file) {
    setStatus(statusEl, "Pehle audio sample select karo", "error");
    return;
  }

  setStatus(statusEl, "Audio padha ja raha hai...", "");
  try {
    const base64 = await fileToBase64(file);
    setStatus(statusEl, "Voice clone ho rahi hai...", "");
    const result = await sendToBackground("CLONE_VOICE", {
      apiKey,
      base64,
      mimeType: file.type,
      fileName: file.name,
      name,
    });
    document.getElementById("voiceIdInput").value = result.voiceId;
    setStatus(statusEl, "✅ Voice clone ho gayi! ID: " + result.voiceId, "success");
  } catch (err) {
    setStatus(statusEl, "Error: " + err.message + " — Voice ID tab use karo.", "error");
  }
});

// =========================================================
// AGENT VIDEO
// =========================================================
document.getElementById("avRenderBtn").addEventListener("click", async () => {
  const statusEl = document.getElementById("avStatus");
  const apiKey = await getApiKey();
  const prompt = document.getElementById("avPrompt").value.trim();
  const orient = document.getElementById("avOrientation").value;

  if (!apiKey) { setStatus(statusEl, "Error: Key nahi mili", "error"); return; }
  if (!prompt) { setStatus(statusEl, "Topic ya prompt likho", "error"); return; }
  if (prompt.length > 10000) { setStatus(statusEl, "Prompt 10000 chars se zyada hai", "error"); return; }

  const saved = await storage.get(["talkingPhotoId", "avatarEngine", "voiceId"]);
  if (!saved.talkingPhotoId) {
    setStatus(statusEl, "Pehle Avatar tab me apna photo upload karo", "error");
    return;
  }
  if (!saved.voiceId) {
    setStatus(statusEl, "Pehle Voice tab se ek voice select karo", "error");
    return;
  }

  setStatus(statusEl, "HeyGen ko agent video request bheja ja raha hai...", "");
  document.getElementById("avRenderBtn").disabled = true;

  try {
    await sendToBackground("START_AGENT_VIDEO", {
      apiKey,
      prompt,
      orientation: orient,
      voiceId: saved.voiceId,
      avatarId: saved.talkingPhotoId,
    });
    setStatus(statusEl, "✅ Agent video shuru ho gayi! Neeche dikhegi!", "success");
    await refreshAgentHistory();
  } catch (err) {
    setStatus(statusEl, "Error: " + err.message, "error");
  } finally {
    document.getElementById("avRenderBtn").disabled = false;
  }
});

function refreshAgentSummary() {}

function renderAgentState(_state) {}

// =========================================================
// VIDEO HISTORY
// =========================================================
function relativeTimeHi(ts) {
  const diffMs = Date.now() - ts;
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "abhi";
  if (min < 60) return `${min} minute${min > 1 ? "s" : ""} pehle`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hour${hr > 1 ? "s" : ""} pehle`;
  const days = Math.floor(hr / 24);
  return `${days} din pehle`;
}

function renderAgentHistory(history) {
  const grid = document.getElementById("agentHistoryGrid");
  const countEl = document.getElementById("agentHistoryCount");
  if (!grid) return;
  const list = Array.isArray(history) ? history : [];

  if (list.length) {
    const ready = list.filter((v) => v.status === "success").length;
    const loading = list.filter((v) => v.status === "loading").length;
    const failed = list.filter((v) => v.status === "error").length;
    const parts = [];
    if (ready) parts.push(`${ready} ready ✅`);
    if (loading) parts.push(`${loading} ban rahi hai ⏳`);
    if (failed) parts.push(`${failed} fail ❌`);
    countEl.textContent = parts.join(" · ");
  } else {
    countEl.textContent = "";
  }

  if (!list.length) {
    grid.innerHTML = `<div class="history-empty">Abhi tak koi video nahi bani — upar se pehli video banao.</div>`;
    return;
  }

  grid.innerHTML = list.map((item) => {
    const badgeClass = item.status === "success" ? "success" : item.status === "error" ? "error" : "loading";
    const badgeText = item.status === "success" ? "✅ Ready" : item.status === "error" ? "❌ Fail" : "⏳ Ban rahi hai";
    const thumb = item.thumbnailUrl ? `<img src="${item.thumbnailUrl}" alt="thumbnail" style="width:100%;height:100%;object-fit:cover;" />` : item.status === "success" && item.videoUrl ? `<video src="${item.videoUrl}" muted preload="metadata"></video>` : item.status === "error" ? `<span style="font-size:24px;">⚠️</span>` : `<span class="spinner"></span>`;
    const title = (item.title || "Video").replace(/</g, "&lt;");
    const errorLine = item.status === "error" && item.message ? `<p class="history-errmsg">${item.message.replace(/</g, "&lt;").slice(0, 80)}</p>` : "";
    const downloadBtn = item.status === "success" && item.videoUrl ? `<a class="history-dl-btn" href="${item.videoUrl}" target="_blank" rel="noopener" onclick="event.stopPropagation()">⬇ Download</a>` : "";
    return `
      <div class="history-card" data-id="${item.id}" data-url="${item.videoUrl || ""}">
        <div class="history-thumb">
          ${thumb}
          <span class="history-badge ${badgeClass}">${badgeText}</span>
        </div>
        <div class="history-info">
          <p class="history-title">${title}</p>
          ${errorLine}
          <p class="history-time">${relativeTimeHi(item.createdAt)}</p>
          ${downloadBtn}
        </div>
      </div>`;
  }).join("");

  grid.querySelectorAll(".history-card").forEach((card) => {
    card.addEventListener("click", () => {
      const url = card.dataset.url;
      if (url) chrome.tabs.create({ url });
    });
  });
}

async function refreshAgentHistory() {
  const data = await storage.get(["agentHistory"]);
  renderAgentHistory(data.agentHistory || []);
}

console.log('✅✅✅ ALL PRIVACY REMOVED - TEAM UNLIMITED ACCESS! ✅✅✅');
