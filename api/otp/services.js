// api/otp/services.js
const axios = require('axios');
const { BASE_URL, HEADERS } = require('../../services/otp-config');

module.exports = async (req, res) => {
    const startTime = Date.now();

    try {
        const { data } = await axios.get(`${BASE_URL}/services`, { headers: HEADERS });
        res.status(200).json({
            status: true,
            statusCode: 200,
            author: '@velz',
            result: data.services,
            responseTimeMs: Date.now() - startTime,
            timestamp: new Date().toISOString()
        });
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
