// api/cctv/search.js
const BadilagCctv = require('../../../services/cctv');

module.exports = async (req, res) => {
    const startTime = Date.now();

    const { q } = req.method === 'GET' ? req.query : req.body;

    if (!q) {
        return res.status(400).json({
            status: false,
            statusCode: 400,
            author: '@velz',
            error: 'Parameter "q" (kata kunci) wajib diisi.',
            responseTimeMs: Date.now() - startTime,
            timestamp: new Date().toISOString()
        });
    }

    if (typeof q !== 'string' || q.length < 2) {
        return res.status(400).json({
            status: false,
            statusCode: 400,
            author: '@velz',
            error: 'Kata kunci minimal 2 karakter.',
            responseTimeMs: Date.now() - startTime,
            timestamp: new Date().toISOString()
        });
    }

    try {
        const scraper = new BadilagCctv();
        const results = await scraper.searchSatker(q);

        return res.status(200).json({
            status: true,
            statusCode: 200,
            author: '@velz',
            result: {
                query: q,
                total: results.length,
                satkers: results
            },
            responseTimeMs: Date.now() - startTime,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('[CCTV Search] Error:', error.message);
        return res.status(500).json({
            status: false,
            statusCode: 500,
            author: '@velz',
            error: error.message || 'Gagal mencari satker',
            responseTimeMs: Date.now() - startTime,
            timestamp: new Date().toISOString()
        });
    }
};
