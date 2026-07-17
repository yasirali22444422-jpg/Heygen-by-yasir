# ============================================================
# app.py - FINAL WORKING (Copy-Paste and Run)
# Avatar upload fixed, video generation working
# ============================================================

import streamlit as st
import requests
import base64
import json
import time
from PIL import Image
import io

# ===== API KEY =====
YOUR_API_KEY = 'sk_V2_hgu_kuujglU11Oe_x9fCykWNbZsKqF0lrDtIy5wqiWCPiwx4'

# ===== SESSION =====
if 'api_key' not in st.session_state:
    st.session_state.api_key = YOUR_API_KEY
if 'talking_photo_id' not in st.session_state:
    st.session_state.talking_photo_id = None
if 'image_key' not in st.session_state:
    st.session_state.image_key = None
if 'avatar_preview' not in st.session_state:
    st.session_state.avatar_preview = None
if 'voice_id' not in st.session_state:
    st.session_state.voice_id = None
if 'voice_name' not in st.session_state:
    st.session_state.voice_name = None

st.set_page_config(page_title="HeyGen Studio", page_icon="🎬", layout="wide")

# ===== FUNCTIONS =====

def compress_image(file_bytes, target_mb=1.5):
    img = Image.open(io.BytesIO(file_bytes))
    if img.mode in ('RGBA', 'LA', 'P'):
        img = img.convert('RGB')
    quality = 85
    while quality > 10:
        buffer = io.BytesIO()
        img.save(buffer, format='JPEG', quality=quality, optimize=True)
        if buffer.tell() < target_mb * 1024 * 1024:
            return buffer.getvalue()
        quality -= 10
    return buffer.getvalue()

def upload_avatar_iii(api_key, file_bytes, file_name):
    # Compress if needed
    if len(file_bytes) > 1.5 * 1024 * 1024:
        file_bytes = compress_image(file_bytes)
    
    url = "https://upload.heygen.com/v1/talking_photo"
    files = {'file': ('avatar.jpg', file_bytes, 'image/jpeg')}
    headers = {'x-api-key': api_key}
    
    r = requests.post(url, headers=headers, files=files)
    data = r.json()
    
    if r.status_code != 200:
        raise Exception(data.get('error', {}).get('message', 'Upload fail'))
    
    return {
        'talking_photo_id': data['data']['talking_photo_id'],
        'preview': data['data']['talking_photo_url']
    }

def upload_avatar_iv(api_key, file_bytes, file_name):
    url = "https://api.heygen.com/v3/assets"
    files = {'file': (file_name, file_bytes, 'image/png')}
    headers = {'x-api-key': api_key}
    
    r = requests.post(url, headers=headers, files=files)
    data = r.json()
    
    if r.status_code != 200:
        raise Exception(data.get('error', {}).get('message', 'Upload fail'))
    
    return {
        'image_key': data['data']['url'].split('/')[-1],
        'preview': data['data']['url']
    }

def generate_video_av4(api_key, image_key, voice_id, script, title):
    payload = {
        'image_key': image_key,
        'video_title': title or 'My Video',
        'script': script,
        'voice_id': voice_id,
        'test': False
    }
    
    r = requests.post(
        'https://api.heygen.com/v2/video/av4/generate',
        headers={'x-api-key': api_key, 'Content-Type': 'application/json'},
        json=payload
    )
    
    data = r.json()
    if r.status_code != 200:
        raise Exception(data.get('error', {}).get('message', 'Generate fail'))
    
    return data['data']['video_id']

def generate_agent_video(api_key, prompt, voice_id, avatar_id):
    payload = {
        'prompt': prompt,
        'voice_id': voice_id,
        'avatar_id': avatar_id,
        'orientation': 'landscape'
    }
    
    r = requests.post(
        'https://api.heygen.com/v3/video-agents',
        headers={'x-api-key': api_key, 'Content-Type': 'application/json'},
        json=payload
    )
    
    data = r.json()
    if r.status_code != 200:
        raise Exception(data.get('error', {}).get('message', 'Agent fail'))
    
    return data['data']['session_id']

def check_status(api_key, video_id):
    r = requests.get(
        f'https://api.heygen.com/v1/video_status.get?video_id={video_id}',
        headers={'x-api-key': api_key}
    )
    return r.json()['data']

# ===== UI =====
st.markdown("""
<style>
    .stButton button { width: 100%; background: linear-gradient(135deg, #7c3aed, #ec4899); color: white; border: none; border-radius: 8px; padding: 10px; font-weight: bold; }
    .stButton button:hover { transform: scale(1.02); }
</style>
""", unsafe_allow_html=True)

st.title("🎬 HeyGen Studio")

# ===== TABS =====
t1, t2, t3, t4 = st.tabs(["🔑 Settings", "👤 Avatar", "🎤 Voice", "🎬 Video"])

with t1:
    st.success("✅ API Key Auto-Set")
    st.info("Unlimited Access Active")

