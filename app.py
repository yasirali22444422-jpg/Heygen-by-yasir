# ============================================================
# app.py - FINAL FIXED VERSION (Avatar IV Working)
# ============================================================

import streamlit as st
import requests
import base64
import json
import time
from datetime import datetime
from PIL import Image
import io

# ===== AUTO API KEY =====
YOUR_REAL_HEYGEN_API_KEY = 'sk_V2_hgu_kuujglU11Oe_x9fCykWNbZsKqF0lrDtIy5wqiWCPiwx4'

# ===== SESSION STATE =====
if 'api_key' not in st.session_state:
    st.session_state.api_key = YOUR_REAL_HEYGEN_API_KEY
if 'talking_photo_id' not in st.session_state:
    st.session_state.talking_photo_id = None
if 'image_key' not in st.session_state:
    st.session_state.image_key = None
if 'avatar_preview_url' not in st.session_state:
    st.session_state.avatar_preview_url = None
if 'avatar_engine' not in st.session_state:
    st.session_state.avatar_engine = None
if 'voice_id' not in st.session_state:
    st.session_state.voice_id = None
if 'voice_name' not in st.session_state:
    st.session_state.voice_name = None
if '_voices' not in st.session_state:
    st.session_state._voices = []
if 'video_history' not in st.session_state:
    st.session_state.video_history = []

# ===== PAGE CONFIG =====
st.set_page_config(
    page_title="HeyGen Avatar & Voice Studio",
    page_icon="🎬",
    layout="wide"
)

# ===== CSS =====
st.markdown("""
<style>
    .main { padding: 20px; background: #0f0f14; }
    .stButton button { 
        width: 100%; 
        background: linear-gradient(135deg, #7c3aed, #ec4899); 
        color: white; 
        border: none; 
        border-radius: 8px; 
        padding: 10px; 
        font-weight: bold; 
    }
    .stButton button:hover { transform: scale(1.02); }
    .stButton button:disabled { opacity: 0.5; cursor: not-allowed; }
    .summary-box {
        background: #1c1c26;
        border: 1px solid #2c2c3a;
        border-radius: 10px;
        padding: 12px 16px;
        margin: 10px 0;
    }
    .summary-box .row {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 4px 0;
    }
    .summary-box .row .label {
        font-size: 12px;
        color: #8b8b9a;
        min-width: 80px;
    }
    .summary-box .row .value.ready {
        color: #4ade80;
    }
    .summary-box .row .value.missing {
        color: #f87171;
    }
    .info-box {
        background: #1c1c26;
        border: 1px solid #7c3aed;
        border-radius: 8px;
        padding: 10px;
        margin: 10px 0;
    }
    .warning-box {
        background: #1c1c26;
        border: 1px solid #fbbf24;
        border-radius: 8px;
        padding: 10px;
        margin: 10px 0;
    }
    .success-box {
        background: #1c1c26;
        border: 1px solid #4ade80;
        border-radius: 8px;
        padding: 10px;
        margin: 10px 0;
    }
</style>
""", unsafe_allow_html=True)

# ===== HEADER =====
st.markdown("""
<div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid #23232e;margin-bottom:20px;">
    <div style="width:12px;height:12px;border-radius:50%;background:linear-gradient(135deg,#7c3aed,#ec4899);"></div>
    <h1 style="color:#eaeaf0;font-size:20px;">🎬 HeyGen Avatar & Voice Studio</h1>
</div>
""", unsafe_allow_html=True)

# ===== API KEY =====
col1, col2, col3 = st.columns([2, 1, 1])
with col1:
    st.text_input("🔑 API Key", value=st.session_state.api_key, type="password", disabled=True)
with col3:
    st.markdown("""
    <div style="background:#1a1a2e;border:2px solid #4ade80;border-radius:8px;padding:8px;text-align:center;">
        <span style="color:#4ade80;font-weight:bold;">✅ Unlimited Access</span>
    </div>
    """, unsafe_allow_html=True)

# ===== FUNCTIONS =====

