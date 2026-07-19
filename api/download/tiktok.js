// api/download/tiktok.js
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
        // Pakai EveryVideo API
        const response = await fetch(`https://api.everyvideo.app/api/metadata/preview?url=${encodeURIComponent(url)}`, {
            headers: {
                'origin': 'https://www.everyvideo.app',
                'referer': 'https://www.everyvideo.app/',
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        const data = await response.json();

        if (!data || !data.video_formats || data.video_formats.length === 0) {
            throw new Error('Tidak ada format video ditemukan');
        }

        // Ambil format terbaik
        const bestFormat = data.video_formats.sort((a, b) => (b.height || 0) - (a.height || 0))[0];
        
        // Coba dapatkan link download
        let downloadUrl = bestFormat.url;
        if (!downloadUrl) {
            const { job_id } = await fetch("https://api.everyvideo.app/api/dl/start", {
                method: "POST",
                headers: {
                    "origin": "https://www.everyvideo.app",
                    "referer": "https://www.everyvideo.app/",
                    "user-agent": "Mozilla/5.0",
                    "content-type": "application/json"
                },
                body: JSON.stringify({
                    url,
                    format_id: bestFormat.format_id,
                    format: bestFormat.ext,
                    title: data.title
                })
            }).then(r => r.json());
            downloadUrl = `https://api.everyvideo.app/api/dl/${job_id}/download`;
        }

        res.status(200).json({
            status: true,
            statusCode: 200,
            author: '@velz',
            result: {
                title: data.title || 'TikTok Video',
                type: 'mp4',
                url: downloadUrl,
                quality: bestFormat.quality || 'Best',
                thumbnail: data.thumbnail_url || '',
                duration: data.duration || 0,
                author: data.uploader || 'Unknown',
                viewCount: data.view_count || 0
            },
            responseTimeMs: Date.now() - startTime,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        res.status(500).json({
            status: false,
            statusCode: 500,
            author: '@velz',
            error: error.message || 'Gagal mendownload TikTok.',
            responseTimeMs: Date.now() - startTime,
            timestamp: new Date().toISOString()
        });
    }
};