with t2:
    col1, col2 = st.columns([1, 1])
    
    with col1:
        engine = st.radio("Engine:", ["Avatar III (Agent)", "Avatar IV (Script)"], index=1)
        file = st.file_uploader("Photo", type=['png', 'jpg', 'jpeg'])
        
        if file and st.button("📤 Upload"):
            with st.spinner("Uploading..."):
                try:
                    bytes_data = file.read()
                    
                    if "Avatar III" in engine:
                        result = upload_avatar_iii(st.session_state.api_key, bytes_data, file.name)
                        st.session_state.talking_photo_id = result['talking_photo_id']
                        st.session_state.avatar_preview = result['preview']
                        st.success("✅ Avatar III Ready!")
                    else:
                        result = upload_avatar_iv(st.session_state.api_key, bytes_data, file.name)
                        st.session_state.image_key = result['image_key']
                        st.session_state.avatar_preview = result['preview']
                        st.success("✅ Avatar IV Ready!")
                    
                    st.rerun()
                except Exception as e:
                    st.error(f"Error: {e}")
    
    with col2:
        if st.session_state.avatar_preview:
            st.image(st.session_state.avatar_preview, use_column_width=True)
            if st.session_state.talking_photo_id:
                st.success("Avatar III Ready")
            if st.session_state.image_key:
                st.success("Avatar IV Ready")

with t3:
    if st.button("🎤 Load Voices"):
        r = requests.get('https://api.heygen.com/v3/voices', headers={'x-api-key': st.session_state.api_key})
        voices = r.json()['data']['voices']
        st.session_state._voices = voices
        st.success(f"{len(voices)} voices loaded")
    
    if st.session_state.get('_voices'):
        for v in st.session_state._voices[:20]:
            c1, c2, c3 = st.columns([3, 1, 1])
            with c1:
                st.write(v.get('name', v['voice_id']))
            with c3:
                if st.button("Select", key=f"sel_{v['voice_id']}"):
                    st.session_state.voice_id = v['voice_id']
                    st.session_state.voice_name = v.get('name', v['voice_id'])
                    st.success(f"✅ {v.get('name', 'Voice')} selected!")
                    st.rerun()

with t4:
    # Show current avatar/voice
    avatar_status = "✅ Avatar IV Ready" if st.session_state.image_key else "✅ Avatar III Ready" if st.session_state.talking_photo_id else "❌ Upload Avatar"
    voice_status = f"✅ {st.session_state.voice_name}" if st.session_state.voice_id else "❌ Select Voice"
    
    st.markdown(f"""
    <div style="background:#1c1c26;padding:10px;border-radius:8px;margin:10px 0;">
        <div>👤 Avatar: {avatar_status}</div>
        <div>🎤 Voice: {voice_status}</div>
    </div>
    """, unsafe_allow_html=True)
    
    # Script Video (Avatar IV)
    if st.session_state.image_key:
        st.markdown("### ✍️ Script Se Video (Avatar IV)")
        script = st.text_area("Script (max 5000 chars)", height=100)
        title = st.text_input("Title")
        
        if st.button("🎬 Generate Video", use_container_width=True):
            if not st.session_state.image_key:
                st.error("Upload Avatar IV first!")
            elif not st.session_state.voice_id:
                st.error("Select Voice first!")
            elif not script:
                st.error("Write script!")
            elif len(script) > 5000:
                st.error("Script too long!")
            else:
                with st.spinner("Generating..."):
                    try:
                        vid = generate_video_av4(
                            st.session_state.api_key,
                            st.session_state.image_key,
                            st.session_state.voice_id,
                            script,
                            title
                        )
                        st.success(f"Video ID: {vid}")
                        
                        with st.spinner("Rendering (1-3 min)..."):
                            for _ in range(30):
                                time.sleep(10)
                                status = check_status(st.session_state.api_key, vid)
                                if status.get('status') == 'completed':
                                    st.success("✅ Video Ready!")
                                    st.video(status['video_url'])
                                    break
                                elif status.get('status') == 'failed':
                                    st.error("Video failed!")
                                    break
                    except Exception as e:
                        st.error(f"Error: {e}")
    
    # Agent Video (Avatar III)
    if st.session_state.talking_photo_id:
        st.markdown("---")
        st.markdown("### 🤖 Agent Video (Avatar III)")
        prompt = st.text_area("Topic/Prompt", height=80)
        
        if st.button("🤖 Generate Agent Video", use_container_width=True):
            if not st.session_state.talking_photo_id:
                st.error("Upload Avatar III first!")
            elif not st.session_state.voice_id:
                st.error("Select Voice first!")
            elif not prompt:
                st.error("Write prompt!")
            else:
                with st.spinner("Generating Agent Video..."):
                    try:
                        session = generate_agent_video(
                            st.session_state.api_key,
                            prompt,
                            st.session_state.voice_id,
                            st.session_state.talking_photo_id
                        )
                        st.success(f"Session: {session}")
                        
                        with st.spinner("Rendering (2-3 min)..."):
                            for _ in range(40):
                                time.sleep(10)
                                r = requests.get(
                                    f'https://api.heygen.com/v3/video-agents/{session}',
                                    headers={'x-api-key': st.session_state.api_key}
                                )
                                data = r.json()['data']
                                
                                if data.get('video_id'):
                                    vid = data['video_id']
                                    status = check_status(st.session_state.api_key, vid)
                                    if status.get('status') == 'completed':
                                        st.success("✅ Video Ready!")
                                        st.video(status['video_url'])
                                        break
                    except Exception as e:
                        st.error(f"Error: {e}")
