// api/ai/mistral.js
const axios = require('axios');
const crypto = require('crypto');

// ===== KONFIGURASI =====
const USER_AGENT = 'le-chat-mobile/2.3.0 (build:20300173; os_name:ios; device_category:smartphone; device_model:iPhone 14 Pro; device_manufacturer:Apple)';
const BASE_HEADERS = {
    'User-Agent': USER_AGENT,
    'Accept-Language': 'en',
    'Accept': '*/*',
    'Content-Type': 'application/json'
};

// ===== COOKIE STORE (PER SESSION) =====
let cookieStore = '';

// ===== FUNGSI BANTUAN =====
function parseCookies(arr) {
    return Object.fromEntries(
        (arr || []).map(c => {
            const [pair] = c.split(';');
            const i = pair.indexOf('=');
            return i < 0 ? [] : [pair.slice(0, i).trim(), pair.slice(i + 1).trim()];
        }).filter(e => e.length)
    );
}

// ===== INISIALISASI SESSION =====
async function initSession() {
    try {
        const payload = {
            "0": { "json": { "name": "app_downloaded", "properties": {} } },
            "1": {
                "json": {
                    "name": "app_started",
                    "properties": {
                        "os": "iOS",
                        "osVersion": "17.4.1",
                        "deviceManufacturer": "Apple",
                        "screenWidth": 393,
                        "screenHeight": 852
                    }
                }
            }
        };

        const response = await axios.post(
            'https://chat.mistral.ai/api/trpc/event.sendEventToDatalake,event.sendEventToDatalake?batch=1',
            payload,
            { headers: BASE_HEADERS }
        );

        const cookies = parseCookies(response.headers['set-cookie']);
        cookieStore = Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join('; ');

        await axios.post(
            'https://chat.mistral.ai/api/trpc/user.acceptToS?batch=1',
            { "0": { "json": {} } },
            { headers: { ...BASE_HEADERS, 'Cookie': cookieStore } }
        );

        return true;
    } catch (error) {
        console.error('[Mistral] Init error:', error.message);
        return false;
    }
}

// ===== BUAT CHAT BARU =====
async function createNewChat(promptText) {
    if (!cookieStore) {
        await initSession();
    }

    const payload = {
        "0": {
            "json": {
                "content": [{ "type": "text", "text": promptText }],
                "transcriptionsMetadata": null,
                "incognito": null,
                "files": [],
                "agentId": null,
                "agentsApiAgentId": null,
                "features": ["beta-websearch"],
                "integrations": [],
                "libraries": [],
                "projectId": null,
                "productType": "chat",
                "chatId": null,
                "parentId": null,
                "parentVersion": null
            },
            "meta": {
                "values": {
                    "transcriptionsMetadata": ["undefined"],
                    "incognito": ["undefined"],
                    "agentId": ["undefined"],
                    "agentsApiAgentId": ["undefined"],
                    "projectId": ["undefined"],
                    "chatId": ["undefined"],
                    "parentId": ["undefined"],
                    "parentVersion": ["undefined"]
                },
                "v": 1
            }
        }
    };

    const response = await axios.post(
        'https://chat.mistral.ai/api/trpc/message.newChat?batch=1',
        payload,
        { headers: { ...BASE_HEADERS, 'Cookie': cookieStore } }
    );

    const chatId = response.data[0]?.result?.data?.json?.chatId;
    if (!chatId) {
        throw new Error('Gagal mengekstrak chatId dari server.');
    }

    return chatId;
}

// ===== SEND EVENT KE DATALAKE =====
async function sendEventToDatalake(chatId, messageId, promptLength) {
    const payload = {
        "0": {
            "json": {
                "name": "prompt_submitted",
                "properties": {
                    "chat_id": chatId,
                    "prompt_id": messageId,
                    "prompt_version": 0,
                    "prompt_chars_number": promptLength,
                    "model": null,
                    "file_count": 0
                }
            },
            "meta": {
                "values": { "properties.model": ["undefined"] },
                "v": 1
            }
        }
    };

    try {
        await axios.post(
            'https://chat.mistral.ai/api/trpc/event.sendEventToDatalake?batch=1',
            payload,
            { headers: { ...BASE_HEADERS, 'Cookie': cookieStore } }
        );
    } catch (error) {
        // Non-critical, ignore
    }
}

