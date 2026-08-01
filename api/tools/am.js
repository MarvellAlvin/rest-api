// api/tools/amprem.js
const axios = require('axios');
const https = require('https');

// ===== KONFIGURASI =====
const API_KEY = "DEZZIFY-AMPREM";
const BASE_URL = 'https://am-prem.vxz.my.id/api';
const DEBUG = true;

// ===== AGENT HTTPS (bypass SSL jika perlu) =====
const httpsAgent = new https.Agent({
    rejectUnauthorized: false
});

// ===== FUNGSI LOGGING =====
function log(message, data = null) {
    if (!DEBUG) return;
    if (data) {
        console.log(`[AM Prem] ${message}`, data);
    } else {
        console.log(`[AM Prem] ${message}`);
    }
}

// ===== SEND ACTIVATION =====
async function sendActivation(email) {
    try {
        log(`Sending activation to ${email}...`);
        const url = `${BASE_URL}/send?email=${encodeURIComponent(email)}&apikey=${API_KEY}`;
        const response = await axios.get(url, {
            timeout: 30000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            httpsAgent
        });
        
        if (!response.data || response.data.success !== true) {
            throw new Error(`Send activation failed: ${JSON.stringify(response.data)}`);
        }
        
        log('Activation sent successfully');
        return response.data;
    } catch (error) {
        if (error.response) {
            throw new Error(`Send error: ${error.response.status} - ${error.response.data?.error || error.response.statusText}`);
        }
        throw new Error(`Send error: ${error.message}`);
    }
}

// ========== ENDPOINT UTAMA ==========
module.exports = async (req, res) => {
    const startTime = Date.now();

    log('========== NEW REQUEST ==========');

    // Ambil email dari query (GET) atau body (POST)
    const { email } = req.method === 'GET' ? req.query : req.body;

    // ===== VALIDASI =====
    if (!email) {
        return res.status(400).json({
            status: false,
            statusCode: 400,
            author: '@velz',
            error: 'Parameter "email" wajib diisi.',
            responseTimeMs: Date.now() - startTime,
            timestamp: new Date().toISOString()
        });
    }

    // Validasi format email sederhana
    if (!email.includes('@') || !email.includes('.')) {
        return res.status(400).json({
            status: false,
            statusCode: 400,
            author: '@velz',
            error: 'Format email tidak valid.',
            responseTimeMs: Date.now() - startTime,
            timestamp: new Date().toISOString()
        });
    }

    try {
        // Kirim aktivasi
        const sendResult = await sendActivation(email.trim());

        // ===== RESPON SUKSES =====
        log('✅ Activation sent successfully');
        res.status(200).json({
            status: true,
            statusCode: 200,
            author: '@velz',
            result: {
                email: email.trim(),
                message: 'Email aktivasi telah dikirim. Silakan cek inbox Anda dan klik link verifikasi.',
                sendResult: sendResult,
                provider: 'Alight Motion Premium'
            },
            responseTimeMs: Date.now() - startTime,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        log(`❌ Error: ${error.message}`);

        // ===== RESPON ERROR =====
        let statusCode = 500;
        let errorMessage = error.message || 'Terjadi kesalahan pada server.';

        if (error.message.includes('timeout')) {
            statusCode = 408;
            errorMessage = 'Request timeout. Silakan coba lagi.';
        } else if (error.message.includes('rate limit')) {
            statusCode = 429;
            errorMessage = 'Rate limit exceeded. Silakan coba lagi nanti.';
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
