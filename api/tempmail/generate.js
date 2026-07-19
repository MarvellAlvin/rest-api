// api/tempmail/generate.js
const Tempmail = require('../../services/tempmail');

module.exports = async (req, res) => {
    const startTime = Date.now();

    const { length = 10 } = req.method === 'GET' ? req.query : req.body;

    const lengthNum = parseInt(length);
    if (isNaN(lengthNum) || lengthNum < 5 || lengthNum > 20) {
        return res.status(400).json({
            status: false,
            statusCode: 400,
            author: '@velz',
            error: 'Parameter "length" harus angka antara 5–20.',
            responseTimeMs: Date.now() - startTime,
            timestamp: new Date().toISOString()
        });
    }

    try {
        const tempmail = new Tempmail();
        const result = await tempmail.generate(lengthNum);

        res.status(200).json({
            status: true,
            statusCode: 200,
            author: '@velz',
            result: {
                email: result.email,
                note: 'Gunakan email ini untuk cek inbox di /api/tempmail/inbox'
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
