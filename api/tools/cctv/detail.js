// api/tools/cctv/detail.js
const BadilagCctv = require('../../../services/cctv');

module.exports = async (req, res) => {
    const startTime = Date.now();

    const { id } = req.method === 'GET' ? req.query : req.body;

    if (!id) {
        return res.status(400).json({
            status: false,
            statusCode: 400,
            author: '@velz',
            error: 'Parameter "id" (ID satker) wajib diisi.',
            responseTimeMs: Date.now() - startTime,
            timestamp: new Date().toISOString()
        });
    }

    if (typeof id !== 'string' || id.length !== 32) {
        return res.status(400).json({
            status: false,
            statusCode: 400,
            author: '@velz',
            error: 'ID satker tidak valid (harus 32 karakter).',
            responseTimeMs: Date.now() - startTime,
            timestamp: new Date().toISOString()
        });
    }

    try {
        const scraper = new BadilagCctv();
        const detail = await scraper.getCCTV(id);

        return res.status(200).json({
            status: true,
            statusCode: 200,
            author: '@velz',
            result: {
                id: detail.id,
                satker: detail.satker,
                totalCCTV: detail.cctvs.length,
                cctvs: detail.cctvs
            },
            responseTimeMs: Date.now() - startTime,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('[CCTV Detail] Error:', error.message);
        return res.status(500).json({
            status: false,
            statusCode: 500,
            author: '@velz',
            error: error.message || 'Gagal mengambil detail CCTV',
            responseTimeMs: Date.now() - startTime,
            timestamp: new Date().toISOString()
        });
    }
};
