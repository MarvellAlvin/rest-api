// api/tempmail/inbox.js
const TempmailV3 = require('../../services/tempmail');

module.exports = async (req, res) => {
    const startTime = Date.now();
    const { visitorId } = req.method === 'GET' ? req.query : req.body;

    if (!visitorId) {
        return res.status(400).json({
            status: false,
            statusCode: 400,
            author: '@velz',
            error: 'Parameter "visitorId" wajib diisi (didapat dari generate).',
            responseTimeMs: Date.now() - startTime,
            timestamp: new Date().toISOString()
        });
    }

    try {
        const tempmail = new TempmailV3();
        const messages = await tempmail.inbox(visitorId);

        if (!messages || messages.length === 0) {
            return res.status(200).json({
                status: true,
                statusCode: 200,
                author: '@velz',
                result: {
                    messages: [],
                    total: 0,
                    note: 'Belum ada pesan masuk. Coba kirim email ke alamat yang di-generate.'
                },
                responseTimeMs: Date.now() - startTime,
                timestamp: new Date().toISOString()
            });
        }

        res.status(200).json({
            status: true,
            statusCode: 200,
            author: '@velz',
            result: {
                messages: messages,
                total: messages.length
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
