// api/tools/spam-otp.js
const axios = require('axios');

const EXTERNAL_API = 'https://api.alwayscodex.my.id/api/tools/spam-otp';
const MAX_COUNT = 5;

/**
 * Kirim spam OTP secara sequential dengan detail per attempt
 * @param {string} phone - Nomor telepon tujuan
 * @param {number} count - Jumlah request
 * @returns {Promise<{ success: number, failed: number, details: object[] }>}
 */
async function sendSpamOtp(phone, count) {
    const details = [];
    let success = 0;
    let failed = 0;

    for (let i = 0; i < count; i++) {
        const attempt = i + 1;
        const startTime = Date.now();

        let httpStatus = null;
        let responseData = null;
        let error = null;
        let isSuccess = false;

        try {
            const res = await axios.post(
                EXTERNAL_API,
                { phone },
                {
                    timeout: 15000,
                    headers: { 'Content-Type': 'application/json' }
                }
            );

            httpStatus = res.status;
            responseData = res.data;
            isSuccess = (res.status === 200 && res.data?.status === true);

            if (isSuccess) {
                success++;
            } else {
                failed++;
            }
        } catch (err) {
            httpStatus = err.response?.status || null;
            responseData = err.response?.data || null;
            error = err.code === 'ECONNABORTED' ? 'timeout' : err.message;
            failed++;
        }

        const durationMs = Date.now() - startTime;

        details.push({
            attempt,
            success: isSuccess,
            httpStatus,
            durationMs,
            response: responseData,
            error
        });
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
