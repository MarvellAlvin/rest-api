// api/tools/free-views-tt.js
const axios = require("axios");
const FormData = require("form-data");
const NodeCache = require("node-cache");

// ===== KONFIGURASI =====
const ZEFAME_URL = "https://zefame.com/id/free-tiktok-views";
const API_URL = "https://app.zefame.com/api_free.php";
const SOLVER_URL = "https://fgsi.dpdns.org/api/tools/cfclearance/turnstile-min";

// API key kita (disisipkan)
const DEFAULT_API_KEY = "fgsiapi-36d42133-6d"; // ganti dengan apikey Anda

// Batasan
const MAX_VIDEOS_PER_DAY = 5;
const DELAY_BETWEEN_ORDERS_MINUTES = 15; // 15 menit

// Cache untuk menyimpan data per IP
// Key: IP, Value: { count: number, lastOrderTime: timestamp, orders: [{url, timestamp}] }
const cache = new NodeCache({ stdTTL: 86400 }); // 24 jam

// ===== FUNGSI BANTU =====
function getIP(req) {
    return req.headers['x-forwarded-for'] || req.ip || req.connection.remoteAddress || 'unknown';
}

function getCurrentWIB() {
    const now = new Date();
    // WIB = UTC+7
    const wib = new Date(now.getTime() + 7 * 60 * 60 * 1000);
    return wib;
}

function getDateStringWIB() {
    const wib = getCurrentWIB();
    return wib.toISOString().split('T')[0]; // YYYY-MM-DD
}

function getMinutesDiff(t1, t2) {
    const diffMs = Math.abs(t1 - t2);
    return Math.floor(diffMs / (1000 * 60));
}

// ===== FUNGSI UTAMA ZEFAME =====
// (copy dari kode sebelumnya)
// ...

// ===== ROUTE HANDLER =====
module.exports = async (req, res) => {
    const startTime = Date.now();

    const { url } = req.method === 'GET' ? req.query : req.body;

    if (!url) {
        return res.status(400).json({
            status: false,
            statusCode: 400,
            author: '@velz',
            error: 'Parameter "url" (link TikTok) wajib diisi.',
            responseTimeMs: Date.now() - startTime,
            timestamp: new Date().toISOString()
        });
    }

    const ip = getIP(req);
    const today = getDateStringWIB();

    // Ambil data dari cache
    let userData = cache.get(ip);
    if (!userData) {
        userData = { count: 0, lastOrderTime: null, orders: [], date: today };
    }

    // Reset jika hari berbeda
    if (userData.date !== today) {
        userData = { count: 0, lastOrderTime: null, orders: [], date: today };
    }

    // Cek batas harian
    if (userData.count >= MAX_VIDEOS_PER_DAY) {
        return res.status(429).json({
            status: false,
            statusCode: 429,
            author: '@velz',
            error: `Batas harian tercapai (${MAX_VIDEOS_PER_DAY} video per hari). Coba besok lagi.`,
            responseTimeMs: Date.now() - startTime,
            timestamp: new Date().toISOString()
        });
    }

    // Cek delay 15 menit antar order
    if (userData.lastOrderTime) {
        const lastOrder = new Date(userData.lastOrderTime);
        const now = getCurrentWIB();
        const diffMinutes = getMinutesDiff(lastOrder, now);
        if (diffMinutes < DELAY_BETWEEN_ORDERS_MINUTES) {
            const remaining = DELAY_BETWEEN_ORDERS_MINUTES - diffMinutes;
            return res.status(429).json({
                status: false,
                statusCode: 429,
                author: '@velz',
                error: `Harap tunggu ${remaining} menit lagi sebelum order berikutnya.`,
                responseTimeMs: Date.now() - startTime,
                timestamp: new Date().toISOString()
            });
        }
    }

    // Proses order
    try {
        // Panggil fungsi zefame dengan apikey default
        const result = await zefame(url, DEFAULT_API_KEY, 100, 229, true);

        if (result.status) {
            // Update cache
            userData.count += 1;
            userData.lastOrderTime = getCurrentWIB().toISOString();
            userData.orders.push({ url, timestamp: userData.lastOrderTime });
            cache.set(ip, userData);

            const response = {
                status: true,
                statusCode: 200,
                author: '@velz',
                result: {
                    ...result,
                    remaining: MAX_VIDEOS_PER_DAY - userData.count,
                    nextAvailable: new Date(userData.lastOrderTime).getTime() + DELAY_BETWEEN_ORDERS_MINUTES * 60 * 1000,
                },
                responseTimeMs: Date.now() - startTime,
                timestamp: new Date().toISOString()
            };
            res.status(200).json(response);
        } else {
            // Jika gagal, jangan catat sebagai order
            res.status(500).json({
                status: false,
                statusCode: 500,
                author: '@velz',
                error: result.error || 'Gagal memproses order.',
                responseTimeMs: Date.now() - startTime,
                timestamp: new Date().toISOString()
            });
        }
    } catch (error) {
        res.status(500).json({
            status: false,
            statusCode: 500,
            author: '@velz',
            error: error.message || 'Internal server error',
            responseTimeMs: Date.now() - startTime,
            timestamp: new Date().toISOString()
        });
    }
};
