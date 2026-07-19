// api/download/ytmp4.js
const fetch = require('node-fetch');

module.exports = async (req, res) => {
    const startTime = Date.now();
    const url = req.method === 'GET' ? req.query.url : req.body.url;

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
        // Coba ytdown.to
        const step1 = await fetch('https://app.ytdown.to/proxy.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'User-Agent': 'Mozilla/5.0',
                'Origin': 'https://app.ytdown.to',
                'Referer': 'https://app.ytdown.to/id2/',
                'X-Requested-With': 'XMLHttpRequest'
            },
            body: `url=${encodeURIComponent(url)}`
        });

        const videoInfo = await step1.json();

        if (!videoInfo.api || videoInfo.api.status !== 'ok') {
            throw new Error('Gagal mengambil info video');
        }

        const { title, mediaItems } = videoInfo.api;
        const videos = mediaItems.filter(v => v.type === 'Video');

        if (videos.length === 0) {
            throw new Error('Tidak ada format video tersedia');
        }

        // Ambil yang terbaik (resolusi tertinggi)
        const target = videos[0];

        const step2 = await fetch('https://app.ytdown.to/proxy.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Origin': 'https://app.ytdown.to',
                'Referer': 'https://app.ytdown.to/id2/'
            },
            body: `url=${encodeURIComponent(target.mediaUrl)}`
        });

        const data = await step2.json();

        res.status(200).json({
            status: true,
            statusCode: 200,
            author: '@velz',
            result: {
                title: title || 'YouTube Video',
                type: 'mp4',
                url: data.api.fileUrl,
                filename: data.api.fileName || `${title}.mp4`,
                size: data.api.fileSize || 'Unknown',
                quality: target.quality || 'Best'
            },
            responseTimeMs: Date.now() - startTime,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        res.status(500).json({
            status: false,
            statusCode: 500,
            author: '@velz',
            error: error.message || 'Gagal mendownload video.',
            responseTimeMs: Date.now() - startTime,
            timestamp: new Date().toISOString()
        });
    }
};
