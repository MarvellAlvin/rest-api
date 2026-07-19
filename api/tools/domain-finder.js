// api/tools/domain-finder.js
const { getCRT } = require('../../services/domain-finder');

module.exports = async (req, res) => {
    const startTime = Date.now();
    const { domain } = req.method === 'GET' ? req.query : req.body;

    if (!domain) {
        return res.status(400).json({
            status: false,
            statusCode: 400,
            author: '@velz',
            error: 'Parameter "domain" wajib diisi.',
            responseTimeMs: Date.now() - startTime,
            timestamp: new Date().toISOString()
        });
    }

    try {
        const results = await getCRT(domain);
        res.status(200).json({
            status: true,
            statusCode: 200,
            author: '@velz',
            result: {
                domain,
                total: results.length,
                certificates: results
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