def upload_avatar_iii(api_key, file_bytes, mime_type, file_name):
    """Upload to Avatar III endpoint"""
    url = "https://upload.heygen.com/v1/talking_photo"
    files = {'file': (file_name, file_bytes, mime_type)}
    headers = {'x-api-key': api_key}
    response = requests.post(url, headers=headers, files=files)
    
    if response.status_code != 200:
        try:
            error_data = response.json()
            error_msg = error_data.get('error', {}).get('message', response.text)
        except:
            error_msg = response.text
        raise Exception(f"Upload failed: {error_msg}")
    
    data = response.json()
    if data.get('error'):
        raise Exception(f"Upload failed: {data['error'].get('message', 'Unknown error')}")
    
    talking_photo_id = data.get('data', {}).get('talking_photo_id')
    preview_url = data.get('data', {}).get('talking_photo_url')
    
    if not talking_photo_id:
        raise Exception("talking_photo_id not found in response")
    
    return {"talking_photo_id": talking_photo_id, "preview_url": preview_url}

def upload_avatar_iv(api_key, file_bytes, mime_type, file_name):
    """Upload to Avatar IV endpoint"""
    url = "https://api.heygen.com/v3/assets"
    files = {'file': (file_name, file_bytes, mime_type)}
    headers = {'x-api-key': api_key}
    response = requests.post(url, headers=headers, files=files)
    
    if response.status_code != 200:
        try:
            error_data = response.json()
            error_msg = error_data.get('error', {}).get('message', response.text)
        except:
            error_msg = response.text
        raise Exception(f"Upload failed: {error_msg}")
    
    data = response.json()
    if data.get('error'):
        raise Exception(f"Upload failed: {data['error'].get('message', 'Unknown error')}")
    
    upload_url = data['data']['url']
    image_key = upload_url.split('/')[-1]
    
    return {"image_key": image_key, "preview_url": upload_url}

def list_voices(api_key):
    response = requests.get(
        "https://api.heygen.com/v3/voices",
        headers={"x-api-key": api_key}
    )
    data = response.json()
    if response.status_code != 200 or data.get('error'):
        raise Exception(data.get('error', {}).get('message', 'Voices load nahi hui'))
    return data['data'] if isinstance(data['data'], list) else data['data'].get('voices', [])

def generate_video_av4(api_key, image_key, voice_id, script, title):
    """
    Generate video using Avatar IV - CORRECT ENDPOINT
    """
    # Avatar IV script limit is 5000 chars
    if len(script) > 5000:
        raise Exception("Script 5000 characters se zyada hai")
    
    payload = {
        "image_key": image_key,
        "video_title": title or "My Video",
        "script": script,
        "voice_id": voice_id,
        "test": False
    }
    
    response = requests.post(
        "https://api.heygen.com/v2/video/av4/generate",  # ✅ Correct endpoint
        headers={"x-api-key": api_key, "Content-Type": "application/json"},
        json=payload
    )
    
    data = response.json()
    if response.status_code != 200 or data.get('error'):
        raise Exception(data.get('error', {}).get('message', f'Video generation failed'))
    
    video_id = data.get('data', {}).get('video_id')
    if not video_id:
        raise Exception("video_id not found in response")
    
    return video_id

def generate_video_iii(api_key, talking_photo_id, voice_id, script, title):
    """Generate video using Avatar III"""
    chunks = []
    remaining = script
    max_len = 4900
    while len(remaining) > max_len:
        cut = remaining.rfind('.', 0, max_len)
        if cut < max_len * 0.4:
            cut = remaining.rfind(' ', 0, max_len)
        if cut < 1:
            cut = max_len
        chunks.append(remaining[:cut+1].strip())
        remaining = remaining[cut+1:].strip()
    if remaining:
        chunks.append(remaining)
    
    video_inputs = []
    for chunk in chunks:
        video_inputs.append({
            "character": {
                "type": "talking_photo",
                "talking_photo_id": talking_photo_id,
                "talking_photo_style": "square"
            },
            "voice": {
                "type": "text",
                "input_text": chunk,
                "voice_id": voice_id
            }
        })
    
    payload = {
        "video_inputs": video_inputs,
        "dimension": {"width": 1280, "height": 720},
        "title": title or "Render Scene"
    }
    
    response = requests.post(
        "https://api.heygen.com/v2/video/generate",
        headers={"x-api-key": api_key, "Content-Type": "application/json"},
        json=payload
    )
    
    data = response.json()
    if response.status_code != 200 or data.get('error'):
        raise Exception(data.get('error', {}).get('message', f'Render fail hui'))
    
    video_id = data.get('data', {}).get('video_id')
    if not video_id:
        raise Exception("video_id not found in response")
    return video_id

