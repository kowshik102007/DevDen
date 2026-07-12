import { FilesetResolver, FaceLandmarker } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.8/vision_bundle.mjs";
import { scoreSession, CONFIG } from "./scoring.js";
import { loadFerModel, inferFrame, computeTensionProxy, isFerReady } from "./fer.js";

// Boot Pendo SDK with an anonymous visitor.
// The SDK resolves visitor from cookies/localStorage if available,
// otherwise falls back to a new anonymous visitor.
pendo.initialize({ visitor: { id: '' } });

// ==========================================
// 1. API CONFIGURATION & AUTO-DISCOVERY
// ==========================================
// Gemini key lives server-side in the Edge Function — never in client code
const PROXY_URL = 'https://zzaqawcpqdbdymcugcfy.supabase.co/functions/v1/gemini-proxy';
let activeResolvedModel = null;
let availableGeminiModels = null;

const supabaseUrl = 'https://zzaqawcpqdbdymcugcfy.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp6YXFhd2NwcWRiZHltY3VnY2Z5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEzNTc3NDQsImV4cCI6MjA5NjkzMzc0NH0.x2rQxZkOV8JicI3ElDjE6vpzmgqu78_VqtdTlPv88hU';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

// ── Piper TTS Service (Railway) ─────────────────────────
// After deploying piper-tts-service on Railway:
//   1. Set PIPER_TTS_URL to your Railway URL
//   2. Create a service key with: POST /admin/keys (using your admin key)
//   3. Paste that service key below — it can ONLY call TTS, not manage keys
const PIPER_TTS_URL = 'https://YOUR-RAILWAY-SERVICE.up.railway.app';
const PIPER_TTS_KEY = 'ntts_YOUR_SERVICE_KEY_HERE';
let _currentTtsAudio = null;

function cancelPiperAudio() {
    if (_currentTtsAudio) {
        _currentTtsAudio.pause();
        _currentTtsAudio.src = '';
        _currentTtsAudio = null;
    }
    window.speechSynthesis.cancel();
}

let currentUser = null;
let intelligenceProfile = null;
const AI_DAILY_LIMIT = 15;
const GEMINI_MODEL_COOLDOWN_MS = 60 * 60 * 1000;
const GEMINI_REQUEST_TIMEOUT_MS = 25000;

function getTodayKey() {
    return new Date().toLocaleDateString('en-CA');
}

function getAiUsageKey() {
    const userKey = currentUser?.id || currentUser?.email || 'guest';
    return `novus-ai-usage-${userKey}`;
}

function getUserStorageKey(suffix) {
    const userKey = currentUser?.id || currentUser?.email || 'guest';
    return `novus-${suffix}-${userKey}`;
}

function getAiUsageState() {
    const today = getTodayKey();
    const saved = JSON.parse(localStorage.getItem(getAiUsageKey()) || '{}');
    if (saved.date !== today) return { date: today, count: 0 };
    return { date: today, count: Number(saved.count) || 0 };
}

function getNextAiResetText() {
    const tomorrow = new Date();
    tomorrow.setHours(24, 0, 0, 0);
    return tomorrow.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function ensureAiQuotaAvailable() {
    const usage = getAiUsageState();
    if (usage.count >= AI_DAILY_LIMIT) {
        throw new Error(`Daily AI limit reached (${AI_DAILY_LIMIT}/${AI_DAILY_LIMIT}). Your AI access refreshes tomorrow at ${getNextAiResetText()}.`);
    }
}

function recordAiUsage() {
    const usage = getAiUsageState();
    const updatedUsage = { date: usage.date, count: usage.count + 1 };
    localStorage.setItem(getAiUsageKey(), JSON.stringify(updatedUsage));
    updateAiUsageDisplay();
    return updatedUsage;
}

function updateAiUsageDisplay() {
    const usageText = document.getElementById('aiUsageText');
    if (!usageText) return;

    const usage = getAiUsageState();
    usageText.textContent = `AI usage today: ${usage.count}/${AI_DAILY_LIMIT}. Refreshes tomorrow at ${getNextAiResetText()}.`;
}

async function discoverGeminiModels() {
    if (availableGeminiModels) return availableGeminiModels;

    console.log("Auto-discovering supported Gemini models via proxy...");

        let listData;
        try {
            const listRes = await fetch(PROXY_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${supabaseKey}`,
                    'apikey': supabaseKey
                },
                body: JSON.stringify({ action: 'discover_models' })
            });
            listData = await listRes.json();
        } catch (err) {
            console.warn("Network/CORS error during model discovery:", err.message);
            listData = { error: true };
        }

    // If placeholder key is rejected, fall back to a known-good model list
    let modelNames;
    if (listData.error) {
        console.warn("Model list fetch failed, using default fallback order.");
        modelNames = [
            { name: "models/gemini-1.5-pro" },
            { name: "models/gemini-1.5-flash" },
            { name: "models/gemini-1.0-pro" },
        ];
    } else {
        modelNames = listData.models.filter(m => {
            const name = m.name.toLowerCase();
            const supportsTextGeneration = m.supportedGenerationMethods?.includes("generateContent");
            const isGeminiTextModel = name.includes("gemini") && !name.includes("live") &&
                !name.includes("tts") && !name.includes("image") &&
                !name.includes("veo") && !name.includes("embedding");
            return supportsTextGeneration && isGeminiTextModel;
        });
    }

    const modelScore = (model) => {
        const name = model.name.toLowerCase();
        if (name.includes("pro") && !name.includes("preview") && !name.includes("experimental")) return 0;
        if (name.includes("pro")) return 10;
        if (name.includes("experimental") || name.includes("preview")) return 90;
        if (name.includes("flash") && !name.includes("lite")) return 20;
        if (name.includes("lite")) return 30;
        return 50;
    };

    const cooldowns = getGeminiModelCooldowns();
    const now = Date.now();
    availableGeminiModels = modelNames
        .filter(model => !cooldowns[model.name] || cooldowns[model.name] <= now)
        .sort((a, b) => modelScore(a) - modelScore(b));

    if (availableGeminiModels.length === 0) {
        availableGeminiModels = modelNames.sort((a, b) => modelScore(a) - modelScore(b));
    }

    activeResolvedModel = availableGeminiModels[0].name;
    console.log("Gemini model fallback order:", availableGeminiModels.map(m => m.name));
    return availableGeminiModels;
}

function getGeminiModelCooldowns() {
    return JSON.parse(localStorage.getItem('novus-gemini-model-cooldowns') || '{}');
}

function markGeminiModelCoolingDown(modelName) {
    const cooldowns = getGeminiModelCooldowns();
    cooldowns[modelName] = Date.now() + GEMINI_MODEL_COOLDOWN_MS;
    localStorage.setItem('novus-gemini-model-cooldowns', JSON.stringify(cooldowns));
    availableGeminiModels = null;
}

function isQuotaError(result, response) {
    const message = result.error?.message || "";
    return response.status === 429 || message.toLowerCase().includes("quota") || message.toLowerCase().includes("rate limit");
}

function isRetryableModelError(result) {
    const message = (result.error?.message || "").toLowerCase();
    return message.includes("only supports interactions api") || message.includes("not supported for generatecontent") || message.includes("not found for api version");
}

function isLimitOrQuotaMessage(message) {
    const lowerMessage = String(message || "").toLowerCase();
    return lowerMessage.includes("quota") || lowerMessage.includes("rate-limit") || lowerMessage.includes("rate limit") || lowerMessage.includes("daily ai limit");
}

function getPrepFallbackContent(key) {
    const guides = {
        dsa: `
            <h2>Data Structures & Algorithms Prep Guide</h2>
            <p>AI is temporarily unavailable, so Novus loaded the built-in DSA crash guide.</p>
            <h3>Core Roadmap</h3>
            <ul><li>Arrays, strings, hashing, stacks, queues, linked lists, trees, graphs, heaps, tries, dynamic programming, and greedy algorithms.</li><li>Practice recognizing patterns before memorizing solutions.</li><li>For every problem, state brute force, optimize, then explain complexity.</li></ul>
            <h3>High-Value Patterns</h3>
            <ul><li>Two pointers and sliding window for contiguous ranges.</li><li>BFS/DFS for graph traversal, connected components, and shortest path in unweighted graphs.</li><li>Binary search for sorted spaces and answer search.</li><li>DP when choices overlap and subproblems repeat.</li></ul>`,
        sysdesign: `
            <h2>System Design Prep Guide</h2>
            <p>AI is temporarily unavailable, so Novus loaded the built-in system design guide.</p>
            <h3>Interview Structure</h3>
            <ul><li>Clarify requirements, scale, read/write ratio, latency, availability, and consistency needs.</li><li>Design APIs, data model, high-level architecture, bottlenecks, and tradeoffs.</li><li>Discuss caching, load balancing, queues, database sharding, monitoring, and failure handling.</li></ul>
            <h3>Must-Know Concepts</h3>
            <ul><li>CAP theorem, horizontal scaling, CDN, rate limiting, queues, replication, partitioning, and eventual consistency.</li></ul>`,
        star: `
            <h2>Behavioral Interview Prep Guide</h2>
            <p>AI is temporarily unavailable, so Novus loaded the built-in behavioral guide.</p>
            <h3>STAR Formula</h3>
            <ul><li><strong>Situation:</strong> Give brief context.</li><li><strong>Task:</strong> Explain your responsibility.</li><li><strong>Action:</strong> Focus on what you personally did.</li><li><strong>Result:</strong> Quantify impact and learning.</li></ul>
            <h3>Prepare Stories For</h3>
            <ul><li>Leadership, conflict, failure, ambiguity, tight deadlines, learning quickly, and helping a teammate.</li></ul>`
    };
    return guides[key] || guides.dsa;
}

function getOAFallbackQuestions(companyKey) {
    return [
        {
            topic: "Sliding Window",
            difficulty: "Medium",
            html: `<h3>${companyKey.toUpperCase()} Q1: Longest Stable Window</h3><p>You are given an array of integers and a value <strong>k</strong>. Find the length of the longest contiguous subarray where the difference between the maximum and minimum value is at most <strong>k</strong>.</p><h4>Constraints:</h4><ul><li>1 <= n <= 100000</li><li>0 <= arr[i] <= 1000000000</li><li>0 <= k <= 1000000000</li></ul><h4>Example:</h4><pre style="background:rgba(0,0,0,0.3); padding:10px; border-radius:6px; border: 1px solid rgba(255,255,255,0.1);">Input: arr = [8, 2, 4, 7], k = 4
Output: 2</pre>`
        },
        {
            topic: "Hashing",
            difficulty: "Medium",
            html: `<h3>${companyKey.toUpperCase()} Q2: Pair Sum Frequency</h3><p>Given an integer array and a target, return the number of unique index pairs whose values sum to the target.</p><h4>Constraints:</h4><ul><li>1 <= n <= 200000</li><li>-1000000000 <= arr[i] <= 1000000000</li></ul><h4>Example:</h4><pre style="background:rgba(0,0,0,0.3); padding:10px; border-radius:6px; border: 1px solid rgba(255,255,255,0.1);">Input: arr = [1, 5, 7, -1, 5], target = 6
Output: 3</pre>`
        },
        {
            topic: "Graphs",
            difficulty: "Medium-Hard",
            html: `<h3>${companyKey.toUpperCase()} Q3: Minimum Hops To Service</h3><p>You are given <strong>n</strong> services and directed dependencies. Return the minimum number of dependency hops from service <strong>0</strong> to service <strong>n-1</strong>, or -1 if unreachable.</p><h4>Constraints:</h4><ul><li>1 <= n <= 100000</li><li>0 <= edges.length <= 200000</li></ul><h4>Example:</h4><pre style="background:rgba(0,0,0,0.3); padding:10px; border-radius:6px; border: 1px solid rgba(255,255,255,0.1);">Input: n = 4, edges = [[0,1],[1,3],[0,2]]
Output: 2</pre>`
        }
    ];
}

function getOAFallbackContent(companyKey) {
    return getOAFallbackQuestions(companyKey)[0].html;
}

function getInterviewFallbackResponse(userInput) {
    if (questionCount >= QUESTIONS_PER_ROUND) {
        return `Thanks for your answer. Final feedback: you gave a clear response, but improve by adding specific metrics, tradeoffs, and a stronger conclusion. Review your answer to: "${userInput}" and rewrite it using a tighter structure.`;
    }

    return currentRound === "TECHNICAL"
        ? `Good. Now explain the time and space complexity of your approach, and describe one edge case your solution must handle.`
        : `Good. Now tell me about a time you handled disagreement in a team. Please answer using the STAR structure.`;
}

function getInterviewRubricFallback(userInput) {
    const words = countWords(userInput);
    const hasSpecifics = /\b(because|therefore|tradeoff|complexity|impact|metric|result|learned|tested|scaled)\b/i.test(userInput);
    const hasStructure = /\b(first|second|then|finally|situation|task|action|result)\b/i.test(userInput);
    return {
        correctness: clampScore(45 + Math.min(words, 120) * 0.25 + (hasSpecifics ? 15 : 0)),
        depth: clampScore(35 + Math.min(words, 140) * 0.22 + (hasSpecifics ? 18 : 0)),
        structure: clampScore(40 + Math.min(words, 100) * 0.18 + (hasStructure ? 22 : 0))
    };
}

function getCachedContent(cacheGroup, key) {
    const cache = JSON.parse(localStorage.getItem(getUserStorageKey(cacheGroup)) || '{}');
    return cache[key] || null;
}

function setCachedContent(cacheGroup, key, content) {
    const cache = JSON.parse(localStorage.getItem(getUserStorageKey(cacheGroup)) || '{}');
    cache[key] = { content, savedAt: new Date().toISOString() };
    localStorage.setItem(getUserStorageKey(cacheGroup), JSON.stringify(cache));
}

function withCachedBadge(cachedItem, content) {
    const savedAt = new Date(cachedItem.savedAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
    return `<p style="color: var(--success); font-weight: 800; margin-bottom: 1rem;">Loaded instantly from cache. Generated on ${savedAt}.</p>${content}`;
}

// Unified Gemini function — all calls go through the Edge Function proxy.
// The proxy holds the API key; the client never sees it.
async function callGeminiDynamic(promptText) {
    const models = await discoverGeminiModels();

    ensureAiQuotaAvailable();

    let lastError = null;
    for (const model of models) {
        activeResolvedModel = model.name;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), GEMINI_REQUEST_TIMEOUT_MS);

        let response;
        let result;
        try {
            response = await fetch(PROXY_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${supabaseKey}`,
                    'apikey': supabaseKey
                },
                signal: controller.signal,
                body: JSON.stringify({
                    action: 'gemini',
                    payload: { model: activeResolvedModel, prompt: promptText }
                })
            });
            result = await response.json();
        } catch (error) {
            clearTimeout(timeoutId);
            lastError = error.name === 'AbortError'
                ? `Timed out while waiting for ${activeResolvedModel}`
                : error.message;
            markGeminiModelCoolingDown(activeResolvedModel);
            continue;
        } finally {
            clearTimeout(timeoutId);
        }

        if (response.ok && result.candidates?.[0]?.content?.parts?.[0]?.text) {
            recordAiUsage();
            return result.candidates[0].content.parts[0].text;
        }

        lastError = result.error?.message || `HTTP ${response.status}`;
        if (!isQuotaError(result, response) && !isRetryableModelError(result)) throw new Error(lastError);
        markGeminiModelCoolingDown(activeResolvedModel);
        console.warn(`Gemini model unavailable on ${activeResolvedModel}. Trying next model...`);
    }

    throw new Error(`All available Gemini models are currently rate-limited or quota-blocked. Last error: ${lastError}`);
}

