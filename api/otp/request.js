// api/otp/request.js
const axios = require('axios');
const { BASE_URL, HEADERS } = require('../../services/otp-config');

/**
 * Fungsi untuk polling OTP secara otomatis
 * Maksimal 5 kali percobaan, interval 5 detik (total 25 detik)
 */
async function pollOtp(number, maxAttempts = 5, intervalMs = 5000) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        await new Promise(resolve => setTimeout(resolve, intervalMs));
        try {
            const { data } = await axios.get(`${BASE_URL}/latest_otp?number=${number}`, { headers: HEADERS });
            if (data.has_otp === true) {
                return {
                    found: true,
                    otp: data.otp || data.sms || 'OTP ditemukan',
                    raw: data
                };
            }
        } catch (e) {
            // Abaikan error, lanjutkan polling
        }
    }
    return { found: false };
}

module.exports = async (req, res) => {
    const startTime = Date.now();

    // Ambil parameter dari GET (query) atau POST (body)
    const { service, country } = req.method === 'GET' ? req.query : req.body;

    // Validasi: service dan country wajib diisi
    if (!service || !country) {
        return res.status(400).json({
            status: false,
            statusCode: 400,
            author: '@velz',
            error: 'Parameter "service" dan "country" wajib diisi.',
            responseTimeMs: Date.now() - startTime,
            timestamp: new Date().toISOString()
        });
    }

    try {
        // 1. Request nomor ke API
        const { data } = await axios.post(
            `${BASE_URL}/request_number`,
            { service, country },
            { headers: HEADERS }
        );

        const number = data.number;
        if (!number) {
            throw new Error('Gagal mendapatkan nomor: ' + JSON.stringify(data));
        }

        // 2. Polling OTP selama 25 detik (5x5 detik)
        const otpResult = await pollOtp(number);

        if (otpResult.found) {
            // OTP berhasil didapat
            return res.status(200).json({
                status: true,
                statusCode: 200,
                author: '@velz',
                result: {
                    number: number,
                    status: 'otp_found',
                    otp: otpResult.otp,
                    raw: otpResult.raw
                },
                responseTimeMs: Date.now() - startTime,
                timestamp: new Date().toISOString()
            });
        } else {
            // OTP belum masuk dalam 25 detik
            return res.status(200).json({
                status: true,
                statusCode: 200,
                author: '@velz',
                result: {
                    number: number,
                    status: 'pending',
                    message: 'OTP belum masuk dalam 25 detik. Silakan cek manual melalui endpoint /api/otp/otp.',
                    hint: `GET /api/otp/otp?number=${number}`
                },
                responseTimeMs: Date.now() - startTime,
                timestamp: new Date().toISOString()
            });
        }

    } catch (error) {
        // Tangani error
        return res.status(500).json({
            status: false,
            statusCode: 500,
            author: '@velz',
            error: error.response?.data?.error || error.message || 'Internal server error',
            responseTimeMs: Date.now() - startTime,
            timestamp: new Date().toISOString()
        });
    }
};
