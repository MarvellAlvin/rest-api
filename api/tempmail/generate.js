// api/tempmail/generate.js
const { Tempmail } = require('../../services/tempmail');

module.exports = async (req, res) => {
    const startTime = Date.now();

    const { length = 10 } = req.method === 'GET' ? req.query : req.body;

    // Validasi length
    const lengthNum = parseInt(length);
    if (isNaN(lengthNum) || lengthNum <= 0) {
        return res.status(400).json({
            status: false,
            statusCode: 400,
            author: '@velz',
            error: 'Parameter "length" harus berupa angka positif (contoh: 10).',
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
            result: result,
            responseTimeMs: Date.now() - startTime,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            status: false,
            statusCode: 500,
            author: '@velz',
            error: error.message || 'Gagal generate email.',
            responseTimeMs: Date.now() - startTime,
            timestamp: new Date().toISOString()
        });
    }
};
