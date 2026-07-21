// api/ai/notrack.js
const axios = require('axios');

// ===== KONFIGURASI =====
const BASE_URL = 'https://notrack.ai/api/dispatch';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36';
const TIMEOUT = 60000; // 60 detik

// ===== HEADER =====
const BASE_HEADERS = {
    'Accept': '*/*',
    'Accept-Encoding': 'gzip, deflate, br, zstd',
    'Accept-Language': 'id,en-US;q=0.9,en;q=0.8',
    'Content-Type': 'application/json',
    'Origin': 'https://notrack.ai',
    'Referer': 'https://notrack.ai/chat',
    'Sec-Ch-Ua': '"Not;A=Brand";v="8", "Chromium";v="150", "Google Chrome";v="150"',
    'Sec-Ch-Ua-Mobile': '?0',
    'Sec-Ch-Ua-Platform': '"Windows"',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-origin',
    'User-Agent': USER_AGENT
};

// ===== KIRIM REQUEST KE NOTRACK =====
async function sendRequest(prompt, chatId = null) {
    const payload = {
        user_input: prompt,
        mode: 'usual',
        model: 'C', // C = NoTrack (uncensored)
        persona: 'normal',
        max_turns: 6,
        chat_id: chatId,
        attachments: [],
        regenerate: false,
        edit: false,
        edit_mid: null
    };

    const response = await axios.post(BASE_URL, payload, {
        headers: BASE_HEADERS,
        timeout: TIMEOUT,
        responseType: 'stream'
    });

    return response;
}

// ===== PARSE STREAM SSE =====
async function parseStream(stream) {
    return new Promise((resolve, reject) => {
        let finalAnswer = '';
        let returnedChatId = null;
        let buffer = '';

        stream.on('data', chunk => {
            buffer += chunk.toString();
            const parts = buffer.split('\n\n');
            buffer = parts.pop();

            for (const part of parts) {
                if (part.startsWith('data: ')) {
                    const jsonStr = part.slice(6).trim();
                    if (!jsonStr) continue;

                    try {
                        const data = JSON.parse(jsonStr);

                        switch (data.type) {
                            case 'chat_meta':
                                returnedChatId = data.chat_id;
                                break;
                            case 'delta':
                                if (data.chunk) {
                                    finalAnswer += data.chunk;
                                }
                                break;
                            case 'error':
                                reject(new Error(`Server error: ${data.content}`));
                                return;
                        }
                    } catch (err) {
                        // Abaikan JSON parse error
                    }
                }
            }
        });

        stream.on('end', () => {
            if (!finalAnswer || finalAnswer.trim().length === 0) {
                reject(new Error('Tidak ada respons dari NoTrack AI.'));
                return;
            }
            resolve({
                answer: finalAnswer.trim(),
                chatId: returnedChatId
            });
        });

        stream.on('error', (error) => {
            reject(new Error(`Stream error: ${error.message}`));
        });
    });
}

// ===== CHAT DENGAN NOTRACK =====
async function chatWithNoTrack(prompt, chatId = null) {
    try {
        // 1. Kirim request
        const response = await sendRequest(prompt, chatId);

        if (response.status !== 200) {
            throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
        }

        // 2. Parse stream
        const result = await parseStream(response.data);

        return {
            response: result.answer,
            chatId: result.chatId || chatId
        };

    } catch (error) {
        if (error.code === 'ECONNABORTED') {
            throw new Error('Request timeout: NoTrack AI tidak merespons dalam waktu yang ditentukan.');
        }
        throw new Error(`NoTrack error: ${error.message}`);
    }
}

// ========== ENDPOINT UTAMA ==========
module.exports = async (req, res) => {
    const startTime = Date.now();

    // Ambil prompt dari query (GET) atau body (POST)
    const prompt = req.method === 'GET' ? req.query.prompt : req.body.prompt;
    const chatId = req.method === 'GET' ? req.query.chatId : req.body.chatId;

    // ===== VALIDASI =====
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
        // Proses chat dengan NoTrack
        const result = await chatWithNoTrack(prompt, chatId || null);

        // ===== RESPON SUKSES =====
        res.status(200).json({
            status: true,
            statusCode: 200,
            author: '@velz',
            result: {
                prompt: prompt,
                response: result.response,
                chatId: result.chatId,
                provider: 'NoTrack AI'
            },
            responseTimeMs: Date.now() - startTime,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('[NoTrack API] Error:', error.message);

        // ===== RESPON ERROR =====
        let statusCode = 500;
        let errorMessage = error.message;

        if (error.message.includes('HTTP Error: 429')) {
            statusCode = 429;
            errorMessage = 'Terlalu banyak permintaan. Silakan coba lagi nanti.';
        } else if (error.message.includes('HTTP Error: 500')) {
            statusCode = 500;
            errorMessage = 'Server NoTrack AI mengalami gangguan. Silakan coba lagi nanti.';
        } else if (error.message.includes('HTTP Error: 502') || error.message.includes('HTTP Error: 503') || error.message.includes('HTTP Error: 504')) {
            statusCode = 503;
            errorMessage = 'Server NoTrack AI sedang sibuk. Silakan coba lagi nanti.';
        } else if (error.message.includes('timeout')) {
            statusCode = 408;
        }

        res.status(statusCode).json({
            status: false,
            statusCode: statusCode,
            author: '@velz',
            error: errorMessage,
            responseTimeMs: Date.now() - startTime,
            timestamp: new Date().toISOString()
        });
    }
};
