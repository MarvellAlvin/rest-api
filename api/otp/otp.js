// api/otp/otp.js
const axios = require('axios');
const { BASE_URL, HEADERS } = require('../../services/otp-config');

module.exports = async (req, res) => {
    const startTime = Date.now();
    const { number } = req.method === 'GET' ? req.query : req.body;

    if (!number) {
        return res.status(400).json({
            status: false,
            statusCode: 400,
            author: '@velz',
            error: 'Parameter "number" wajib diisi.',
            responseTimeMs: Date.now() - startTime,
            timestamp: new Date().toISOString()
        });
    }

    try {
        const { data } = await axios.get(`${BASE_URL}/latest_otp?number=${number}`, { headers: HEADERS });
        if (data.has_otp === true) {
            res.status(200).json({
                status: true,
                statusCode: 200,
                author: '@velz',
                result: {
                    number: number,
                    has_otp: true,
                    otp: data.otp || data.sms || 'OTP ditemukan',
                    raw: data
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
                    has_otp: false,
                    message: 'OTP belum masuk. Coba lagi nanti.'
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
