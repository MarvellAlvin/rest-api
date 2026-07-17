const axios = require('axios');

module.exports = async (req, res) => {
    const { url } = req.query;

    if (!url) {
        return res.status(400).json({ error: 'Parameter "url" wajib diisi.' });
    }

    try {
        // Ambil file dari socialdownloader dengan header yang diperlukan
        const response = await axios({
            method: 'GET',
            url: url,
            headers: {
                'Referer': 'https://www.socialdownloader.space/',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            responseType: 'stream'
        });

        // Set header dari response asli
        res.setHeader('Content-Type', response.headers['content-type'] || 'application/octet-stream');
        if (response.headers['content-length']) {
            res.setHeader('Content-Length', response.headers['content-length']);
        }
        // Izinkan akses dari mana saja (CORS)
        res.setHeader('Access-Control-Allow-Origin', '*');

        // Stream file ke client
        response.data.pipe(res);
    } catch (error) {
        console.error('Proxy error:', error.message);
        res.status(500).json({
            status: false,
            error: 'Gagal mengambil media: ' + error.message
        });
    }
};