window.navigateTo = function(viewId) {
    if (viewId === 'view-login') {
        pendo.clearSession();
    }
    document.querySelectorAll('.view, .dashboard-view').forEach(el => el.classList.remove('active-view'));
    document.getElementById(viewId).classList.add('active-view');
    window.scrollTo(0,0);
    updateAiUsageDisplay();

    // Refresh CodeMirror layout if showing IDE
    if (viewId === 'view-oa' && window.cmEditor) {
        setTimeout(() => window.cmEditor.refresh(), 10);
    }

    // Silence AI and Mic if navigating away
    cancelPiperAudio();
    if (typeof recognition !== 'undefined' && recognition && isRecordingAnswer) {
        try { recognition.stop(); } catch(e) {}
        isRecordingAnswer = false;
    }

    if (viewId !== 'view-interview' && document.getElementById('webcam').srcObject) {
        document.getElementById('webcam').srcObject.getTracks().forEach(track => track.stop());
        document.getElementById('webcam').srcObject = null;
    }
};

window.handleLogin = async function() {
    const emailInput = document.getElementById('authEmail').value;
    const passwordInput = document.getElementById('authPassword').value;
    const btn = document.getElementById('loginBtn');
    if(!emailInput || !passwordInput) { alert("Please enter both email and password."); return; }

    btn.textContent = "Authenticating..."; btn.disabled = true;
    try {
        let { data, error } = await supabase.auth.signInWithPassword({ email: emailInput, password: passwordInput });
        if (error && (error.status === 400 || error.message.toLowerCase().includes("invalid"))) {
            btn.textContent = "Creating new account...";
            const signupResponse = await supabase.auth.signUp({ email: emailInput, password: passwordInput });
            data = signupResponse.data; error = signupResponse.error;
        }
        if (error) throw error;
        currentUser = data.user;
        pendo.identify({
            visitor: {
                id: currentUser.id,
                email: currentUser.email
            }
        });
        document.getElementById('workspaceTitle').textContent = `Workspace: ${currentUser.email.split('@')[0]}`;

        updateAiUsageDisplay();
        await refreshDashboardProfile();
        navigateTo('view-dashboard');
    } catch (err) {
        alert("Authentication Error: " + err.message);
    } finally {
        btn.textContent = "Authenticate securely"; btn.disabled = false;
    }
};

// ==========================================
// 1.5. DASHBOARD & COACHING ENGINE
// ==========================================
let growthChartInstance = null;

