// api/tools/spam-otp.js
const axios = require('axios');

const EXTERNAL_API = 'https://api.alwayscodex.my.id/api/tools/spam-otp';
const MAX_COUNT = 5; // batas aman untuk Vercel (5 × 3 detik ≈ 15 detik)

/**
 * Kirim spam OTP secara sequential
 */
async function sendSpamOtp(phone, count) {
    const details = [];
    let success = 0;
    let failed = 0;

    for (let i = 0; i < count; i++) {
        try {
            const response = await axios.post(
                EXTERNAL_API,
                { phone },
                {
                    timeout: 15000,
                    headers: { 'Content-Type': 'application/json' }
                }
            );

            if (response.status === 200 && response.data?.status === true) {
                success++;
                details.push(`✅ ${i + 1}`);
            } else {
                failed++;
                const reason = response.data?.status === false ? 'API returned false' : 'unknown response';
                details.push(`❌ ${i + 1} (${reason})`);
            }
        } catch (error) {
            failed++;
            const errorMsg = error.code === 'ECONNABORTED' ? 'timeout' : error.message;
            details.push(`❌ ${i + 1} (${errorMsg})`);
        }
    }

    return { success, failed, details };
}

module.exports = async (req, res) => {
    const startTime = Date.now();

    const { phone, count: rawCount } = req.method === 'GET' ? req.query : req.body;

    // Validasi phone
    if (!phone) {
        return res.status(400).json({
            status: false,
            statusCode: 400,
            author: '@velz',
            error: 'Parameter "phone" wajib diisi (contoh: 6281234567890).',
            responseTimeMs: Date.now() - startTime,
            timestamp: new Date().toISOString()
        });
    }

    if (!/^[0-9]{10,15}$/.test(phone)) {
        return res.status(400).json({
            status: false,
            statusCode: 400,
            author: '@velz',
            error: 'Nomor telepon tidak valid. Harus berupa angka 10-15 digit (contoh: 6281234567890).',
            responseTimeMs: Date.now() - startTime,
            timestamp: new Date().toISOString()
        });
    }

    // Validasi count
    let count = parseInt(rawCount, 10);
    if (isNaN(count) || count < 1) {
        count = 1;
    } else if (count > MAX_COUNT) {
        count = MAX_COUNT;
    }

    try {
        const result = await sendSpamOtp(phone, count);

        return res.status(200).json({
            status: true,
            statusCode: 200,
            author: '@velz',
            result: {
                phone,
                totalRequested: count,
                success: result.success,
                failed: result.failed,
                details: result.details
            },
            responseTimeMs: Date.now() - startTime,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('[Spam OTP] Error:', error.message);
        return res.status(500).json({
            status: false,
            statusCode: 500,
            author: '@velz',
            error: error.message || 'Internal server error',
            responseTimeMs: Date.now() - startTime,
            timestamp: new Date().toISOString()
        });
    }
};
