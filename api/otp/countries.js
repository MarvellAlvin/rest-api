// api/otp/countries.js
const axios = require('axios');
const { BASE_URL, HEADERS } = require('../../services/otp-config');

module.exports = async (req, res) => {
    const startTime = Date.now();
    const { service } = req.method === 'GET' ? req.query : req.body;

    if (!service) {
        return res.status(400).json({
            status: false,
            statusCode: 400,
            author: '@velz',
            error: 'Parameter "service" wajib diisi.',
            responseTimeMs: Date.now() - startTime,
            timestamp: new Date().toISOString()
        });
    }

    try {
        const { data } = await axios.get(`${BASE_URL}/countries?service=${service}`, { headers: HEADERS });
        res.status(200).json({
            status: true,
            statusCode: 200,
            author: '@velz',
            result: data.countries,
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
