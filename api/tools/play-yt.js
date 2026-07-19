// api/tools/play-yt.js
const { searchAndDownload } = require('../../services/play-yt');

module.exports = async (req, res) => {
    const startTime = Date.now();
    const { query, type = 'audio' } = req.method === 'GET' ? req.query : req.body;

    if (!query) {
        return res.status(400).json({
            status: false,
            statusCode: 400,
            author: '@velz',
            error: 'Parameter "query" (judul lagu atau URL) wajib diisi.',
            responseTimeMs: Date.now() - startTime,
            timestamp: new Date().toISOString()
        });
    }

    try {
        const result = await searchAndDownload(query, type);
        res.status(200).json({
            status: true,
            statusCode: 200,
            author: '@velz',
            result,
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