def check_video_status(api_key, video_id):
    response = requests.get(
        f"https://api.heygen.com/v1/video_status.get?video_id={video_id}",
        headers={"x-api-key": api_key}
    )
    data = response.json()
    if response.status_code != 200 or data.get('error'):
        raise Exception(data.get('error', {}).get('message', f'Status check fail hui'))
    return data['data']

def generate_agent_video(api_key, prompt, voice_id, avatar_id, orientation="landscape"):
    """Generate agent video - requires Avatar III (talking_photo_id)"""
    payload = {"prompt": prompt, "orientation": orientation}
    if voice_id:
        payload["voice_id"] = voice_id
    if avatar_id:
        payload["avatar_id"] = avatar_id
    
    response = requests.post(
        "https://api.heygen.com/v3/video-agents",
        headers={"x-api-key": api_key, "Content-Type": "application/json"},
        json=payload
    )
    
    data = response.json()
    if response.status_code != 200 or data.get('error'):
        raise Exception(data.get('error', {}).get('message', f'Agent request fail hui'))
    
    session_id = data.get('data', {}).get('session_id')
    if not session_id:
        raise Exception("session_id not found in response")
    return session_id

def check_agent_status(api_key, session_id):
    response = requests.get(
        f"https://api.heygen.com/v3/video-agents/{session_id}",
        headers={"x-api-key": api_key}
    )
    data = response.json()
    if response.status_code != 200 or data.get('error'):
        raise Exception(data.get('error', {}).get('message', f'Session check fail hui'))
    return data['data']

# ===== TABS =====
tab1, tab2, tab3, tab4 = st.tabs(["🔑 Settings", "👤 Avatar", "🎤 Voice", "🎬 Video Banao"])

# ===== TAB 1 =====
with tab1:
    st.markdown("""
    <div style="background:#1a1a2e;border:2px solid #4ade80;border-radius:10px;padding:15px;margin:10px 0;">
        <strong style="color:#4ade80;">✅ Team Unlimited Access</strong><br>
        <span style="color:#8b8b9a;">API Key auto-set hai - koi verification nahi!</span>
    </div>
    """, unsafe_allow_html=True)
    st.info("🎉 Unlimited Access Active! No credit limits!")

# ===== TAB 2: AVATAR =====
with tab2:
    st.markdown("### 📸 Apna Avatar Upload Karo")
    
    col1, col2 = st.columns([1, 1])
    
    with col1:
        avatar_file = st.file_uploader(
            "Photo select karo (clear, front-facing)",
            type=['png', 'jpg', 'jpeg']
        )
        
        engine = st.radio(
            "Engine:",
            ["avatar_iii (For Agent Video)", "avatar_iv (For Script Video)"],
            index=1  # Default to Avatar IV
        )
        
        if avatar_file:
            file_bytes = avatar_file.read()
            st.info(f"📁 File: {avatar_file.name}")
            st.info(f"📊 Size: {len(file_bytes)//1024} KB")
            avatar_file.seek(0)
        
        if avatar_file and st.button("📤 Upload & Save Avatar", use_container_width=True):
            with st.spinner("Upload ho raha hai..."):
                try:
                    file_bytes = avatar_file.read()
                    
                    if "avatar_iii" in engine:
                        result = upload_avatar_iii(
                            st.session_state.api_key,
                            file_bytes,
                            avatar_file.type,
                            avatar_file.name
                        )
                        st.session_state.talking_photo_id = result['talking_photo_id']
                        st.session_state.avatar_engine = "avatar_iii"
                        st.success("✅ Avatar III save ho gaya!")
                    else:
                        result = upload_avatar_iv(
                            st.session_state.api_key,
                            file_bytes,
                            avatar_file.type,
                            avatar_file.name
                        )
                        st.session_state.image_key = result['image_key']
                        st.session_state.avatar_engine = "avatar_iv"
                        st.success("✅ Avatar IV save ho gaya!")
                    
                    st.session_state.avatar_preview_url = result['preview_url']
                    st.rerun()
                    
                except Exception as e:
                    st.error(f"❌ Error: {str(e)}")
    
    with col2:
        if st.session_state.avatar_preview_url:
            st.image(st.session_state.avatar_preview_url, caption="Your Avatar", use_container_width=True)
            if st.session_state.talking_photo_id:
                st.success("✅ Avatar III Ready!")
                st.code(st.session_state.talking_photo_id[:40] + "...")
            elif st.session_state.image_key:
                st.success("✅ Avatar IV Ready!")
                st.code(st.session_state.image_key[:40] + "...")
        else:
            st.info("👆 Photo upload karo")