async function refreshDashboardProfile() {
    intelligenceProfile = await fetchIntelligenceProfile();
    if (!intelligenceProfile) return;

    // Populate Metric Cards
    document.getElementById('dashReadiness').textContent = formatScore(intelligenceProfile.overall_readiness);
    document.getElementById('dashTech').textContent = formatScore(intelligenceProfile.avg_technical);
    document.getElementById('dashComm').textContent = formatScore(intelligenceProfile.avg_communication);
    document.getElementById('dashConf').textContent = intelligenceProfile.avg_confidence ? intelligenceProfile.avg_confidence.toFixed(1) : "—";

    // Populate Topic Maps
    const strongBox = document.getElementById('dashStrongTopics');
    const weakBox = document.getElementById('dashWeakTopics');
    strongBox.innerHTML = intelligenceProfile.strong_topics?.length ? 
        intelligenceProfile.strong_topics.map(t => `<span class="topic-pill strong">${escapeHtml(t.topic)}</span>`).join('') : '<span>N/A</span>';
    weakBox.innerHTML = intelligenceProfile.weak_topics?.length ? 
        intelligenceProfile.weak_topics.map(t => `<span class="topic-pill weak">${escapeHtml(t.topic)}</span>`).join('') : '<span>N/A</span>';

    // Feature 3: Personalized Coaching Engine (Deterministic)
    const recs = [];
    if (intelligenceProfile.weak_topics?.length > 0) {
        recs.push(`<strong>Priority 1:</strong> Drill down on ${escapeHtml(intelligenceProfile.weak_topics[0].topic)}. Generate a study module below.`);
    }
    if (intelligenceProfile.avg_technical != null && intelligenceProfile.avg_technical < 70) {
        recs.push(`<strong>Action:</strong> Your technical average is low. Practice OAs to improve algorithm time/space recognition.`);
    }
    if (intelligenceProfile.avg_communication != null && intelligenceProfile.avg_communication < 70) {
        recs.push(`<strong>Action:</strong> Communication metrics flagged. Structure future responses using the STAR method.`);
    }
    if (intelligenceProfile.avg_confidence != null && intelligenceProfile.avg_confidence < 3.5) {
        recs.push(`<strong>Insight:</strong> Your self-reported confidence is low. Remember it's normal to struggle—keep practicing.`);
    }
    if (intelligenceProfile.confidence_trend && intelligenceProfile.session_count > 1) {
        recs.push(`<strong>Trend Analysis:</strong> Your confidence trajectory is currently <strong>${intelligenceProfile.confidence_trend}</strong> across recent mock interviews.`);
    }

    if (recs.length === 0) recs.push(`All systems operational. Keep practicing to maintain your edge.`);
    
    document.getElementById('coachingList').innerHTML = recs.map(r => `<li>${r}</li>`).join('');

    // Feature 2: Growth Intelligence Trend Chart
    if (intelligenceProfile.history_trend && intelligenceProfile.history_trend.length > 0) {
        const labels = intelligenceProfile.history_trend.map((_, i) => `S${i+1}`);
        const overalls = intelligenceProfile.history_trend.map(t => t.overall);
        const techScores = intelligenceProfile.history_trend.map(t => t.technical);
        const commScores = intelligenceProfile.history_trend.map(t => t.communication);
        const compScores = intelligenceProfile.history_trend.map(t => t.composure);
        const confScores = intelligenceProfile.history_trend.map(t => t.confidence);
        
        const ctx = document.getElementById('growthChart').getContext('2d');
        if (growthChartInstance) growthChartInstance.destroy();
        
        growthChartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [
                    { label: 'Overall Readiness', data: overalls, borderColor: '#38BDF8', tension: 0.3, borderWidth: 3 },
                    { label: 'Technical', data: techScores, borderColor: '#A78BFA', tension: 0.3, borderDash: [5, 5] },
                    { label: 'Communication', data: commScores, borderColor: '#10B981', tension: 0.3, borderDash: [3, 3] },
                    { label: 'Composure', data: compScores, borderColor: '#F59E0B', tension: 0.3, borderDash: [3, 3] },
                    { label: 'Confidence (x20)', data: confScores.map(c => c * 20), borderColor: '#EF4444', tension: 0.3, borderDash: [2, 2], hidden: true }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: {
                    y: { min: 0, max: 100, grid: { color: 'rgba(255,255,255,0.05)' } },
                    x: { grid: { display: false } }
                },
                plugins: { legend: { position: 'bottom', labels: { color: '#9CA3AF' } } }
            }
        });
    }

    renderHistoryTable(intelligenceProfile.history_trend);
}

function renderHistoryTable(trends) {
    const emptyState = document.getElementById('historyEmptyState');
    const table = document.getElementById('historyTable');
    const tbody = document.getElementById('historyTableBody');
    
    if (!Array.isArray(trends) || trends.length === 0) {
        emptyState.style.display = 'block';
        table.style.display = 'none';
        return;
    }
    
    emptyState.style.display = 'none';
    table.style.display = 'table';
    
    const recent = [...trends].reverse().slice(0, 10);
    tbody.innerHTML = recent.map(t => `
        <tr onclick="loadHistoricalSession('${t.id}')">
            <td class="date-cell">${new Date(t.date).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}</td>
            <td class="score-cell" style="color: var(--primary);">${formatScore(t.overall)}</td>
            <td class="score-cell">${formatScore(t.technical)}</td>
            <td class="score-cell">${formatScore(t.communication)}</td>
            <td class="score-cell">${formatScore(t.composure)}</td>
        </tr>
    `).join('');
}

let isFetchingHistory = false;
window.loadHistoricalSession = async function(id) {
    if (isFetchingHistory) return;
    isFetchingHistory = true;
    const loader = document.getElementById('historyLoadingState');
    loader.style.display = 'flex';
    
    try {
        const { data, error } = await supabase.from('sessions').select('*').eq('id', id).single();
        if (error) throw error;
        
        const scored = scoreSession(data.answers || [], data.role || 'default');
        
        interviewSession = {
            role: data.role || 'default',
            roleLabel: ROLE_OPTIONS[data.role]?.label || "Historical Session",
            answers: data.answers || [],
            latestScore: {
                overall: data.overall_score,
                composites: data.composites || scored.composites,
                topicScores: data.topic_scores || scored.topicScores,
                perAnswer: scored.perAnswer,
                weakestTopic: scored.weakestTopic
            }
        };
        
        await renderInterviewReport(true);
    } catch (err) {
        console.error("Failed to load historical session:", err);
        alert("Could not load historical session.");
    } finally {
        isFetchingHistory = false;
        loader.style.display = 'none';
    }
};

// ==========================================
// 2. DYNAMIC TEXTBOOK GENERATOR
// ==========================================
window.openPrepModal = async function(key) {
    const modal = document.getElementById('prepModal');
    const modalBody = document.getElementById('modalBody');
    modal.classList.add('active');

    const cachedGuide = getCachedContent('prep-cache', key);
    if (cachedGuide) {
        modalBody.innerHTML = withCachedBadge(cachedGuide, cachedGuide.content);
        return;
    }

    modalBody.innerHTML = `
        <div style="text-align: center; padding: 4rem 2rem;">
            <div class="loader-ring"></div>
            <h2 style="color: var(--warning); margin-bottom: 1rem; animation: text-pulse 2s infinite;">Compiling Comprehensive Study Guide...</h2>
            <p style="color: var(--text-muted);">Generating textbook-grade module via Gemini AI. This usually takes 10-15 seconds...</p>
            <div style="margin-top: 2rem; display: flex; justify-content: center; gap: 8px;">
                <span class="loading-dot"></span><span class="loading-dot" style="animation-delay: 0.2s"></span><span class="loading-dot" style="animation-delay: 0.4s"></span>
            </div>
        </div>`;

    let specializedPrompt = "";
    if (key === 'dsa') specializedPrompt = `You are an elite Computer Science Professor teaching an advanced Data Structures and Algorithms masterclass. Generate an exhaustive, textbook-grade, multi-page comprehensive study guide covering the absolute entire ocean of DSA. Include deeply technical sections on Time/Space Complexity, Linear vs Non-Linear Structures, Two Pointers, Graph Theory, and Dynamic Programming. Format using clear HTML tags (<h2>, <h3>, <p>, <ul>, <pre>). Do not use Markdown backticks.`;
    else if (key === 'sysdesign') specializedPrompt = `You are a Principal Enterprise Systems Architect. Generate an exhaustive, textbook-grade infrastructure manual for Distributed System Design. Include detailed sections on Scaling paradigms, Layer 4 vs Layer 7 Load Balancing, Microservices, Caching Topologies, and Database Sharding (CAP Theorem). Format using clear HTML tags (<h2>, <h3>, <p>, <ul>, <pre>). Do not use Markdown backticks.`;
    else if (key === 'star') specializedPrompt = `You are an Executive Leadership Recruiter. Generate an exhaustive, definitive textbook manual on mastering behavioral interviews using the STAR method for FAANG+ institutions. Detail Core Leadership Competencies, the Situation/Task phase, deep dive into the Action phase, Quantifying Results, and answering the 'Failure' question. Format using clear HTML tags (<h2>, <h3>, <p>, <ul>, <pre>). Do not use Markdown backticks.`;

    try {
        // Using the unified Auto-Discovery function
        const generatedText = await callGeminiDynamic(specializedPrompt);
        setCachedContent('prep-cache', key, generatedText);
        modalBody.innerHTML = generatedText;
    } catch (err) {
        if (isLimitOrQuotaMessage(err.message)) {
            modalBody.innerHTML = getPrepFallbackContent(key);
        } else {
            modalBody.innerHTML = `<h3 style="color: var(--danger);">Google API Connection Failed</h3><p style="color:#ffb86c;">${err.message}</p>`;
        }
    }
};

window.closePrepModal = function() {
    document.getElementById('prepModal').classList.remove('active');
};

// ==========================================
// 3. DYNAMIC OA GENERATOR
// ==========================================
window.oaQuestionsList = [];
window.currentOAIndex = 0;
let isGeneratingNextOA = false;
let currentCompanyKey = "google";
window.oaTimerInterval = null;
let oaTimeRemaining = 90 * 60; // 90 minutes

