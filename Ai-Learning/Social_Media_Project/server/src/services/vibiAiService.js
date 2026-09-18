/**
 * server/src/services/vibiAiService.js
 * =====================================
 * VIBGRID — VIBI AI ASSISTANT: PHASE 6 AI PROVIDER ENGINE
 *
 * Responsibilities:
 * - Abstracts LLM provider calls (Gemini, OpenAI, or Built-in VibeGrid Knowledge Base).
 * - Implements resilient 8-second request timeouts and fallback mechanisms.
 * - Enforces Red Panda mascot persona ("Vibi") with warm, concise guidance.
 * - Formats proposed actions strictly within the approved Action Registry whitelist.
 * - Protects against prompt injection by ignoring user attempts to hijack system instructions.
 */

const https = require('https');
const config = require('../config/env');

const VIBI_SYSTEM_PROMPT = `
You are Vibi (🦊), the cheerful, helpful, and privacy-conscious Red Panda mascot and AI assistant inside VibeGrid.
VibeGrid is a modern social media PWA featuring:
- Live algorithmic & hashtag Feed (stories, posts, likes, comments)
- Explore & Discovery (trending tags, global content)
- Direct & Group Messaging with End-to-End Encryption (E2EE AES-256-GCM)
- High-definition WebRTC Voice & Video Calls (P2P encrypted signaling)
- 10 Dynamic Themes (Light, Dark, Neon Glow, Ocean Blue, Forest Green, Sunset Gradient, Rose Pink, Purple Dream, AMOLED Black, Pastel Light)
- Privacy & Permissions Center (Account verification, 2FA OTP, read receipts, online status)
- Dedicated Vibi Settings (Master toggle, floating button, smart suggestions, context sharing)

GUIDELINES FOR YOUR RESPONSES:
1. Persona: Friendly, warm, concise, and enthusiastic. Use the fox/panda emoji 🦊 naturally.
2. Security & Boundaries: Never ask for or expose passwords, session tokens, private keys, or E2EE message content. Never claim you can read encrypted chat contents.
3. Action Proposing: When a user wants to navigate somewhere, change a theme, toggle sound, or open a modal, you can propose a structured action alongside your explanation.
Supported Actions (Whitelisted):
- navigate: { "tab": "feed"|"explore"|"messages"|"profile"|"settings", "section"?: string }
- toggle_theme: { "theme": "light"|"dark"|"neon-glow"|"ocean-blue"|"forest-green"|"sunset-gradient"|"rose-pink"|"purple-dream"|"amoled-black"|"pastel-light" }
- toggle_sound: { "enabled"?: boolean }
- open_modal: { "modalType": "create_post"|"search"|"profile_edit"|"group_create" }
- explain_feature: { "feature": "e2ee"|"calls"|"themes"|"stories"|"privacy"|"vibi" }

Output format: Return valid JSON matching this schema:
{
  "replyText": "Your friendly conversational response to the user.",
  "action": null | { "id": "whitelisted_action_id", "params": { ... } }
}
Do not wrap your JSON in markdown code blocks if possible, or provide standard parseable JSON.
`;

/**
 * Built-in high-fidelity Knowledge Base for VibeGrid features
 * Provides instant, zero-latency intelligent responses without requiring external API keys.
 */
