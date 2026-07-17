const { searchpinterest } = require('@zxvorx/scrape');

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
        const result = await searchpinterest(query, parseInt(limit));
        
        const items = Array.isArray(result) ? result.map(item => ({
            title: item.title || 'Pinterest Image',
            imageUrl: item.imageUrl || item.url,
            sourceUrl: item.sourceUrl || '',
            description: item.description || ''
        })) : [];

        const response = {
            status: true,
            statusCode: 200,
            author: '@velz',
            result: { items, total: items.length },
            responseTimeMs: Date.now() - startTime,
            timestamp: new Date().toISOString()
        };

        res.status(200).json(response);
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
