# ============================================================
# app.py - HeyGen Studio (Streamlit Cloud Version)
# Sirf ye ek file deploy karo!
# ============================================================

import streamlit as st
import requests
import base64
import json
import time
from datetime import datetime

# ===== AUTO API KEY =====
YOUR_REAL_HEYGEN_API_KEY = 'sk_V2_hgu_kuujglU11Oe_x9fCykWNbZsKqF0lrDtIy5wqiWCPiwx4'

# ===== SESSION STATE =====
if 'api_key' not in st.session_state:
    st.session_state.api_key = YOUR_REAL_HEYGEN_API_KEY
if 'talking_photo_id' not in st.session_state:
    st.session_state.talking_photo_id = None
if 'avatar_preview_url' not in st.session_state:
    st.session_state.avatar_preview_url = None
if 'voice_id' not in st.session_state:
    st.session_state.voice_id = None
if 'voice_name' not in st.session_state:
    st.session_state.voice_name = None
if 'avatar_engine' not in st.session_state:
    st.session_state.avatar_engine = 'avatar_iii'
if 'video_history' not in st.session_state:
    st.session_state.video_history = []
if '_voices' not in st.session_state:
    st.session_state._voices = []
if '_avatars' not in st.session_state:
    st.session_state._avatars = []

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
    .voice-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        background: #1c1c26;
        border: 1px solid #2c2c3a;
        border-radius: 8px;
        padding: 10px 12px;
        margin: 4px 0;
    }
    .avatar-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
        gap: 10px;
        margin: 10px 0;
    }
    .avatar-card {
        background: #1c1c26;
        border: 2px solid #2c2c3a;
        border-radius: 8px;
        padding: 8px;
        text-align: center;
    }
    .avatar-card img {
        width: 100%;
        aspect-ratio: 3/4;
        object-fit: cover;
        border-radius: 4px;
    }
    .avatar-card .avatar-name {
        font-size: 11px;
        color: #eaeaf0;
        margin-top: 4px;
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

def upload_avatar(api_key, base64_data, mime_type, file_name, engine="avatar_iii"):
    if ',' in base64_data:
        base64_data = base64_data.split(',')[1]
    blob = base64.b64decode(base64_data)
    
    if engine == "avatar_iii":
        url = "https://upload.heygen.com/v1/talking_photo"
        files = {'file': (file_name, blob, mime_type)}
        headers = {'x-api-key': api_key}
        response = requests.post(url, headers=headers, files=files)
        data = response.json()
        
        if response.status_code != 200 or data.get('error'):
            raise Exception(data.get('error', {}).get('message', f'Upload fail hua (HTTP {response.status_code})'))
        
        return {
            "talking_photo_id": data['data']['talking_photo_id'],
            "preview_url": data['data']['talking_photo_url']
        }
    else:
        url = "https://api.heygen.com/v3/assets"
        files = {'file': (file_name, blob, mime_type)}
        headers = {'x-api-key': api_key}
        response = requests.post(url, headers=headers, files=files)
        data = response.json()
        
        if response.status_code != 200 or data.get('error'):
            raise Exception(data.get('error', {}).get('message', f'Upload fail hua (HTTP {response.status_code})'))
        
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
        raise Exception(data.get('error', {}).get('message', f'Voices load nahi hui (HTTP {response.status_code})'))
    return data['data'] if isinstance(data['data'], list) else data['data'].get('voices', [])

def list_avatars(api_key):
    response = requests.get(
        "https://api.heygen.com/v2/avatars",
        headers={"x-api-key": api_key}
    )
    data = response.json()
    if response.status_code != 200 or data.get('error'):
        raise Exception(data.get('error', {}).get('message', f'Avatars load nahi hue (HTTP {response.status_code})'))
    return data['data']['avatars']

def split_script(script, max_len=4900):
    if len(script) <= max_len:
        return [script]
    chunks = []
    remaining = script
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
    return chunks

def generate_video(api_key, talking_photo_id, voice_id, script, title, orientation="landscape"):
    chunks = split_script(script, 4900)
    dimension = {"width": 1280, "height": 720} if orientation == "landscape" else {"width": 720, "height": 1280}
    
    video_inputs = []
    for chunk in chunks:
        video_inputs.append({
            "character": {"type": "talking_photo", "talking_photo_id": talking_photo_id, "talking_photo_style": "square"},
            "voice": {"type": "text", "input_text": chunk, "voice_id": voice_id}
        })
    
    payload = {"video_inputs": video_inputs, "dimension": dimension, "title": title or "Render Scene"}
    
    response = requests.post(
        "https://api.heygen.com/v2/video/generate",
        headers={"x-api-key": api_key, "Content-Type": "application/json"},
        json=payload
    )
    data = response.json()
    if response.status_code != 200 or data.get('error'):
        raise Exception(data.get('error', {}).get('message', f'Render fail hui (HTTP {response.status_code})'))
    return data['data']['video_id']

def check_video_status(api_key, video_id):
    response = requests.get(
        f"https://api.heygen.com/v1/video_status.get?video_id={video_id}",
        headers={"x-api-key": api_key}
    )
    data = response.json()
    if response.status_code != 200 or data.get('error'):
        raise Exception(data.get('error', {}).get('message', f'Status check fail hui (HTTP {response.status_code})'))
    return data['data']

def generate_agent_video(api_key, prompt, voice_id, avatar_id, orientation="landscape"):
    payload = {"prompt": prompt, "orientation": orientation}
    if voice_id: payload["voice_id"] = voice_id
    if avatar_id: payload["avatar_id"] = avatar_id
    
    response = requests.post(
        "https://api.heygen.com/v3/video-agents",
        headers={"x-api-key": api_key, "Content-Type": "application/json"},
        json=payload
    )
    data = response.json()
    if response.status_code != 200 or data.get('error'):
        raise Exception(data.get('error', {}).get('message', f'Agent request fail hui (HTTP {response.status_code})'))
    return data['data']['session_id']

def check_agent_status(api_key, session_id):
    response = requests.get(
        f"https://api.heygen.com/v3/video-agents/{session_id}",
        headers={"x-api-key": api_key}
    )
    data = response.json()
    if response.status_code != 200 or data.get('error'):
        raise Exception(data.get('error', {}).get('message', f'Session check fail hui (HTTP {response.status_code})'))
    return data['data']

# ===== TABS =====
tab1, tab2, tab3, tab4 = st.tabs(["🔑 Settings", "👤 Avatar", "🎤 Voice", "🎬 Video Banao"])

# ===== TAB 1: SETTINGS =====
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
        avatar_file = st.file_uploader("Photo select karo (clear, front-facing)", type=['png', 'jpg', 'jpeg'])
        
        engine = st.radio("Engine:", ["avatar_iii (Recommended)", "avatar_iv"], index=0)
        st.session_state.avatar_engine = "avatar_iii" if "avatar_iii" in engine else "avatar_iv"
        
        if avatar_file and st.button("📤 Upload & Save Avatar", use_container_width=True):
            with st.spinner("Upload ho raha hai..."):
                try:
                    file_bytes = avatar_file.read()
                    base64_data = base64.b64encode(file_bytes).decode('utf-8')
                    
                    result = upload_avatar(
                        st.session_state.api_key,
                        base64_data,
                        avatar_file.type,
                        avatar_file.name,
                        st.session_state.avatar_engine
                    )
                    
                    if st.session_state.avatar_engine == "avatar_iii":
                        st.session_state.talking_photo_id = result['talking_photo_id']
                    else:
                        st.session_state.avatar_id = result['image_key']
                    
                    st.session_state.avatar_preview_url = result['preview_url']
                    st.success(f"✅ Avatar save ho gaya!")
                    st.rerun()
                    
                except Exception as e:
                    st.error(f"❌ Error: {str(e)}")
    
    with col2:
        if st.session_state.avatar_preview_url:
            st.image(st.session_state.avatar_preview_url, caption="Your Avatar", use_container_width=True)
            if st.session_state.talking_photo_id:
                st.success(f"✅ Avatar III Ready")
        else:
            st.info("👆 Photo upload karo")
    
    # Avatar List
    st.markdown("---")
    st.markdown("### 🎭 HeyGen Avatars")
    
    if st.button("📋 Avatars Load Karo", use_container_width=True):
        with st.spinner("Loading avatars..."):
            try:
                avatars = list_avatars(st.session_state.api_key)
                st.session_state._avatars = avatars
                st.success(f"{len(avatars)} avatars mile!")
            except Exception as e:
                st.error(f"Error: {str(e)}")
    
    if st.session_state._avatars:
        cols = st.columns(4)
        for i, av in enumerate(st.session_state._avatars[:8]):
            col = cols[i % 4]
            with col:
                st.markdown(f"""
                <div class="avatar-card">
                    <img src="{av.get('preview_image_url', '')}" alt="{av.get('avatar_name', 'Avatar')}">
                    <span class="avatar-name">{av.get('avatar_name', av.get('avatar_id', 'Avatar'))}</span>
                </div>
                """, unsafe_allow_html=True)

# ===== TAB 3: VOICE =====
with tab3:
    st.markdown("### 🎤 Voice Select Karo")
    
    tab_v1, tab_v2, tab_v3 = st.tabs(["📋 Voice List", "🔑 Voice ID", "🧬 Clone"])
    
    with tab_v1:
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
    
    with tab_v2:
        voice_id_input = st.text_input("Voice ID paste karo", placeholder="jaise: 1bd001e7e50f421d891986aad5c8bbd2")
        if st.button("💾 Save Voice ID", use_container_width=True):
            if voice_id_input:
                st.session_state.voice_id = voice_id_input
                st.success("✅ Voice ID save ho gaya!")
            else:
                st.warning("Voice ID daalo!")

# ===== TAB 4: VIDEO =====
with tab4:
    st.markdown("### 🎬 Video Banao")
    
    # Summary
    avatar_ready = bool(st.session_state.talking_photo_id)
    voice_ready = bool(st.session_state.voice_id)
    
    st.markdown(f"""
    <div class="summary-box">
        <div class="row">
            <span class="label">👤 Avatar:</span>
            <span class="value {'ready' if avatar_ready else 'missing'}">
                {'✅ ' + st.session_state.avatar_engine.upper() + ' ready' if avatar_ready else '❌ Avatar tab se photo upload karo'}
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
    
    tab_vid1, tab_vid2 = st.tabs(["✍️ Script Se", "🤖 Topic Se"])
    
    with tab_vid1:
        script = st.text_area("Script likho", placeholder="Yahan exact text likho jo avatar bolega...", height=150)
        col1, col2 = st.columns([1, 1])
        with col1:
            orientation = st.selectbox("Orientation", ["landscape", "portrait"], index=0)
        with col2:
            title = st.text_input("Video Title (optional)", placeholder="Video ka naam")
        
        if st.button("🎬 Render Karo", use_container_width=True):
            if not st.session_state.talking_photo_id:
                st.error("❌ Pehle Avatar tab se photo upload karo!")
            elif not st.session_state.voice_id:
                st.error("❌ Pehle Voice tab se voice select karo!")
            elif not script:
                st.error("❌ Script likho!")
            else:
                with st.spinner("Video render ho rahi hai..."):
                    try:
                        video_id = generate_video(
                            st.session_state.api_key,
                            st.session_state.talking_photo_id,
                            st.session_state.voice_id,
                            script,
                            title,
                            orientation
                        )
                        st.success(f"✅ Video generate ho rahi hai! ID: {video_id}")
                        
                        # Poll for status
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
                    except Exception as e:
                        st.error(f"Error: {str(e)}")
    
    with tab_vid2:
        prompt = st.text_area("Topic / Prompt", placeholder="Jaise: 'Collagen ke fayde...'", height=100)
        col1, col2 = st.columns([1, 1])
        with col1:
            agent_orientation = st.selectbox("Orientation", ["landscape", "portrait"], index=0, key="agent_ori")
        with col2:
            agent_title = st.text_input("Video Title (optional)", placeholder="Video ka naam", key="agent_title")
        
        if st.button("🤖 Agent Video Banao", use_container_width=True):
            if not st.session_state.talking_photo_id:
                st.error("❌ Pehle Avatar tab se photo upload karo!")
            elif not st.session_state.voice_id:
                st.error("❌ Pehle Voice tab se voice select karo!")
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
                    except Exception as e:
                        st.error(f"Error: {str(e)}")
