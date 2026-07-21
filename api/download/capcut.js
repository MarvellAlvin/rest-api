// api/download/capcut.js
const { downloadCapcut } = require('../../services/capcut');

module.exports = async (req, res) => {
    const startTime = Date.now();

    // Ambil URL dari query (GET) atau body (POST)
    const { url } = req.method === 'GET' ? req.query : req.body;

    // Validasi: URL wajib
    if (!url) {
        return res.status(400).json({
            status: false,
            statusCode: 400,
            author: '@velz',
            error: 'Parameter "url" wajib diisi (contoh: https://www.capcut.com/t/...).',
            responseTimeMs: Date.now() - startTime,
            timestamp: new Date().toISOString()
        });
    }

    // Validasi: URL harus valid dan mengandung 'capcut'
    try {
        const parsed = new URL(url);
        if (!parsed.hostname.includes('capcut') && !parsed.hostname.includes('capcut.com')) {
            throw new Error('URL bukan CapCut');
        }
    } catch (_) {
        return res.status(400).json({
            status: false,
            statusCode: 400,
            author: '@velz',
            error: 'URL tidak valid atau bukan URL CapCut.',
            responseTimeMs: Date.now() - startTime,
            timestamp: new Date().toISOString()
        });
    }

    try {
        // Panggil service
        const result = await downloadCapcut(url);

        // Response sukses
        return res.status(200).json({
            status: true,
            statusCode: 200,
            author: '@velz',
            result,
            responseTimeMs: Date.now() - startTime,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        // Error dari service
        console.error('[CapCut] Error:', error.message);
        return res.status(500).json({
            status: false,
            statusCode: 500,
            author: '@velz',
            error: error.message || 'Gagal memproses permintaan',
            responseTimeMs: Date.now() - startTime,
            timestamp: new Date().toISOString()
        });
    }
};
