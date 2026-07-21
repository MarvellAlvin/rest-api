// api/tools/cctv/list.js
const BadilagCctv = require('../../../services/cctv');

module.exports = async (req, res) => {
    const startTime = Date.now();

    try {
        const scraper = new BadilagCctv();
        const satkers = await scraper.getSatkerList();

        return res.status(200).json({
            status: true,
            statusCode: 200,
            author: '@velz',
            result: {
                total: satkers.length,
                satkers
            },
            responseTimeMs: Date.now() - startTime,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('[CCTV List] Error:', error.message);
        return res.status(500).json({
            status: false,
            statusCode: 500,
            author: '@velz',
            error: error.message || 'Gagal mengambil daftar satker',
            responseTimeMs: Date.now() - startTime,
            timestamp: new Date().toISOString()
        });
    }
};
