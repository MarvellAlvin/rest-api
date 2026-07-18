const CineSubz = require('../../services/cinesubs');

module.exports = async (req, res) => {
    const startTime = Date.now();
    const { dataPost, dataNume, dataType } = req.method === 'GET' ? req.query : req.body;

    if (!dataPost || !dataNume || !dataType) {
        return res.status(400).json({
            status: false,
            statusCode: 400,
            author: '@velz',
            error: 'Parameter "dataPost", "dataNume", dan "dataType" wajib diisi. Dapatkan dari endpoint streaming.',
            responseTimeMs: Date.now() - startTime,
            timestamp: new Date().toISOString()
        });
    }

    try {
        const result = await CineSubz.getStreamingUrl(dataPost, dataNume, dataType);
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
