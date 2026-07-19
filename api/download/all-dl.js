// api/download/all-dl.js
const axios = require('axios');

const HEADERS = {
    origin: 'https://www.everyvideo.app',
    referer: 'https://www.everyvideo.app/',
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36'
};

async function everyVideoDownloader(url) {
    // 1. Preview metadata
    const preview = await axios.get(
        `https://api.everyvideo.app/api/metadata/preview?url=${encodeURIComponent(url)}`,
        { headers: HEADERS }
    ).then(r => r.data);

    // 2. Ambil format terbaik (tertinggi)
    const formats = preview.video_formats || [];
    const selectedFormat = formats.sort((a, b) => (b.height || 0) - (a.height || 0))[0];
    if (!selectedFormat) throw new Error('Tidak ada format video yang tersedia');

    // 3. Mulai download
    const { job_id } = await axios.post(
        'https://api.everyvideo.app/api/dl/start',
        {
            url,
            format_id: selectedFormat.format_id,
            format: selectedFormat.ext,
            title: preview.title || 'video'
        },
        {
            headers: {
                ...HEADERS,
                'content-type': 'application/json'
            }
        }
    ).then(r => r.data);

    // 4. Dapatkan link download
    const downloadRes = await axios.get(
        `https://api.everyvideo.app/api/dl/${job_id}/download`,
        {
            headers: HEADERS,
            maxRedirects: 0,
            validateStatus: status => status === 302 || status === 200
        }
    );
    const downloadUrl = downloadRes.headers.location || downloadRes.request.res.responseUrl;

    return {
        title: preview.title,
        thumbnail: preview.thumbnail_url,
        duration: preview.duration,
        uploader: preview.uploader,
        viewCount: preview.view_count,
        selectedFormat: {
            quality: selectedFormat.quality,
            resolution: selectedFormat.resolution,
            fileSizeMb: selectedFormat.file_size_mb,
            ext: selectedFormat.ext
        },
        downloadUrl
    };
}

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
        const result = await everyVideoDownloader(url);
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
