# HeyGen Avatar & Voice Studio (Chrome Extension)

## Install Kaise Karein
1. `chrome://extensions` khol lo
2. Top-right me **Developer mode** ON karo
3. **Load unpacked** par click karo
4. Ye `heygen-extension` folder select karo
5. Extension icon toolbar me aa jayega

## Use Kaise Karein
Ab is extension me sirf ek hi tareeke se video banti hai — **Agent** ("Video Banao" tab) se, hamesha tumhare apne Avatar aur select ki hui Voice ke saath. Koi alag "Generate" tab nahi hai.

1. **Password tab** — HeyGen Dashboard → Settings → API se apni key copy karke paste karo, Save karo
2. **Avatar tab** — ya to apna clear, front-facing photo upload karo, ya "Avatar List" sub-tab se HeyGen ke ready-made avatars me se ek select karo
3. **Voice tab** — "Voice List" sub-tab se "Voices Load Karo" dabao (poori list, search bhi kar sakte ho), ek voice select karo. Chaho to "Voice ID" ya "Clone" sub-tab bhi use kar sakte ho.
4. **Video Banao tab** — upar summary me dikhega Avatar aur Voice select hain ya nahi (✅/❌). Dono select hone ke baad prompt likho (video kis baare me ho) aur "Video Banao" click karo. Agent tumhare avatar/voice ke saath poora video banayega — 1-3 minute me ready ho jayegi.

## Technical Notes
- Manifest V3, plain HTML/CSS/JS — koi build step nahi chahiye
- API key `chrome.storage.local` me save hoti hai (sirf tumhare browser me)
- Endpoints use kiye gaye:
  - `POST /v3/assets` — photo upload
  - `POST /v3/voices/clone` — voice clone (optional path)
  - `POST /v2/video/av4/generate` — Avatar IV video generation
  - `GET /v1/video_status.get` — status polling
- Agar `/v3/voices/clone` fail ho, HeyGen website se clone karke Voice ID manually paste karo