// ===== KIRIM PESAN KE CHAT =====
async function sendChatMessage(chatId, promptText, mode = 'append', sseMessageId = null) {
    const hariIni = new Date().toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    const messageId = sseMessageId || crypto.randomUUID();

    await sendEventToDatalake(chatId, messageId, promptText.length);

    const payload = {
        "chatId": chatId,
        "stableAnonymousIdentifier": crypto.randomUUID(),
        "platform": "mobile",
        "clientPromptData": {
            "currentDate": hariIni,
            "userTimezone": "T+00:00 (Asia/Makassar)"
        },
        "shouldAwaitStreamBackgroundTasks": true,
        "shouldUseMessagePatch": true,
        "supportedTaskCallbacks": [
            "ask_user_question",
            "ask_user_confirmation",
            "collect_workflow_input",
            "delegate_workflow_execution",
            "enable_connector"
        ],
        "features": ["beta-websearch"],
        "integrations": [],
        "libraries": [],
        "mode": mode,
        "disabledFeatures": mode === 'start' ? ["memory-inference"] : undefined,
        "messageId": mode === 'start' ? undefined : messageId,
        "messageInput": mode === 'start' ? undefined : [{ "type": "text", "text": promptText }],
        "messageFiles": mode === 'start' ? undefined : []
    };

    const response = await axios.post(
        'https://chat.mistral.ai/api/chat',
        payload,
        {
            headers: {
                ...BASE_HEADERS,
                'Cookie': cookieStore,
                'Accept': 'text/event-stream'
            },
            responseType: 'stream'
        }
    );

    return new Promise((resolve, reject) => {
        let fullResponse = '';
        let buffer = '';

        response.data.on('data', chunk => {
            buffer += chunk.toString();
            const lines = buffer.split('\n');
            buffer = lines.pop();

            for (const line of lines) {
                if (!line.trim()) continue;
                const match = line.match(/^\d+:(.*)/);
                if (match) {
                    try {
                        const parsed = JSON.parse(match[1]);
                        if (parsed.json && parsed.json.patches) {
                            for (const patch of parsed.json.patches) {
                                let text = '';
                                if (patch.op === 'append' && patch.path.includes('/text')) {
                                    text = patch.value;
                                } else if (patch.op === 'replace' && patch.path === '/contentChunks') {
                                    if (Array.isArray(patch.value) && patch.value.length > 0 && patch.value[0].text) {
                                        text = patch.value[0].text;
                                    }
                                }
                                if (text) {
                                    fullResponse += text;
                                }
                            }
                        }
                    } catch (e) {
                        // Abaikan
                    }
                }
            }
        });

        response.data.on('end', () => {
            resolve(fullResponse.trim());
        });

        response.data.on('error', reject);
    });
}

// ===== MAIN ROUTE HANDLER =====
module.exports = async (req, res) => {
    const startTime = Date.now();

    // Ambil prompt dari query (GET) atau body (POST)
    const prompt = req.method === 'GET' ? req.query.prompt : req.body.prompt;

    if (!prompt) {
        return res.status(400).json({
            status: false,
            statusCode: 400,
            author: '@velz',
            error: 'Parameter "prompt" wajib diisi.',
            responseTimeMs: Date.now() - startTime,
            timestamp: new Date().toISOString()
        });
    }

    try {
        // 1. Init session
        const sessionOk = await initSession();
        if (!sessionOk) {
            throw new Error('Gagal menginisialisasi session Mistral AI.');
        }

        // 2. Buat chat baru dengan prompt awal
        const initPrompt = 'halo';
        const chatId = await createNewChat(initPrompt);

        // 3. Kirim mode 'start' untuk mengaktifkan chat
        await sendChatMessage(chatId, initPrompt, 'start');

        // 4. Kirim prompt utama dengan mode 'append'
        const responseText = await sendChatMessage(chatId, prompt, 'append');

        // 5. Format respons
        const response = {
            status: true,
            statusCode: 200,
            author: '@velz',
            result: {
                prompt: prompt,
                response: responseText,
                chatId: chatId
            },
            responseTimeMs: Date.now() - startTime,
            timestamp: new Date().toISOString()
        };

        res.status(200).json(response);
    } catch (error) {
        console.error('[Mistral API] Error:', error.message);
        res.status(500).json({
            status: false,
            statusCode: 500,
            author: '@velz',
            error: error.message,
            responseTimeMs: Date.now() - startTime,
            timestamp: new Date().toISOString()
        });
    }
};