# ===== TAB 3: VOICE =====
with tab3:
    st.markdown("### 🎤 Voice Select Karo")
    
    if st.button("🎤 Voices Load Karo", use_container_width=True):
        with st.spinner("Loading voices..."):
            try:
                voices = list_voices(st.session_state.api_key)
                st.session_state._voices = voices
                st.success(f"{len(voices)} voices mili!")
            except Exception as e:
                st.error(f"Error: {str(e)}")
    
    if st.session_state._voices:
        search = st.text_input("🔍 Search voices", placeholder="Naam, language, gender...")
        filtered = st.session_state._voices
        if search:
            search_lower = search.lower()
            filtered = [v for v in filtered if 
                       search_lower in v.get('name', '').lower() or 
                       search_lower in v.get('language', '').lower()]
        
        for voice in filtered[:20]:
            col1, col2, col3 = st.columns([3, 1, 1])
            with col1:
                st.markdown(f"**{voice.get('name', voice.get('voice_id'))}**")
                st.caption(f"{voice.get('language', '')} · {voice.get('gender', '')}")
            with col2:
                if voice.get('preview_audio_url'):
                    if st.button("▶", key=f"play_{voice.get('voice_id')}"):
                        st.audio(voice['preview_audio_url'])
            with col3:
                if st.button("Select", key=f"sel_{voice.get('voice_id')}"):
                    st.session_state.voice_id = voice['voice_id']
                    st.session_state.voice_name = voice.get('name', voice.get('voice_id'))
                    st.success(f"✅ {voice.get('name', 'Voice')} selected!")

