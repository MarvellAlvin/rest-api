// api/proxy.js
const axios = require('axios');

module.exports = async (req, res) => {
    // 1. Ambil URL dari query parameter
    const targetUrl = req.query.url;

    if (!targetUrl) {
        return res.status(400).json({ error: 'Parameter "url" wajib diisi.' });
    }

    try {
        // 2. Lakukan request ke URL tujuan dengan header yang sesuai
        const response = await axios({
            method: 'GET',
            url: decodeURIComponent(targetUrl), // Pastikan URL didecode
            headers: {
                // Header penting agar request dianggap sah oleh socialdownloader.space
                'Referer': 'https://www.socialdownloader.space/',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            // Penting: kita ingin menerima response sebagai stream (aliran data)
            responseType: 'stream'
        });

        // 3. Set header response dari server tujuan ke client
        res.setHeader('Content-Type', response.headers['content-type'] || 'application/octet-stream');
        if (response.headers['content-length']) {
            res.setHeader('Content-Length', response.headers['content-length']);
        }
        // Izinkan akses dari mana saja (CORS)
        res.setHeader('Access-Control-Allow-Origin', '*');

        // 4. Stream (alirkan) data dari server tujuan ke client
        response.data.pipe(res);
    } catch (error) {
        console.error('Proxy error:', error.message);
        // Jika ada error, kirim response error yang jelas
        res.status(500).json({
            status: false,
            error: 'Gagal mengambil media: ' + error.message
        });
    }
};