function startOATimer() {
    if (window.oaTimerInterval) clearInterval(window.oaTimerInterval);
    oaTimeRemaining = 90 * 60;
    updateOATimerDisplay();
    window.oaTimerInterval = setInterval(() => {
        oaTimeRemaining--;
        if (oaTimeRemaining <= 0) {
            clearInterval(window.oaTimerInterval);
            oaTimeRemaining = 0;
        }
        updateOATimerDisplay();
    }, 1000);
}

function updateOATimerDisplay() {
    const timerElement = document.getElementById('oaTimer');
    if (!timerElement) return;
    const m = Math.floor(oaTimeRemaining / 60).toString().padStart(2, '0');
    const s = (oaTimeRemaining % 60).toString().padStart(2, '0');
    timerElement.textContent = `${m}:${s}`;
}

window.moveOAQuestion = async function(direction) {
    if (!window.oaQuestionsList || window.oaQuestionsList.length === 0) return;
    
    const newIndex = window.currentOAIndex + direction;
    
    if (newIndex < 0) return;
    
    if (newIndex >= window.oaQuestionsList.length) {
        // Generate the next question dynamically on demand
        if (isGeneratingNextOA) return;
        isGeneratingNextOA = true;
        const problemText = document.getElementById('oaProblemText');
        const terminal = document.getElementById('terminalLog');
        
        const originalHtml = problemText.innerHTML;
        problemText.innerHTML = `<span style="color: var(--warning);">Generating next problem on the fly. Please wait...</span>`;
        
        const oaTopics = ["Arrays", "Strings", "Hashing", "Trees", "Graphs", "Dynamic Programming", "Greedy", "Binary Search", "Sliding Window"];
        const nextTopic = oaTopics[Math.floor(Math.random() * oaTopics.length)];
        
        const prompt = `You are a technical interviewer for ${currentCompanyKey}. Generate a completely original Data Structures and Algorithms coding problem focusing specifically on the topic of ${nextTopic}. Format the output EXACTLY like this in plain HTML (no markdown code blocks): <h3>[Problem Title]</h3><p>[Detailed description]</p><h4>Constraints:</h4><ul><li>[Constraint 1]</li></ul><h4>Example:</h4><pre style="background:rgba(0,0,0,0.3); padding:10px; border-radius:6px; border: 1px solid rgba(255,255,255,0.1);">Input: ... Output: ...</pre>`;
        
        try {
            const generatedText = await callGeminiDynamic(prompt);
            window.oaQuestionsList.push({ html: generatedText });
            window.currentOAIndex = newIndex;
            problemText.innerHTML = window.oaQuestionsList[window.currentOAIndex].html;
            terminal.innerHTML += `<br><span style="color: var(--success);">[System] Next problem generated.</span>`;
            
            setCachedContent('oa-cache', currentCompanyKey, { list: window.oaQuestionsList });
        } catch (err) {
            problemText.innerHTML = originalHtml + `<br><br><span style="color: var(--danger);">Failed to generate next question.</span>`;
        } finally {
            isGeneratingNextOA = false;
        }
        return;
    }
    
    window.currentOAIndex = newIndex;
    const problemText = document.getElementById('oaProblemText');
    if (problemText && window.oaQuestionsList[window.currentOAIndex]) {
        problemText.innerHTML = window.oaQuestionsList[window.currentOAIndex].html || window.oaQuestionsList[window.currentOAIndex];
    }
};

window.launchOA = async function(companyKey) {
    navigateTo('view-oa');
    document.getElementById('oaTimer').textContent = "--:--"; // Wait for generation to finish
    currentCompanyKey = companyKey;
    
    const oaTopics = ["Arrays", "Strings", "Hashing", "Trees", "Graphs", "Dynamic Programming", "Greedy", "Binary Search", "Sliding Window"];
    currentOATopic = oaTopics[Math.floor(Math.random() * oaTopics.length)];

    const terminal = document.getElementById('terminalLog');
    const problemText = document.getElementById('oaProblemText');

    document.getElementById('oaTitle').textContent = `Generating ${companyKey.toUpperCase()} Assessment...`;

    const cachedProblem = getCachedContent('oa-cache', companyKey);
    if (cachedProblem) {
        document.getElementById('oaTitle').textContent = `${companyKey.toUpperCase()} Practice OA`;
        if (cachedProblem.content && cachedProblem.content.list) {
            window.oaQuestionsList = cachedProblem.content.list;
            window.currentOAIndex = 0;
            problemText.innerHTML = withCachedBadge(cachedProblem, window.oaQuestionsList[0].html);
        } else if (cachedProblem.content) {
            window.oaQuestionsList = [{ html: cachedProblem.content }];
            window.currentOAIndex = 0;
            problemText.innerHTML = withCachedBadge(cachedProblem, cachedProblem.content);
        }
        terminal.innerHTML = `<span style="color: var(--success);">[System] Cached assessment loaded instantly. Compiler is ready.</span>`;
        startOATimer(); // Start timer instantly since it loaded from cache
        return;
    }

    problemText.innerHTML = `<span style="color: var(--warning);">Requesting new encrypted problem from core AI...</span>`;
    terminal.innerHTML = `<span style="color: var(--text-muted);">// Awaiting dynamic constraints...</span>`;

    const prompt = `You are a technical interviewer for ${companyKey}. Generate a completely original Data Structures and Algorithms coding problem focusing specifically on the topic of ${currentOATopic}. Format the output EXACTLY like this in plain HTML (no markdown code blocks): <h3>[Problem Title]</h3><p>[Detailed description]</p><h4>Constraints:</h4><ul><li>[Constraint 1]</li></ul><h4>Example:</h4><pre style="background:rgba(0,0,0,0.3); padding:10px; border-radius:6px; border: 1px solid rgba(255,255,255,0.1);">Input: ... Output: ...</pre>`;

    try {
        // Using the unified Auto-Discovery function
        const generatedText = await callGeminiDynamic(prompt);
        document.getElementById('oaTitle').textContent = `${companyKey.toUpperCase()} Live OA`;
        
        window.oaQuestionsList = [{ html: generatedText }];
        window.currentOAIndex = 0;
        setCachedContent('oa-cache', companyKey, { list: window.oaQuestionsList });
        
        problemText.innerHTML = window.oaQuestionsList[0].html;
        terminal.innerHTML = `<span style="color: var(--success);">[System] Unique problem generated successfully. Awaiting execution payload.</span>`;
        startOATimer(); // Start timer now that the dynamic problem is loaded
    } catch (err) {
        if (isLimitOrQuotaMessage(err.message)) {
            document.getElementById('oaTitle').textContent = `${companyKey.toUpperCase()} Practice OA`;
            window.oaQuestionsList = getOAFallbackQuestions(companyKey);
            window.currentOAIndex = 0;
            problemText.innerHTML = window.oaQuestionsList[0].html;
            terminal.innerHTML = `<span style="color: var(--warning);">[System] AI quota is temporarily unavailable. Loaded built-in practice problem instead.</span>`;
            startOATimer(); // Start timer for fallback practice problem
        } else {
            problemText.innerHTML = `<span style="color: var(--danger); font-weight: bold;">API REJECTED REQUEST:</span><br><br><span style="color: #ffb86c;">${err.message}</span>`;
        }
    }
};

// ==========================================
// 4. MULTI-LANGUAGE COMPILER
// ==========================================
let currentOALanguage = "python";
let currentOAVersion = "3.10.0";
let currentOATopic = "Algorithms";

window.changeOALanguage = function() {
    const lang = document.getElementById('languageSelect').value;
    currentOALanguage = lang;
    let mode = 'python';
    let defaultCode = '';

    if (lang === 'python') {
        mode = 'python';
        currentOAVersion = '3.10.0';
        defaultCode = 'def solution():\n    # Write your optimal logic here\n    pass\n\n# Test your output\nprint("System Ready")';
    } else if (lang === 'javascript') {
        mode = 'javascript';
        currentOAVersion = '18.15.0';
        defaultCode = 'function solution() {\n    // Write your optimal logic here\n}\n\n// Test your output\nconsole.log("System Ready");';
    } else if (lang === 'java') {
        mode = 'text/x-java';
        currentOAVersion = '15.0.2';
        defaultCode = 'public class Main {\n    public static void main(String[] args) {\n        // Write your optimal logic here\n        System.out.println("System Ready");\n    }\n}';
    } else if (lang === 'cpp') {
        mode = 'text/x-c++src';
        currentOAVersion = '10.2.0';
        defaultCode = '#include <iostream>\n\nint main() {\n    // Write your optimal logic here\n    std::cout << "System Ready" << std::endl;\n    return 0;\n}';
    }

    if (window.cmEditor) {
        window.cmEditor.setOption("mode", mode);
        window.cmEditor.setValue(defaultCode);
    } else {
        document.getElementById('editorInput').value = defaultCode;
    }
};

window.runTestCompilation = async function() {
    const terminal = document.getElementById('terminalLog');
    const userCode = window.cmEditor ? window.cmEditor.getValue() : document.getElementById('editorInput').value;
    terminal.innerHTML = `<span style="color: var(--primary);">[System] Packaging payload... Routing to container...</span><br>`;

    try {
        const response = await fetch('https://emkc.org/api/v2/piston/execute', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ language: currentOALanguage, version: currentOAVersion, files: [{ content: userCode }] })
        });
        const result = await response.json();

        if (result.compile && result.compile.code !== 0) {
            terminal.innerHTML += `<br><span style="color: var(--danger);">[Compilation Error]</span><br><pre style="margin:0; white-space: pre-wrap; font-family:'Fira Code';">${result.compile.output}</pre>`;
        } else if (result.run && result.run.code !== 0) {
            terminal.innerHTML += `<br><span style="color: var(--warning);">[Runtime Exception]</span><br><pre style="margin:0; white-space: pre-wrap; font-family:'Fira Code';">${result.run.output}</pre>`;
        } else {
            terminal.innerHTML += `<br><span style="color: var(--success);">[Execution Complete] Output:</span><br><pre style="margin:0; white-space: pre-wrap; color: #A7F3D0; font-family:'Fira Code';">${result.run.output}</pre>`;
        }
    } catch (err) {
        terminal.innerHTML += `<br><span style="color: var(--danger);">[Server Error] Could not reach execution engine.</span>`;
    }
};