# ===== TAB 4: VIDEO =====
with tab4:
    st.markdown("### 🎬 Video Banao")
    
    # Summary
    avatar_ready = bool(st.session_state.talking_photo_id or st.session_state.image_key)
    voice_ready = bool(st.session_state.voice_id)
    
    avatar_type = "Avatar III" if st.session_state.talking_photo_id else "Avatar IV" if st.session_state.image_key else "None"
    
    st.markdown(f"""
    <div class="summary-box">
        <div class="row">
            <span class="label">👤 Avatar:</span>
            <span class="value {'ready' if avatar_ready else 'missing'}">
                {'✅ ' + avatar_type + ' ready' if avatar_ready else '❌ Avatar tab se photo upload karo'}
            </span>
        </div>
        <div class="row">
            <span class="label">🎤 Voice:</span>
            <span class="value {'ready' if voice_ready else 'missing'}">
                {'✅ ' + (st.session_state.voice_name or st.session_state.voice_id[:20] + '...') if voice_ready else '❌ Voice tab se voice select karo'}
            </span>
        </div>
    </div>
    """, unsafe_allow_html=True)
    
    # ===== SCRIPT SE VIDEO =====
    st.markdown("### ✍️ Script Se Video")
    
    st.markdown("""
    <div class="info-box">
        <strong style="color:#7c3aed;">📝 Avatar IV - Script Se Video</strong><br>
        <span style="color:#8b8b9a;">Avatar IV ke saath <strong>script</strong> likh kar video banaen</span>
    </div>
    """, unsafe_allow_html=True)
    
    script = st.text_area(
        "Script likho (Avatar IV: maximum 5000 characters)",
        placeholder="Yahan exact text likho jo avatar bolega...",
        height=150
    )
    
    col1, col2 = st.columns([1, 1])
    with col1:
        title = st.text_input("Video Title (optional)", placeholder="Video ka naam")
    
    # Script length check
    script_len = len(script)
    if script_len > 0:
        if st.session_state.image_key:
            if script_len <= 5000:
                st.info(f"📝 {script_len} / 5000 characters ✅")
            else:
                st.error(f"❌ {script_len} / 5000 characters - Too long!")
        elif st.session_state.talking_photo_id:
            if script_len <= 30000:
                st.info(f"📝 {script_len} / 30000 characters (Avatar III)")
            else:
                st.error(f"❌ {script_len} / 30000 characters - Too long!")
        else:
            st.info(f"📝 {script_len} characters")
    
    if st.button("🎬 Render Karo - Avatar IV", use_container_width=True):
        if not st.session_state.image_key:
            st.error("❌ Avatar IV upload karo! Avatar tab mein 'avatar_iv' select karo.")
        elif not st.session_state.voice_id:
            st.error("❌ Voice select karo!")
        elif not script:
            st.error("❌ Script likho!")
        elif len(script) > 5000:
            st.error("❌ Avatar IV limit: 5000 characters!")
        else:
            with st.spinner("Video render ho rahi hai..."):
                try:
                    video_id = generate_video_av4(
                        st.session_state.api_key,
                        st.session_state.image_key,
                        st.session_state.voice_id,
                        script,
                        title
                    )
                    
                    st.success(f"✅ Video generate ho rahi hai! ID: {video_id}")
                    
                    with st.spinner("Video render ho rahi hai... (1-3 minute)"):
                        for _ in range(30):
                            time.sleep(10)
                            status_data = check_video_status(st.session_state.api_key, video_id)
                            if status_data.get('status') == 'completed':
                                st.success("✅ Video ready hai!")
                                st.video(status_data['video_url'])
                                break
                            elif status_data.get('status') == 'failed':
                                st.error("❌ Video generation fail hui!")
                                break
                        else:
                            st.warning("⏳ Timeout - HeyGen dashboard me check karo")
                
                except Exception as e:
                    st.error(f"Error: {str(e)}")
    
    st.markdown("---")
    
    # ===== AVATAR III (Agent Video) =====
    st.markdown("### 🤖 Agent Video (Avatar III Only)")
    
    st.markdown("""
    <div class="warning-box">
        <strong style="color:#fbbf24;">⚠️ Agent Video - Sirf Avatar III</strong><br>
        <span style="color:#8b8b9a;">Agent video ke liye <strong>Avatar III</strong> (talking_photo_id) hona chahiye</span>
    </div>
    """, unsafe_allow_html=True)
    
    if not st.session_state.talking_photo_id:
        st.warning("Agent Video ke liye Avatar III upload karo (Avatar tab mein)")
    
    prompt = st.text_area(
        "Topic / Prompt (Agent Video)",
        placeholder="Jaise: 'Collagen ke fayde...'",
        height=80,
        key="agent_prompt"
    )
    
    col1, col2 = st.columns([1, 1])
    with col1:
        agent_orientation = st.selectbox("Orientation", ["landscape", "portrait"], index=0, key="agent_ori")
    with col2:
        agent_title = st.text_input("Video Title (optional)", placeholder="Video ka naam", key="agent_title")
    
    if st.button("🤖 Agent Video Banao", use_container_width=True):
        if not st.session_state.talking_photo_id:
            st.error("❌ Agent Video ke liye Avatar III chahiye! Avatar tab mein upload karo.")
        elif not st.session_state.voice_id:
            st.error("❌ Voice select karo!")
        elif not prompt:
            st.error("❌ Prompt likho!")
        else:
            with st.spinner("Agent video generate ho rahi hai..."):
                try:
                    session_id = generate_agent_video(
                        st.session_state.api_key,
                        prompt,
                        st.session_state.voice_id,
                        st.session_state.talking_photo_id,
                        agent_orientation
                    )
                    
                    st.success(f"✅ Agent video shuru ho gayi! Session: {session_id}")
                    
                    with st.spinner("Video render ho rahi hai... (2-3 minute)"):
                        for _ in range(40):
                            time.sleep(10)
                            status_data = check_agent_status(st.session_state.api_key, session_id)
                            
                            if status_data.get('status') == 'failed':
                                st.error("❌ Agent video fail hui!")
                                break
                            
                            if status_data.get('video_id'):
                                video_id = status_data['video_id']
                                video_status = check_video_status(st.session_state.api_key, video_id)
                                if video_status.get('status') == 'completed':
                                    st.success("✅ Video ready hai!")
                                    st.video(video_status['video_url'])
                                    break
                                elif video_status.get('status') == 'failed':
                                    st.error("❌ Video render fail hui!")
                                    break
                        else:
                            st.warning("⏳ Timeout - HeyGen dashboard me check karo")
                
                except Exception as e:
                    st.error(f"Error: {str(e)}")
