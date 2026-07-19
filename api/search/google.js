const { generateGoogleSearchQuery } = require('../../services/google');

module.exports = async (req, res) => {
    const startTime = Date.now();
    const { domain, feature } = req.method === 'GET' ? req.query : req.body;

    if (!domain || !feature) {
        return res.status(400).json({
            status: false,
            statusCode: 400,
            author: '@velz',
            error: 'Parameter "domain" dan "feature" wajib diisi.',
            responseTimeMs: Date.now() - startTime,
            timestamp: new Date().toISOString()
        });
    }

    try {
        const url = generateGoogleSearchQuery(domain, feature);
        res.status(200).json({
            status: true,
            statusCode: 200,
            author: '@velz',
            result: { domain, feature, searchUrl: url, note: 'Buka URL ini di browser untuk melihat hasil pencarian Google Dork.' },
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
