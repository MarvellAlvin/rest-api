const CineSubz = require('../../services/cinesubs');

module.exports = async (req, res) => {
    const startTime = Date.now();
    const { slug, page = 1 } = req.method === 'GET' ? req.query : req.body;

    if (!slug) {
        return res.status(400).json({
            status: false,
            statusCode: 400,
            author: '@velz',
            error: 'Parameter "slug" wajib diisi. Contoh: sinhala, english, hindi',
            responseTimeMs: Date.now() - startTime,
            timestamp: new Date().toISOString()
        });
    }

    try {
        const result = await CineSubz.getLanguage(slug, parseInt(page));
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
