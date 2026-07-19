const PlayStoreScraper = require('../../services/playstore');

module.exports = async (req, res) => {
    const startTime = Date.now();
    const { query, limit = 10 } = req.method === 'GET' ? req.query : req.body;

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
        const scraper = new PlayStoreScraper();
        const results = await scraper.search(query, parseInt(limit));
        res.status(200).json({
            status: true,
            statusCode: 200,
            author: '@velz',
            result: { query, total: results.length, items: results },
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
