// ============================================================
// ACCESS GATE - COMPLETELY REMOVED
// TEAM UNLIMITED ACCESS
// ============================================================

// ⚠️ IMPORTANT: Yahan apni REAL HeyGen API Key dalo
// HeyGen Dashboard → Settings → API se copy karo
const YOUR_REAL_HEYGEN_API_KEY = 'sk_V2_hgu_kuujglU11Oe_x9fCykWNbZsKqF0lrDtIy5wqiWCPiwx4';

// ===== AUTO SETUP =====
(async function() {
    // Key save karo
    await chrome.storage.local.set({
        heygenApiKey: YOUR_REAL_HEYGEN_API_KEY,
        apiKey: YOUR_REAL_HEYGEN_API_KEY,
        userKey: YOUR_REAL_HEYGEN_API_KEY,
        isPremium: true,
        isValid: true,
        accessGranted: true,
        plan: 'unlimited',
        teamAccess: true
    });

    console.log('✅ API Key Set!');
    console.log('🔑 Key:', YOUR_REAL_HEYGEN_API_KEY);

    // Overlay hatao agar hai toh
    const overlay = document.getElementById('gateOverlay');
    if (overlay) {
        overlay.remove();
    }

    // Styles hatao
    const styles = document.querySelectorAll('style');
    styles.forEach(style => {
        if (style.textContent.includes('gateOverlay') || style.textContent.includes('gate-')) {
            style.remove();
        }
    });

    // API key field auto-fill
    const apiKeyEl = document.getElementById('apiKey');
    if (apiKeyEl) {
        apiKeyEl.value = YOUR_REAL_HEYGEN_API_KEY;
        apiKeyEl.style.background = '#1a1a2e';
        apiKeyEl.style.color = '#4ade80';
        apiKeyEl.style.fontWeight = 'bold';
        apiKeyEl.style.textAlign = 'center';
        apiKeyEl.style.fontSize = '14px';
        apiKeyEl.style.border = '2px solid #4ade80';
        apiKeyEl.style.borderRadius = '8px';
        apiKeyEl.style.padding = '10px';
        apiKeyEl.readOnly = true;
    }

    // Status update
    const keyStatusEl = document.getElementById('keyStatus');
    if (keyStatusEl) {
        keyStatusEl.textContent = '✅ API Key Auto-Set! Unlimited Access!';
        keyStatusEl.style.color = '#4ade80';
        keyStatusEl.style.fontWeight = 'bold';
        keyStatusEl.style.fontSize = '14px';
    }

    // Save button hide
    const saveBtn = document.getElementById('saveKeyBtn');
    if (saveBtn) {
        saveBtn.style.display = 'none';
    }

    document.body.style.display = 'block';
})();

console.log('✅✅✅ GATE REMOVED - TEAM UNLIMITED ACCESS! ✅✅✅');