window.finishOA = async function() {
    const terminal = document.getElementById('terminalLog');
    const userCode = window.cmEditor ? window.cmEditor.getValue() : document.getElementById('editorInput').value;

    // Feature 7: OA Topic Analytics (Extract the context generated by Gemini)
    const titleText = document.querySelector('#oaProblemText h3')?.textContent || "";
    if (titleText.includes("Array") || titleText.includes("Window")) currentOATopic = "Arrays";
    else if (titleText.includes("Hash") || titleText.includes("Sum")) currentOATopic = "Hashing";
    else if (titleText.includes("Graph") || titleText.includes("Hops")) currentOATopic = "Graphs";

    terminal.innerHTML += `<br><span style="color: var(--primary);">[System] Evaluating submission...</span>`;
    
    try {
        const hasLogic = userCode.length > 20 && !userCode.includes("Write your optimal logic here");
        const isOptimal = /\b(for|while)\b/.test(userCode);
        const overallScore = hasLogic ? (isOptimal ? 92 : 65) : 0;
        
        await saveSessionToSupabase({
            overall: overallScore,
            composites: null,
            topicScores: { [currentOATopic]: overallScore }
        }, 'oa');
        
        terminal.innerHTML += `<br><span style="color: var(--success);">[System] OA Submitted Successfully! Score: ${overallScore}/100</span>`;
        setTimeout(async () => {
            await refreshDashboardProfile();
            navigateTo('view-dashboard');
        }, 2500);
    } catch (err) {
        terminal.innerHTML += `<br><span style="color: var(--danger);">[System Error] Failed to submit OA.</span>`;
    }
};

// ==========================================
// 5. LIVE AI INTERVIEW
// ==========================================
let faceLandmarker = null;
let lastVideoTime = -1;
let currentRound = "";
let questionCount = 0;
const QUESTIONS_PER_ROUND = 6;
let interviewSession = null;
let currentQuestion = null;
let questionReadyAt = 0;
let answerStartedAt = 0;
let isRecordingAnswer = false;
let focusSamples = 0;
let attentiveSamples = 0;
let selfReportCallback = null;
// FER frame collection — populated during recording, consumed in processAnswer
let ferFrames = [];
let lastFaceBbox = null; // updated by predictWebcamLoop

const FILLER_WORDS = new Set([
    "um", "uh", "erm", "ah", "like", "actually", "basically", "literally",
    "okay", "so", "right", "you know", "i mean"
]);

const QUESTION_BANK = {
    TECHNICAL: [
        { id: "tech-arrays-1", topic: "Arrays", difficulty: "Medium", prompt: "Walk me through how you would find the longest subarray with at most K distinct values. Include complexity and edge cases." },
        { id: "tech-arrays-2", topic: "Arrays", difficulty: "Medium", prompt: "How would you solve two sum if the array is sorted? Explain the pointer movement and why it is correct." },
        { id: "tech-graphs-1", topic: "Graphs", difficulty: "Medium", prompt: "Explain how you would detect a cycle in a directed graph, and when you would choose DFS versus topological sorting." },
        { id: "tech-graphs-2", topic: "Graphs", difficulty: "Medium", prompt: "Given a grid of islands and water, explain how you would count connected components and analyze the runtime." },
        { id: "tech-dp-1", topic: "Dynamic Programming", difficulty: "Medium", prompt: "Describe how you recognize a dynamic programming problem and build the recurrence for coin change." },
        { id: "tech-dp-2", topic: "Dynamic Programming", difficulty: "Medium-Hard", prompt: "Explain the difference between memoization and tabulation using longest common subsequence as the example." },
        { id: "tech-system-1", topic: "System Design", difficulty: "Medium", prompt: "Design a URL shortener at a high level. Cover APIs, storage, redirects, and one scaling bottleneck." },
        { id: "tech-system-2", topic: "System Design", difficulty: "Medium", prompt: "Design a notification service. Discuss queues, retries, idempotency, and delivery guarantees." },
        { id: "tech-debugging-1", topic: "Debugging", difficulty: "Medium", prompt: "A production endpoint suddenly has p95 latency spikes. How would you investigate and prioritize fixes?" },
        { id: "tech-debugging-2", topic: "Debugging", difficulty: "Medium", prompt: "A memory leak appears after a deployment. What signals would you inspect and how would you isolate the cause?" }
    ],
    DATA: [
        { id: "data-sql-1", topic: "SQL", difficulty: "Medium", prompt: "Write and explain a query to find the second-highest salary per department. Walk through window functions vs subquery approaches." },
        { id: "data-sql-2", topic: "SQL", difficulty: "Medium", prompt: "You have a user events table with 500 million rows. A query on it is slow. What indexes would you consider and why?" },
        { id: "data-stats-1", topic: "Statistics", difficulty: "Medium", prompt: "Explain the difference between Type I and Type II errors. How do you decide acceptable thresholds in an A/B test?" },
        { id: "data-stats-2", topic: "Statistics", difficulty: "Medium", prompt: "A metric moved 10% after a product change. Walk me through how you would determine if the change caused it." },
        { id: "data-product-1", topic: "Product Metrics", difficulty: "Medium", prompt: "DAU dropped 15% overnight. How do you diagnose the cause? What data would you pull first?" },
        { id: "data-product-2", topic: "Product Metrics", difficulty: "Medium", prompt: "How would you design the metrics framework for a new notification feature? Include guardrail and success metrics." },
        { id: "data-ml-1", topic: "Machine Learning", difficulty: "Medium", prompt: "You are asked to build a churn prediction model. Walk through your approach from problem framing to evaluation." },
        { id: "data-ml-2", topic: "Machine Learning", difficulty: "Medium", prompt: "Explain overfitting. What techniques do you use to detect and address it in a classification model?" },
        { id: "data-pipeline-1", topic: "Data Engineering", difficulty: "Medium", prompt: "Describe how you would design a pipeline to ingest clickstream data at 100k events per second into a data warehouse." },
        { id: "data-pipeline-2", topic: "Data Engineering", difficulty: "Medium", prompt: "What is the difference between a data lake and a data warehouse? When would you use each?" }
    ],
    FRONTEND: [
        { id: "fe-js-1", topic: "JavaScript", difficulty: "Medium", prompt: "Explain the event loop and why it matters for building responsive UIs. Include micro-tasks vs macro-tasks." },
        { id: "fe-js-2", topic: "JavaScript", difficulty: "Medium", prompt: "What is the difference between var, let, and const in terms of scope and hoisting? Give an example where the distinction matters." },
        { id: "fe-react-1", topic: "React", difficulty: "Medium", prompt: "Explain the React reconciliation algorithm and how keys affect component re-rendering." },
        { id: "fe-react-2", topic: "React", difficulty: "Medium", prompt: "When would you use useCallback versus useMemo? Walk me through a concrete example of each." },
        { id: "fe-perf-1", topic: "Performance", difficulty: "Medium", prompt: "Walk me through how you would identify and fix a slow initial page load. Name the metrics you target and tools you use." },
        { id: "fe-perf-2", topic: "Performance", difficulty: "Medium", prompt: "Explain code splitting and lazy loading. When should you apply them and what tradeoffs do they introduce?" },
        { id: "fe-css-1", topic: "CSS & Layout", difficulty: "Medium", prompt: "Explain the difference between CSS Grid and Flexbox. Which would you use for a dashboard layout and why?" },
        { id: "fe-css-2", topic: "CSS & Layout", difficulty: "Medium", prompt: "What are CSS custom properties? How would you use them to implement a theme-switching system?" },
        { id: "fe-arch-1", topic: "Architecture", difficulty: "Medium", prompt: "Describe how you would architect a large React application for a team of 10 engineers. Focus on folder structure, state management, and shared components." },
        { id: "fe-arch-2", topic: "Architecture", difficulty: "Medium", prompt: "What is the difference between CSR, SSR, and SSG? Which would you choose for a public e-commerce storefront and why?" }
    ],
    HR: [
        { id: "hr-star-1", topic: "Ownership", difficulty: "Medium", prompt: "Tell me about a time you took ownership of a difficult project. Use the STAR structure." },
        { id: "hr-star-2", topic: "Ownership", difficulty: "Medium", prompt: "Tell me about a time you noticed a problem that was not assigned to you and fixed it anyway." },
        { id: "hr-conflict-1", topic: "Conflict", difficulty: "Medium", prompt: "Tell me about a disagreement with a teammate and how you handled it." },
        { id: "hr-conflict-2", topic: "Conflict", difficulty: "Medium", prompt: "Describe a time you received critical feedback. How did you respond and what changed?" },
        { id: "hr-failure-1", topic: "Learning", difficulty: "Medium", prompt: "Describe a failure or mistake. What did you change afterward?" },
        { id: "hr-failure-2", topic: "Learning", difficulty: "Medium", prompt: "Tell me about a time you had to learn something quickly to complete a project." },
        { id: "hr-pressure-1", topic: "Execution", difficulty: "Medium", prompt: "Tell me about a time you had to deliver under a tight deadline." },
        { id: "hr-pressure-2", topic: "Execution", difficulty: "Medium", prompt: "Tell me about a time priorities changed suddenly. How did you decide what to do first?" },
        { id: "hr-communication-1", topic: "Communication", difficulty: "Medium", prompt: "Give an example of explaining a technical idea to someone non-technical." },
        { id: "hr-communication-2", topic: "Communication", difficulty: "Medium", prompt: "Tell me about a time you had to align multiple people who had different expectations." }
    ]
};

