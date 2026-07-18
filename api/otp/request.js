// api/otp/request.js
const axios = require('axios');
const { BASE_URL, HEADERS, pollOtp } = require('../../services/otp-config');

module.exports = async (req, res) => {
    const startTime = Date.now();
    const { service, country } = req.method === 'GET' ? req.query : req.body;

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
        // Request nomor
        const { data } = await axios.post(
            `${BASE_URL}/request_number`,
            { service, country },
            { headers: HEADERS }
        );

        const number = data.number;
        if (!number) {
            throw new Error('Gagal mendapatkan nomor: ' + JSON.stringify(data));
        }

        // Polling OTP (15 detik)
        const otpResult = await pollOtp(number);

        if (otpResult.found) {
            res.status(200).json({
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
            res.status(200).json({
                status: true,
                statusCode: 200,
                author: '@velz',
                result: {
                    number: number,
                    status: 'pending',
                    message: 'OTP belum masuk. Cek manual via endpoint otp.',
                    hint: 'GET /api/otp/otp?number=' + number
                },
                responseTimeMs: Date.now() - startTime,
                timestamp: new Date().toISOString()
            });
        }
    } catch (error) {
        res.status(500).json({
            status: false,
            statusCode: 500,
            author: '@velz',
            error: error.response?.data?.error || error.message,
            responseTimeMs: Date.now() - startTime,
            timestamp: new Date().toISOString()
        });
    }
};
