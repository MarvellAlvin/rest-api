// api/tools/amprem.js
const axios = require('axios');
const https = require('https');
const { SocksProxyAgent } = require('socks-proxy-agent');

// ===== KONFIGURASI =====
const API_KEY = "DEZZIFY-AMPREM";
const BASE_URL = 'https://am-prem.vxz.my.id/api';
const DEBUG = true;

// ===== KONFIGURASI PROXY =====
const PROXY_CONFIG = {
    host: 'gw.dataimpulse.com',
    port: 824, // SOCKS5
    username: '97a7bc9b9ba5581b5f48_cr.ye',
    password: '47fcf03ec11bd3a8'
};

// Buat SOCKS5 proxy agent
const proxyUrl = `socks5://${PROXY_CONFIG.username}:${PROXY_CONFIG.password}@${PROXY_CONFIG.host}:${PROXY_CONFIG.port}`;
const proxyAgent = new SocksProxyAgent(proxyUrl);

// ===== FUNGSI LOGGING =====
function log(message, data = null) {
    if (!DEBUG) return;
    if (data) {
        console.log(`[AM Prem] ${message}`, data);
    } else {
        console.log(`[AM Prem] ${message}`);
    }
}

// ===== GET HEADER LENGKAP =====
function getHeaders() {
    return {
        'Accept': 'application/json, text/plain, */*',
        'Accept-Encoding': 'gzip, deflate, br, zstd',
        'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Content-Type': 'application/json',
        'Origin': 'https://am-prem.vxz.my.id',
        'Referer': 'https://am-prem.vxz.my.id/',
        'Sec-Ch-Ua': '"Not/A)Brand";v="8", "Chromium";v="126", "Google Chrome";v="126"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-origin',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
    };
}

// ===== CEK IP PROXY (untuk verifikasi) =====
async function checkProxyIp() {
    try {
        const response = await axios.get('https://api.ipify.org?format=json', {
            httpAgent: proxyAgent,
            httpsAgent: proxyAgent,
            timeout: 10000
        });
        log(`Proxy IP: ${response.data.ip}`);
        return response.data.ip;
    } catch (error) {
        log(`Proxy IP check failed: ${error.message}`);
        return null;
    }
}

// ===== SEND ACTIVATION =====
async function sendActivation(email) {
    try {
        log(`Sending activation to ${email}...`);
        
        // Cek IP proxy terlebih dahulu
        const proxyIp = await checkProxyIp();
        if (proxyIp) {
            log(`Using proxy IP: ${proxyIp}`);
        }
        
        const url = `${BASE_URL}/send?email=${encodeURIComponent(email)}&apikey=${API_KEY}`;
        
        const response = await axios.get(url, {
            headers: getHeaders(),
            timeout: 30000,
            httpAgent: proxyAgent,
            httpsAgent: proxyAgent,
            maxRedirects: 5,
            validateStatus: (status) => status < 500
        });
        
        log(`Response status: ${response.status}`);
        
        if (response.status === 403) {
            throw new Error('Anti-Bot Protection masih terdeteksi. Coba ganti endpoint proxy atau tunggu beberapa menit.');
        }
        
        if (response.status !== 200) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        if (!response.data || response.data.success !== true) {
            throw new Error(`Send failed: ${JSON.stringify(response.data)}`);
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

    const { email } = req.method === 'GET' ? req.query : req.body;

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
        const sendResult = await sendActivation(email.trim());

        res.status(200).json({
            status: true,
            statusCode: 200,
            author: '@velz',
            result: {
                email: email.trim(),
                message: 'Email aktivasi telah dikirim. Silakan cek inbox dan klik link verifikasi.',
                sendResult: sendResult,
                provider: 'Alight Motion Premium',
                proxy: 'DataImpulse (SOCKS5)'
            },
            responseTimeMs: Date.now() - startTime,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        log(`❌ Error: ${error.message}`);

        let statusCode = 500;
        let errorMessage = error.message;

        if (error.message.includes('403') || error.message.includes('Anti-Bot')) {
            statusCode = 403;
            errorMessage = 'Anti-Bot Protection. Coba: (1) Tunggu 5 menit, (2) Ganti IP proxy, (3) Coba lagi nanti.';
        } else if (error.message.includes('timeout')) {
            statusCode = 408;
            errorMessage = 'Request timeout. Proxy mungkin lambat. Coba lagi.';
        } else if (error.message.includes('ECONNREFUSED') || error.message.includes('connect')) {
            statusCode = 502;
            errorMessage = 'Proxy tidak dapat dihubungi. Periksa koneksi atau coba lagi.';
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
