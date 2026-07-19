const { scrapeDetik } = require('../../services/detikcom');

module.exports = async (req, res) => {
    const startTime = Date.now();
    const { query, content = 'false' } = req.method === 'GET' ? req.query : req.body;

    if (!query) {
        return res.status(400).json({
            status: false,
            statusCode: 400,
            author: '@velz',
            error: 'Parameter "query" wajib diisi.',
            responseTimeMs: Date.now() - startTime,
            timestamp: new Date().toISOString()
        });
    }

    try {
        const fetchContent = content === 'true' || content === '1';
        const result = await scrapeDetik(query, fetchContent);
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