const ROLE_OPTIONS = {
    swe: {
        label: "SWE Intern",
        round: "TECHNICAL",
        bankKey: "TECHNICAL",
        scoringRole: "swe_intern",
        title: "Live Session: SWE Intern Evaluation"
    },
    data: {
        label: "Data Scientist",
        round: "TECHNICAL",
        bankKey: "DATA",
        scoringRole: "data_science",
        title: "Live Session: Data Science Evaluation"
    },
    frontend: {
        label: "Frontend Engineer",
        round: "TECHNICAL",
        bankKey: "FRONTEND",
        scoringRole: "frontend",
        title: "Live Session: Frontend Evaluation"
    },
    behavioral: {
        label: "Behavioral / HR",
        round: "HR",
        bankKey: "HR",
        scoringRole: "behavioral",
        title: "Live Session: Behavioral Evaluation"
    },
    TECHNICAL: {
        label: "Technical",
        round: "TECHNICAL",
        bankKey: "TECHNICAL",
        scoringRole: "swe_intern",
        title: "Live Session: Technical Evaluation"
    },
    HR: {
        label: "Behavioral / HR",
        round: "HR",
        bankKey: "HR",
        scoringRole: "behavioral",
        title: "Live Session: Behavioral Evaluation"
    }
};

const startBtn = document.getElementById('startBtn');
const userText = document.getElementById('userText');
const aiText = document.getElementById('aiText');
const videoElement = document.getElementById('webcam');

window.startInterviewFlow = function(selectedRole) {
    const roleOption = ROLE_OPTIONS[selectedRole] || ROLE_OPTIONS.swe;
    currentRound = roleOption.round; questionCount = 0;
    interviewSession = createInterviewSession(roleOption);
    currentQuestion = null;
    questionReadyAt = 0;
    answerStartedAt = 0;
    isRecordingAnswer = false;
    focusSamples = 0;
    attentiveSamples = 0;
    startBtn.style.display = "inline-flex";
    userText.textContent = "System standby...";
    navigateTo('view-interview');
    document.getElementById('roundTitleText').textContent = roleOption.title;
    startBtn.textContent = "Start Interview";
    startBtn.disabled = false;
};

function shuffle(arr) {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}

// ── Thompson Sampling primitives ─────────────────────────
// Beta distribution sampling via Gamma ratio (Marsaglia & Tsang method).
// No libraries needed — pure JS, ~30 lines.

/** Standard normal via Box-Muller transform. */
function _randn() {
    const u1 = Math.random(), u2 = Math.random();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/** Sample from Gamma(shape, 1) — Marsaglia & Tsang, 2000. */
function _sampleGamma(shape) {
    if (shape < 1) return _sampleGamma(shape + 1) * Math.pow(Math.random(), 1 / shape);
    const d = shape - 1 / 3;
    const c = 1 / Math.sqrt(9 * d);
    while (true) {
        let x, v;
        do { x = _randn(); v = (1 + c * x) ** 3; } while (v <= 0);
        const u = Math.random();
        if (u < 1 - 0.0331 * (x * x) * (x * x)) return d * v;
        if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
    }
}

/** Sample from Beta(alpha, beta). Returns value in (0, 1). */
function sampleBeta(alpha, beta) {
    const x = _sampleGamma(alpha);
    const y = _sampleGamma(beta);
    return x / (x + y);
}

/** Update a topic's Beta distribution after an answer is scored.
 *  Uses proportional updates — a score of 90 is a stronger success
 *  signal than a score of 60, rather than binary pass/fail. */
function updateTopicBeta(topic, correctnessScore) {
    if (!interviewSession?.topicBeta?.[topic]) return;
    const b = interviewSession.topicBeta[topic];
    const normalized = Math.max(0, Math.min(1, correctnessScore / 100));
    b.alpha += normalized;         // success mass
    b.beta  += (1 - normalized);   // failure mass
}

function createInterviewSession(roleOption) {
    const bank = QUESTION_BANK[roleOption.bankKey] || QUESTION_BANK.TECHNICAL;
    const topics = shuffle([...new Set(bank.map(q => q.topic))]);
    const calibration = topics.map(topic => shuffle(bank.filter(q => q.topic === topic))[0]).filter(Boolean);

    // Initialize Beta(1,1) = uniform prior for each topic (no assumption about strength)
    const topicBeta = {};
    for (const topic of topics) topicBeta[topic] = { alpha: 1, beta: 1 };

    return {
        round: roleOption.round,
        role: roleOption.scoringRole,
        roleLabel: roleOption.label,
        bank,
        calibration,
        topicBeta,
        asked: new Set(),
        answers: [],
        latestScore: null
    };
}

function pickNextQuestion() {
    if (!interviewSession) return null;

    // ── Phase 1: Calibration (unchanged) ─────────────────
    // One random question per topic to establish baseline scores.
    const calibrationQuestion = interviewSession.calibration.find(q => !interviewSession.asked.has(q.id));
    if (calibrationQuestion) return calibrationQuestion;

    // ── Phase 2: Hybrid Thompson + Score adaptive ────────
    const pool = interviewSession.bank.filter(q => !interviewSession.asked.has(q.id));
    if (!pool.length) return null;

    const topicScores = interviewSession.latestScore?.topicScores || {};
    const topicBeta = interviewSession.topicBeta || {};
    const historicalWeakTopics = intelligenceProfile?.weak_topics?.map(t => t.topic) || [];

    const weights = pool.map(q => {
        // Signal 1 — Thompson Sampling (exploration / exploitation)
        // Samples from the topic's Beta posterior. Low sample = likely weak topic.
        // Invert with same pattern as score weight so both point the same direction.
        const b = topicBeta[q.topic] || { alpha: 1, beta: 1 };
        const thompsonSample = sampleBeta(b.alpha, b.beta);
        const thompsonWeight = 1 / (thompsonSample + 0.1);
        //  strong topic → sample ≈ 0.8 → weight ≈ 1.1  (low priority)
        //  weak topic   → sample ≈ 0.2 → weight ≈ 3.3  (high priority)
        //  unknown      → sample ≈ 0.5 → weight ≈ 1.7  (explore)

        // Signal 2 — Rubric score from scoring.js (directional bias)
        const normalizedScore = topicScores[q.topic] == null ? 0.5 : topicScores[q.topic] / 100;
        const scoreWeight = 1 / (normalizedScore + 0.2);

        // Signal 3 — Cross-session historical weakness boost
        const crossSessionBoost = historicalWeakTopics.includes(q.topic) ? 1.5 : 1.0;

        // Combine: geometric-mean of Thompson and score gives equal voice
        // to both signals, then multiply by cross-session boost.
        return Math.sqrt(thompsonWeight * scoreWeight) * crossSessionBoost;
    });

    // Weighted roulette-wheel selection
    const total = weights.reduce((sum, w) => sum + w, 0);
    let draw = Math.random() * total;
    for (let i = 0; i < pool.length; i++) {
        draw -= weights[i];
        if (draw <= 0) return pool[i];
    }
    return pool[0];
}

function askNextQuestion() {
    currentQuestion = pickNextQuestion();
    if (!currentQuestion) {
        renderInterviewReport();
        return;
    }

    interviewSession.asked.add(currentQuestion.id);
    const prefix = questionCount === 0 ? "First question." : "Next question.";
    startBtn.textContent = "Question loading...";
    startBtn.disabled = true;
    speakInterviewerText(`${prefix} ${currentQuestion.prompt}`, () => {
        questionReadyAt = performance.now();
            startRecording();
    });
}

function startRecording() {
    if (!recognition) return;
    cancelPiperAudio(); // Immediately silence any lingering AI speech
    
    // Add a slight hardware delay so physical speakers stop vibrating before mic listens
    setTimeout(() => {
        answerStartedAt = performance.now();
        isRecordingAnswer = true;
        focusSamples = 0;
        attentiveSamples = 0;
        ferFrames = []; // reset frame buffer for this answer
        try {
            recognition.start();
        } catch(e) {
            console.warn("Recognition start error:", e);
        }
        startBtn.textContent = "Finish Answer";
        startBtn.disabled = false;
    }, 400);
}

let currentUtteranceId = 0;

/**
 * speakInterviewerText — Piper TTS with browser SpeechSynthesis fallback.
 *
 * 1. POST to Piper /tts/stream for chunked WAV audio.
 * 2. Play via HTMLAudioElement.
 * 3. If Piper is unreachable, fall back to browser TTS automatically.
 */
function speakInterviewerText(text, onEnd) {
    aiText.textContent = text;
    cancelPiperAudio();
    currentUtteranceId++;
    const thisId = currentUtteranceId;
    let finished = false;

    const finish = () => {
        if (finished || currentUtteranceId !== thisId) return;
        finished = true;
        onEnd?.();
    };

    const fallbackTimer = setTimeout(finish, Math.max(text.length * 120, 15000));

    (async () => {
        try {
            const resp = await fetch(`${PIPER_TTS_URL}/tts/stream`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${PIPER_TTS_KEY}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ text, speed: 1.0 }),
            });

            if (!resp.ok) throw new Error(`TTS service returned ${resp.status}`);

            const blob = await resp.blob();
            const url = URL.createObjectURL(blob);
            const audio = new Audio(url);
            _currentTtsAudio = audio;

            audio.onended = () => {
                URL.revokeObjectURL(url);
                _currentTtsAudio = null;
                clearTimeout(fallbackTimer);
                finish();
            };

            audio.onerror = () => {
                URL.revokeObjectURL(url);
                _currentTtsAudio = null;
                console.warn('Piper audio playback failed, falling back to browser TTS.');
                clearTimeout(fallbackTimer);
                _browserTtsFallback(text, thisId, finish);
            };

            if (currentUtteranceId !== thisId) {
                URL.revokeObjectURL(url);
                return;
            }

            audio.play().catch(() => {
                URL.revokeObjectURL(url);
                _browserTtsFallback(text, thisId, finish);
            });

        } catch (err) {
            console.warn('Piper TTS unreachable, using browser fallback:', err.message);
            _browserTtsFallback(text, thisId, finish);
        }
    })();
}

