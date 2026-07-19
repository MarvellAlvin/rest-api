// api/tools/obf.js
const { obfuscateCode } = require('../../services/obf');

module.exports = async (req, res) => {
    const startTime = Date.now();
    const { code, level = 'medium' } = req.method === 'GET' ? req.query : req.body;

    if (!code) {
        return res.status(400).json({
            status: false,
            statusCode: 400,
            author: '@velz',
            error: 'Parameter "code" (source code JavaScript) wajib diisi.',
            responseTimeMs: Date.now() - startTime,
            timestamp: new Date().toISOString()
        });
    }

    try {
        const result = obfuscateCode(code, level);
        res.status(200).json({
            status: true,
            statusCode: 200,
            author: '@velz',
            result: { originalLength: code.length, obfuscatedLength: result.length, level, code: result },
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
