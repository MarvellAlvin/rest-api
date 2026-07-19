// api/tempmail/inbox.js 
const { Tempmail } = require('../../services/tempmail');

module.exports = async (req, res) => {
    const startTime = Date.now();

    const { email } = req.method === 'GET' ? req.query : req.body;

    if (!email) {
        return res.status(400).json({
            status: false,
            statusCode: 400,
            author: '@velz',
            error: 'Parameter "email" wajib diisi.',
            responseTimeMs: Date.now() - startTime,
            timestamp: new Date().toISOString()
        });
    }

    // Validasi format email sederhana
    if (!email.includes('@') || !email.includes('.')) {
        return res.status(400).json({
            status: false,
            statusCode: 400,
            author: '@velz',
            error: 'Format email tidak valid.',
            responseTimeMs: Date.now() - startTime,
            timestamp: new Date().toISOString()
        });
    }

    try {
        const tempmail = new Tempmail();
        const result = await tempmail.inbox(email);

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
            error: error.message || 'Gagal mengambil inbox.',
            responseTimeMs: Date.now() - startTime,
            timestamp: new Date().toISOString()
        });
    }
};