/** Browser SpeechSynthesis fallback (the old behaviour). */
function _browserTtsFallback(text, expectedId, finish) {
    if (currentUtteranceId !== expectedId) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.onend = () => finish();
    utterance.onerror = () => finish();
    window.speechSynthesis.speak(utterance);
}

async function initializeSystem() {
    try {
        aiText.textContent = "Booting tracking telemetry matrices...";

        // Load FER model in parallel with MediaPipe (non-blocking)
        loadFerModel();

        const filesetResolver = await FilesetResolver.forVisionTasks("https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.8/wasm");
        faceLandmarker = await FaceLandmarker.createFromOptions(filesetResolver, {
            baseOptions: { modelAssetPath: "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task", delegate: "GPU" },
            outputFaceBlendshapes: true, runningMode: "VIDEO", numFaces: 1
        });

        aiText.textContent = "Activating camera and microphone streams...";
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 480, height: 360 }, audio: true });
        videoElement.srcObject = stream;
        videoElement.muted = true; // Prevents the mic from playing out of your speakers (echo loop)
        videoElement.addEventListener('loadeddata', predictWebcamLoop);

        startBtn.textContent = "Preparing first question...";
        startBtn.disabled = true;
        askNextQuestion();
    } catch (e) {
        aiText.textContent = "Camera telemetry unavailable. Continuing with speech and text scoring only.";
        startBtn.textContent = "Preparing first question...";
        startBtn.disabled = true;
        askNextQuestion();
    }
}

function predictWebcamLoop() {
    if (!faceLandmarker || !videoElement.srcObject) return;
    let startTimeMs = performance.now();
    if (videoElement.currentTime !== lastVideoTime) {
        lastVideoTime = videoElement.currentTime;
        const results = faceLandmarker.detectForVideo(videoElement, startTimeMs);

        const presenceBadge = document.getElementById('presenceBadge');
        const gazeBadge = document.getElementById('gazeBadge');

        if (results.faceLandmarks && results.faceLandmarks.length > 0) {
            presenceBadge.textContent = "LOCK_ACQUIRED"; presenceBadge.style.color = "var(--success)";

            // Extract face bounding box from landmarks for FER cropping
            const lm = results.faceLandmarks[0];
            const xs = lm.map(p => p.x), ys = lm.map(p => p.y);
            lastFaceBbox = {
                x: Math.min(...xs), y: Math.min(...ys),
                width: Math.max(...xs) - Math.min(...xs),
                height: Math.max(...ys) - Math.min(...ys)
            };

            // Collect FER frame every ~200ms during recording (throttle to ~5fps)
            if (isRecordingAnswer && isFerReady()) {
                const now = performance.now();
                if (!predictWebcamLoop._lastFerTime || now - predictWebcamLoop._lastFerTime > 200) {
                    predictWebcamLoop._lastFerTime = now;
                    const probs = inferFrame(videoElement, lastFaceBbox);
                    if (probs) ferFrames.push(probs);
                }
            }

            if (results.faceBlendshapes && results.faceBlendshapes[0]) {
                const shapes = results.faceBlendshapes[0].categories;
                const lookLeft = shapes.find(s => s.categoryName === "eyeLookOutLeft")?.score || 0;
                const lookRight = shapes.find(s => s.categoryName === "eyeLookOutRight")?.score || 0;
                const isAttentive = lookLeft <= 0.4 && lookRight <= 0.4;
                if (isRecordingAnswer) {
                    focusSamples++;
                    if (isAttentive) attentiveSamples++;
                }
                if (!isAttentive) {
                    gazeBadge.textContent = "DEVIATED_FOCUS"; gazeBadge.style.color = "var(--warning)";
                } else {
                    gazeBadge.textContent = "PRIMARY_FOCUS"; gazeBadge.style.color = "var(--success)";
                }
            }
        } else {
            presenceBadge.textContent = "SIGNAL_LOST"; presenceBadge.style.color = "var(--danger)";
            gazeBadge.textContent = "NULL"; gazeBadge.style.color = "var(--danger)";
            lastFaceBbox = null;
        }
    }
    window.requestAnimationFrame(predictWebcamLoop);
}

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = SpeechRecognition ? new SpeechRecognition() : null;
if(recognition) {
    recognition.lang = 'en-US'; recognition.interimResults = false;
    recognition.onresult = async (event) => {
        isRecordingAnswer = false;
        const transcript = event.results[0][0].transcript;
        userText.textContent = `"${transcript}"`;
        startBtn.textContent = "Processing metrics...";
        startBtn.disabled = true;
        questionCount++;
        await processAnswer(transcript);
        // State is now clean for the next question.
    };
    recognition.onerror = (event) => {
        console.error("Speech recognition error:", event.error);
        isRecordingAnswer = false;
        startBtn.textContent = "Retry Response";
        startBtn.disabled = false;
    };
    recognition.onend = () => {
        // This is a fallback for when recognition ends without a result (e.g., silence).
        if (isRecordingAnswer) { // Check if we are in a recording state that hasn't been processed
            isRecordingAnswer = false;
            startBtn.textContent = "Retry Response";
            startBtn.disabled = false;
        }
    };
}

startBtn.addEventListener('click', () => {
    if(!recognition) { alert("Speech recognition not supported in this browser."); return; }
    if (isRecordingAnswer) {
        recognition.stop();
        startBtn.textContent = "Stopping...";
        startBtn.disabled = true;
    } else if (!currentQuestion) {
        startBtn.textContent = "Initializing...";
        startBtn.disabled = true;
        initializeSystem();
    } else {
        startRecording();
    }
});

// Show the confidence overlay and return a Promise that resolves with the rating (1–5 or null)
function promptSelfReport() {
    return new Promise((resolve) => {
        selfReportCallback = resolve;
        document.getElementById('selfReportOverlay').classList.add('active');
    });
}

window.submitSelfReport = function(value) {
    document.getElementById('selfReportOverlay').classList.remove('active');
    if (selfReportCallback) {
        selfReportCallback(value);
        selfReportCallback = null;
    }
};

async function processAnswer(userInput) {
    const answerEndedAt = performance.now();
    const delivery = buildDeliveryMetrics(userInput, answerEndedAt);

    // Compute tensionProxy from frames collected during this answer
    const tensionProxy = computeTensionProxy(ferFrames);

    const presence = {
        focusPct: focusSamples ? (attentiveSamples / focusSamples) * 100 : null,
        tensionProxy,   // null if no FER model or too few frames
        voiceSteadiness: null
    };
    let llm;
    try {
        llm = await gradeAnswerWithGemini(userInput, currentQuestion);
    } catch (error) {
        if (isLimitOrQuotaMessage(error.message)) {
            llm = getInterviewRubricFallback(userInput);
        } else {
            aiText.textContent = `Google API Error: ${error.message}`;
            startBtn.textContent = "Retry"; startBtn.disabled = false;
            return;
        }
    }

    // Collect self-report confidence before storing and continuing
    const selfReport = await promptSelfReport();

    interviewSession.answers.push({
        id: currentQuestion.id,
        topic: currentQuestion.topic,
        prompt: currentQuestion.prompt,
        transcript: userInput,
        selfReport,   // 1–5 or null
        llm,
        delivery,
        presence
    });
    interviewSession.latestScore = scoreSession(interviewSession.answers, interviewSession.role);

    // Update Thompson Sampling posterior for this topic
    const lastScore = interviewSession.latestScore.perAnswer?.at(-1);
    if (lastScore) {
        updateTopicBeta(currentQuestion.topic, lastScore.composites.correctness ?? 50);
    }

    if (questionCount >= QUESTIONS_PER_ROUND) {
        renderInterviewReport();
        return;
    }

    askNextQuestion();
}

function buildDeliveryMetrics(userInput, answerEndedAt) {
    const words = countWords(userInput);
    const durationSec = Math.max((answerEndedAt - answerStartedAt) / 1000, 1);
    const fillerCount = countFillers(userInput);
    return {
        words,
        wpm: (words / durationSec) * 60,
        fillerRate: words ? (fillerCount / words) * 100 : 0,
        latencySec: questionReadyAt ? Math.max((answerStartedAt - questionReadyAt) / 1000, 0) : null
    };
}

