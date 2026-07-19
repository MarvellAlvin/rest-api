const { scrapeJadwalBola } = require('../../services/jadwal-bola');

module.exports = async (req, res) => {
    const startTime = Date.now();
    const { date, timezone = 'Asia/Jakarta' } = req.method === 'GET' ? req.query : req.body;

    try {
        const result = await scrapeJadwalBola(date, timezone);
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
