// api/tempmail/generate.js
const Tempmail1sec = require('../../services/tempmail');

module.exports = async (req, res) => {
    const startTime = Date.now();
    const { count = 1 } = req.method === 'GET' ? req.query : req.body;

    const countNum = parseInt(count);
    if (isNaN(countNum) || countNum < 1 || countNum > 10) {
        return res.status(400).json({
            status: false,
            statusCode: 400,
            author: '@velz',
            error: 'Parameter "count" harus angka antara 1–10.',
            responseTimeMs: Date.now() - startTime,
            timestamp: new Date().toISOString()
        });
    }

    try {
        const tempmail = new Tempmail1sec();
        const emails = await tempmail.generate(countNum);

        res.status(200).json({
            status: true,
            statusCode: 200,
            author: '@velz',
            result: {
                emails: Array.isArray(emails) ? emails : [emails],
                total: Array.isArray(emails) ? emails.length : 1,
                note: 'Gunakan email ini untuk cek inbox di /api/tempmail1sec/inbox'
            },
            responseTimeMs: Date.now() - startTime,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            status: false,
            statusCode: 500,
            author: '@velz',
            error: error.message,
            responseTimeMs: Date.now() - startTime,
            timestamp: new Date().toISOString()
        });
    }
};