function countWords(text) {
    return (text.toLowerCase().match(/[a-z0-9']+/g) || []).length;
}

function countFillers(text) {
    const lower = text.toLowerCase();
    let count = 0;
    for (const phrase of FILLER_WORDS) {
        const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        count += (lower.match(new RegExp(`\\b${escaped}\\b`, "g")) || []).length;
    }
    return count;
}

async function gradeAnswerWithGemini(userInput, question) {
    const prompt = `You are scoring a mock interview answer.
Question: ${question.prompt}
Topic: ${question.topic}
Candidate answer: ${userInput}

Return only valid JSON with numeric 0-100 fields:
{"correctness": number, "depth": number, "structure": number}
Correctness means factual/task fit. Depth means detail, tradeoffs, examples, and specificity. Structure means clarity and organization.`;

    const rawText = await callGeminiDynamic(prompt);
    return parseRubricJson(rawText);
}

function parseRubricJson(rawText) {
    const jsonText = rawText.match(/\{[\s\S]*\}/)?.[0];
    if (!jsonText) throw new Error("Gemini did not return rubric JSON.");
    const parsed = JSON.parse(jsonText);
    return {
        correctness: clampScore(Number(parsed.correctness)),
        depth: clampScore(Number(parsed.depth)),
        structure: clampScore(Number(parsed.structure))
    };
}

function clampScore(value) {
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.min(100, value));
}

function formatScore(value) {
    return value == null || Number.isNaN(value) ? "N/A" : Math.round(value);
}

function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    }[char]));
}

function compositeConfidence(answer, compositeName) {
    const weights = CONFIG.weights[compositeName];
    const scored = Object.keys(weights).filter(key => answer.sub[key] != null && !Number.isNaN(answer.sub[key]));
    return scored.length >= Math.min(2, Object.keys(weights).length) ? "OK" : "LOW CONFIDENCE";
}

window.fetchIntelligenceProfile = async function() {
    if (!currentUser) return null;
    const { data, error } = await supabase
        .from('sessions')
        .select('*');
        
    if (error) {
        console.warn("Failed to fetch sessions:", error.message);
        return null;
    }
    
    if (!data || data.length === 0) return null;
    
    const history_trend = data.map(session => ({
        id: session.id,
        date: session.created_at,
        overall: session.overall_score || 0,
        technical: session.composites?.correctness || 0,
        communication: session.composites?.communication || 0,
        composure: session.composites?.composure || 0,
        confidence: 0 
    })).sort((a, b) => new Date(a.date) - new Date(b.date));

    const count = history_trend.length;
    return {
        session_count: count,
        overall_readiness: history_trend.reduce((acc, curr) => acc + curr.overall, 0) / count,
        avg_technical: history_trend.reduce((acc, curr) => acc + curr.technical, 0) / count,
        avg_communication: history_trend.reduce((acc, curr) => acc + curr.communication, 0) / count,
        avg_confidence: 0,
        strong_topics: [],
        weak_topics: [],
        history_trend
    };
};

async function saveSessionToSupabase(result, activityType = 'interview') {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) return; // not logged in, skip silently

        const response = await fetch(PROXY_URL, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseKey}`,
                'apikey': supabaseKey
            },
            body: JSON.stringify({
                action: 'save_session',
                userToken: session.access_token,
                payload: {
                    role: activityType === 'interview' ? (interviewSession?.role || 'default') : 'oa',
                    overall: result.overall,
                    composites: result.composites || null,
                    topic_scores: result.topicScores || null,
                    activity_type: activityType,
                    answers: (activityType === 'interview' && interviewSession?.answers) ? interviewSession.answers.map(a => ({
                        topic: a.topic,
                        prompt: a.prompt,
                        transcript: a.transcript,
                        selfReport: a.selfReport ?? null,
                        llm: a.llm,
                        delivery: a.delivery,
                        presence: a.presence
                    })) : []
                }
            })
        });

        if (!response.ok) {
            const errResult = await response.json().catch(() => ({}));
            throw new Error(errResult.error || `HTTP ${response.status} ${response.statusText}`);
        }
        console.log("Session saved to Supabase.");
    } catch (err) {
        // Non-critical — don't block the report if saving fails
        console.warn("Could not save session to Supabase:", err.message);
    }
}

let radarChartInstance = null;

async function renderInterviewReport(isHistorical = false) {
    const result = interviewSession.latestScore || scoreSession(interviewSession.answers, interviewSession.role);
    if (!isHistorical) startBtn.style.display = "none";

    // Populate the report view
    document.getElementById('reportRoleLabel').textContent =
        `${interviewSession.roleLabel} — Interview Report`;

    // Overall score
    document.getElementById('reportOverallScore').textContent =
        formatScore(result.overall);

    // Weakest topic note
    const weakestTopic = result.weakestTopic || "N/A";
    document.getElementById('reportWeakNote').textContent =
        `Focus area: ${weakestTopic} scored lowest. Adaptive questions were weighted toward it.`;

    // Composite pills
    const pillLabels = { correctness: 'Correctness', communication: 'Communication', composure: 'Composure (proxy)' };
    document.getElementById('reportCompositePills').innerHTML =
        Object.entries(pillLabels).map(([k, label]) => `
            <div class="composite-pill">
                <span>${label}</span>
                <strong>${formatScore(result.composites[k])}</strong>
            </div>`).join('');

    // Radar chart
    const radarCtx = document.getElementById('radarChart').getContext('2d');
    if (radarChartInstance) radarChartInstance.destroy();
    radarChartInstance = new Chart(radarCtx, {
        type: 'radar',
        data: {
            labels: ['Correctness', 'Communication', 'Composure'],
            datasets: [{
                label: interviewSession.roleLabel,
                data: [
                    result.composites.correctness ?? 0,
                    result.composites.communication ?? 0,
                    result.composites.composure ?? 0
                ],
                backgroundColor: 'rgba(56,189,248,0.15)',
                borderColor: '#38BDF8',
                pointBackgroundColor: '#A78BFA',
                pointBorderColor: '#fff',
                pointRadius: 5,
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                r: {
                    min: 0, max: 100,
                    ticks: { stepSize: 25, color: '#9CA3AF', backdropColor: 'transparent', font: { size: 11 } },
                    grid: { color: 'rgba(255,255,255,0.08)' },
                    angleLines: { color: 'rgba(255,255,255,0.08)' },
                    pointLabels: { color: '#CBD5E1', font: { size: 13, weight: '600' } }
                }
            },
            plugins: {
                legend: { display: false }
            }
        }
    });

    // Topic bars
    document.getElementById('reportTopicBars').innerHTML =
        Object.entries(result.topicScores)
            .sort((a, b) => (a[1] ?? 0) - (b[1] ?? 0))
            .map(([topic, score]) => `
                <div class="score-row">
                    <span>${escapeHtml(topic)}</span>
                    <strong>${formatScore(score)}</strong>
                    <div class="score-bar"><i style="width:${formatScore(score)}%"></i></div>
                </div>`).join('');

    // Per-answer breakdown
    const CONF_LABELS = { 1: '😰 Not confident', 2: '😟 Unsure', 3: '😐 Okay', 4: '🙂 Confident', 5: '😄 Very confident' };
    document.getElementById('reportAnswerList').innerHTML =
        result.perAnswer.map((answer, i) => {
            const raw = interviewSession.answers[i];
            const conf = raw.selfReport ? CONF_LABELS[raw.selfReport] : null;
            const confBadge = conf
                ? `<span class="self-report-badge">${conf}</span>`
                : '';
            const transcriptSnippet = raw.transcript.length > 180
                ? raw.transcript.slice(0, 180) + '…'
                : raw.transcript;
            const confidenceFlag = compositeConfidence(answer, 'composure');
            return `
                <div class="answer-review">
                    <div class="answer-detail-meta">
                        <strong>Q${i + 1}.</strong>
                        <span class="topic-tag">${escapeHtml(answer.topic)}</span>
                        ${confBadge}
                        ${confidenceFlag === 'LOW CONFIDENCE'
                            ? `<span style="color:var(--warning); font-size:0.72rem; font-weight:900;">⚠ LOW DATA</span>`
                            : ''}
                    </div>
                    <p style="margin:0.3rem 0 0.5rem; font-size:0.9rem; color:var(--text-soft);">${escapeHtml(raw.prompt)}</p>
                    <p class="answer-transcript">"${escapeHtml(transcriptSnippet)}"</p>
                    <div class="mini-scores">
                        <span>Correctness ${formatScore(answer.composites.correctness)}</span>
                        <span>Communication ${formatScore(answer.composites.communication)}</span>
                        <span>Composure ${formatScore(answer.composites.composure)}</span>
                    </div>
                </div>`;
        }).join('');

    navigateTo('view-report');
    userText.textContent = "Interview complete.";
    await saveSessionToSupabase(result); 
    await refreshDashboardProfile();     
}

// Initialize CodeMirror IDE Experience safely
if (typeof CodeMirror !== 'undefined' && document.getElementById('editorInput')) {
    window.cmEditor = CodeMirror.fromTextArea(document.getElementById('editorInput'), {
        mode: 'python',
        theme: 'dracula',
        lineNumbers: true,
        indentUnit: 4,
        matchBrackets: true,
        extraKeys: {"Ctrl-Space": "autocomplete"}
    });
    // Instantly generate mesmerizing live code suggestions as the user types
    window.cmEditor.on("inputRead", function(cm, change) {
        if (!cm.state.completionActive && change.text[0].match(/\w/)) {
            CodeMirror.commands.autocomplete(cm, null, {completeSingle: false});
        }
    });
}