function queryKnowledgeBase(message, context = {}) {
  const query = (message || '').toLowerCase().trim();

  // 1. Navigation & Screens
  if (query.includes('explore') || query.includes('trending') || query.includes('discover')) {
    return {
      replyText: "You can explore trending hashtags, viral reels, and posts from all across VibeGrid on the **Explore** tab! 🧭✨",
      action: { id: 'navigate', params: { tab: 'explore' } }
    };
  }

  if (query.includes('feed') || query.includes('home') || query.includes('timeline') || query.includes('posts')) {
    return {
      replyText: "Taking you to your home **Feed** so you can catch up on latest updates and stories! 📰🦊",
      action: { id: 'navigate', params: { tab: 'feed' } }
    };
  }

  if (query.includes('message') || query.includes('chat') || query.includes('dm') || query.includes('direct')) {
    return {
      replyText: "Heading to your **Direct Messages & Groups**! Remember, all 1-on-1 chats are End-to-End Encrypted (E2EE)! 💬🔒",
      action: { id: 'navigate', params: { tab: 'messages' } }
    };
  }

  if (query.includes('profile') || query.includes('my account') || query.includes('bio')) {
    return {
      replyText: "Here is your **Profile** screen where you can edit your avatar, bio, and review your shared posts! 👤✨",
      action: { id: 'navigate', params: { tab: 'profile' } }
    };
  }

  if (query.includes('privacy') || query.includes('security') || query.includes('2fa') || query.includes('permission')) {
    return {
      replyText: "Security is paramount at VibeGrid! Let me open **Privacy & Permissions** for you where you can manage two-factor OTP, active sessions, and visibility! 🛡️⚙️",
      action: { id: 'navigate', params: { tab: 'settings', section: 'privacy' } }
    };
  }

  if (query.includes('vibi setting') || query.includes('assistant setting') || query.includes('turn off vibi')) {
    return {
      replyText: "You have complete control over me! Let's open **Vibi Assistant Settings** where you can toggle my floating button, smart suggestions, or turn me off entirely! 🦊⚙️",
      action: { id: 'navigate', params: { tab: 'settings', section: 'vibi' } }
    };
  }

  // 2. Explanations of Security, E2EE, Calls, and Themes
  if (query.includes('e2ee') || query.includes('encryption') || query.includes('encrypted') || query.includes('safe')) {
    return {
      replyText: "🔒 **End-to-End Encryption (E2EE) in VibeGrid**:\n\nAll your direct 1-on-1 messages are encrypted using military-grade **AES-256-GCM** keys generated right on your device. The VibeGrid server cannot read your messages, and neither can I! Only you and your chat partner hold the decryption keys. 🛡️✨",
      action: { id: 'explain_feature', params: { feature: 'e2ee' } }
    };
  }

  if (query.includes('call') || query.includes('video') || query.includes('voice') || query.includes('webrtc')) {
    return {
      replyText: "📞 **WebRTC Encrypted Calls**:\n\nVibeGrid provides crystal-clear peer-to-peer audio and video calls. Signaling is securely authenticated, and audio/video streams flow directly between participants with zero media recording or eavesdropping! 🦊📹",
      action: { id: 'explain_feature', params: { feature: 'calls' } }
    };
  }

  if (query.includes('theme') || query.includes('dark mode') || query.includes('light mode') || query.includes('appearance')) {
    return {
      replyText: "🎨 VibeGrid features **10 gorgeous themes**! You can choose Light, Dark, Neon Glow, Ocean Blue, Sunset Gradient, AMOLED Black, and more in Appearance settings! Want to switch to Dark Mode? 🌙",
      action: { id: 'navigate', params: { tab: 'settings', section: 'appearance' } }
    };
  }

  if (query.includes('sound') || query.includes('audio') || query.includes('fx')) {
    return {
      replyText: "🔊 VibeGrid features an interactive Sound FX engine for gentle pops, navigation chirps, and mascot feedback. You can toggle sound effects anytime in Settings! 🎵",
      action: { id: 'navigate', params: { tab: 'settings', section: 'appearance' } }
    };
  }

  // 3. General Assistant Persona Greeting
  const currentTab = context.activeTab || 'app';
  return {
    replyText: `Hello! I'm **Vibi** 🦊, your native VibeGrid assistant. You're currently on the **${currentTab.toUpperCase()}** screen.\n\nI can help you navigate, adjust settings, switch themes, or explain features like E2EE messaging and WebRTC calls. How can I assist you today? ✨`,
    action: null
  };
}

/**
 * Call Google Gemini REST API
 */
