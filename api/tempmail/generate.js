// api/tempmail/generate.js
const TempmailV3 = require('../../services/tempmail');

module.exports = async (req, res) => {
    const startTime = Date.now();
    const { expire = 10 } = req.method === 'GET' ? req.query : req.body;

    const expireNum = parseInt(expire);
    if (isNaN(expireNum) || expireNum <= 0) {
        return res.status(400).json({
            status: false,
            statusCode: 400,
            author: '@velz',
            error: 'Parameter "expire" harus angka positif (menit). Contoh: ?expire=10',
            responseTimeMs: Date.now() - startTime,
            timestamp: new Date().toISOString()
        });
    }

    try {
        const tempmail = new TempmailV3();
        const result = await tempmail.generate(expireNum);

        res.status(200).json({
            status: true,
            statusCode: 200,
            author: '@velz',
            result: {
                email: result.email,
                visitorId: result.visitorId,
                expireMinutes: expireNum,
                note: 'Simpan visitorId untuk mengecek inbox.'
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
