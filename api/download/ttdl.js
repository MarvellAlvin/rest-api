const { ttdl } = require('@zxvorx/scrape');

module.exports = async (req, res) => {
    const startTime = Date.now();
    const { url } = req.method === 'GET' ? req.query : req.body;

    if (!url) {
        return res.status(400).json({
            status: false,
            statusCode: 400,
            author: '@velz',
            error: 'Parameter "url" wajib diisi.',
            responseTimeMs: Date.now() - startTime,
            timestamp: new Date().toISOString()
        });
    }

    try {
        const result = await ttdl(url);
        
        // Normalisasi hasil
        const items = Array.isArray(result) ? result.map(item => ({
            title: item.title || 'TikTok Video',
            url: item.url || item.downloadUrl,
            quality: item.quality || 'Best',
            thumbnail: item.thumbnail || '',
            type: 'video'
        })) : [];

        if (items.length === 0) {
            throw new Error('Tidak ada video yang ditemukan.');
        }

        const response = {
            status: true,
            statusCode: 200,
            author: '@velz',
            result: { items },
            responseTimeMs: Date.now() - startTime,
            timestamp: new Date().toISOString()
        };

        res.status(200).json(response);
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