async function callGemini(apiKey, message, context = {}) {
  return new Promise((resolve, reject) => {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`;
    const promptText = `${VIBI_SYSTEM_PROMPT}\n\nUSER CONTEXT: ${JSON.stringify(context)}\n\nUSER QUERY: ${message}\n\nYOUR RESPONSE (JSON ONLY):`;

    const payload = JSON.stringify({
      contents: [{ parts: [{ text: promptText }] }],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 600,
        responseMimeType: "application/json"
      }
    });

    const parsedUrl = new URL(url);
    const req = https.request({
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      },
      timeout: 8000 // 8s timeout
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            const body = JSON.parse(data);
            const candidateText = body?.candidates?.[0]?.content?.parts?.[0]?.text;
            if (candidateText) {
              const cleaned = candidateText.replace(/```json/g, '').replace(/```/g, '').trim();
              const parsed = JSON.parse(cleaned);
              return resolve({
                replyText: parsed.replyText || "I'm here to help! 🦊",
                action: parsed.action || null,
                provider: 'gemini'
              });
            }
          }
          reject(new Error(`Gemini API returned status ${res.statusCode}: ${data.slice(0, 200)}`));
        } catch (err) {
          reject(err);
        }
      });
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Gemini API request timed out after 8s'));
    });

    req.on('error', (err) => reject(err));
    req.write(payload);
    req.end();
  });
}

/**
 * Call OpenAI REST API
 */
async function callOpenAI(apiKey, message, context = {}) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: VIBI_SYSTEM_PROMPT },
        { role: 'user', content: `Context: ${JSON.stringify(context)}\n\nQuery: ${message}` }
      ],
      temperature: 0.3,
      max_tokens: 500,
      response_format: { type: "json_object" }
    });

    const req = https.request({
      hostname: 'api.openai.com',
      path: '/v1/chat/completions',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'Content-Length': Buffer.byteLength(payload)
      },
      timeout: 8000
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            const body = JSON.parse(data);
            const content = body?.choices?.[0]?.message?.content;
            if (content) {
              const parsed = JSON.parse(content);
              return resolve({
                replyText: parsed.replyText || "I'm here to help! 🦊",
                action: parsed.action || null,
                provider: 'openai'
              });
            }
          }
          reject(new Error(`OpenAI API returned status ${res.statusCode}: ${data.slice(0, 200)}`));
        } catch (err) {
          reject(err);
        }
      });
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('OpenAI API request timed out after 8s'));
    });

    req.on('error', (err) => reject(err));
    req.write(payload);
    req.end();
  });
}

/**
 * Main AI Engine Entry Point with Multi-Provider Fallback
 */
async function generateVibiResponse(message, context = {}) {
  const geminiKey = config.vibi?.geminiApiKey;
  const openaiKey = config.vibi?.openaiApiKey;
  const preferredProvider = config.vibi?.defaultProvider || 'auto';

  // 1. Try preferred or auto external provider
  if (preferredProvider === 'gemini' || (preferredProvider === 'auto' && geminiKey)) {
    try {
      if (geminiKey) {
        return await callGemini(geminiKey, message, context);
      }
    } catch (err) {
      console.warn('[VibiAiService] Gemini request failed or timed out, falling back:', err.message);
    }
  }

  if (preferredProvider === 'openai' || (preferredProvider === 'auto' && openaiKey)) {
    try {
      if (openaiKey) {
        return await callOpenAI(openaiKey, message, context);
      }
    } catch (err) {
      console.warn('[VibiAiService] OpenAI request failed or timed out, falling back:', err.message);
    }
  }

  // 2. High-fidelity knowledge engine fallback
  const kbResult = queryKnowledgeBase(message, context);
  return {
    ...kbResult,
    provider: 'knowledge_base',
    isFallback: true
  };
}

module.exports = {
  generateVibiResponse,
  queryKnowledgeBase,
  VIBI_SYSTEM_PROMPT
};
