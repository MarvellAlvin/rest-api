const axios = require('axios');

const BASE_HEADERS = {
    'user-agent': 'Neo/1.0',
    'referer': 'https://getindevice.com/'
};

/**
 * Deteksi platform dari URL
 */
function detectPlatform(url) {
    const lower = url.toLowerCase();
    if (lower.includes('tiktok.com') || lower.includes('vt.tiktok.com')) return 'tiktok';
    if (lower.includes('twitter.com') || lower.includes('x.com')) return 'twitter';
    if (lower.includes('facebook.com') || lower.includes('fb.watch')) return 'facebook';
    if (lower.includes('instagram.com')) return 'instagram';
    if (lower.includes('pinterest.com')) return 'pinterest';
    if (lower.includes('linkedin.com')) return 'linkedin';
    if (lower.includes('snapchat.com')) return 'snapchat';
    if (lower.includes('threads.net')) return 'threads';
    if (lower.includes('tumblr.com')) return 'tumblr';
    return 'unknown';
}

/**
 * Fungsi utama Snapsaver downloader
 */
async function snapsaver(url) {
    try {
        // 1. Ambil token
        const { data: tokenData } = await axios.get(
            `https://getindevice.com/api/token/?_t=${Date.now()}`,
            { headers: BASE_HEADERS }
        );

        // 2. Kirim request download
        const { data } = await axios.post(
            'https://getindevice.com/api/download/',
            { url },
            {
                headers: {
                    ...BASE_HEADERS,
                    'content-type': 'application/json',
                    'x-request-token': tokenData.token
                }
            }
        );

        return data;
    } catch (error) {
        throw new Error(error.response?.data?.message || error.response?.data || error.message);
    }
}

/**
 * Normalisasi hasil dari snapsaver ke format items
 */
function normalizeResult(data, platform) {
    const items = [];

    // Jika response memiliki properti 'medias' (array)
    if (data.medias && Array.isArray(data.medias)) {
        data.medias.forEach(media => {
            items.push({
                title: data.title || 'Media',
                url: media.url || media.downloadUrl || '',
                quality: media.quality || media.resolution || 'Best',
                thumbnail: media.thumbnail || data.thumbnail || '',
                type: media.type || (media.url && media.url.includes('audio') ? 'audio' : 'video')
            });
        });
    }
    // Jika hanya satu media
    else if (data.url || data.downloadUrl) {
        items.push({
            title: data.title || 'Media',
            url: data.url || data.downloadUrl || '',
            quality: data.quality || 'Best',
            thumbnail: data.thumbnail || '',
            type: data.type || 'video'
        });
    }

    // Jika masih kosong, coba ambil dari properti lain
    if (items.length === 0 && data.data) {
        return normalizeResult(data.data, platform);
    }

    return items;
}

// ===== ROUTE HANDLER EXPRESS =====
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

    const platform = detectPlatform(url);

    if (platform === 'unknown') {
        return res.status(400).json({
            status: false,
            statusCode: 400,
            author: '@velz',
            error: 'URL tidak dikenali. Support: TikTok, Twitter, Facebook, Instagram, Pinterest, LinkedIn, Snapchat, Threads, Tumblr',
            responseTimeMs: Date.now() - startTime,
            timestamp: new Date().toISOString()
        });
    }

    try {
        const rawResult = await snapsaver(url);

        // Cek apakah request berhasil
        if (rawResult.status === false) {
            throw new Error(rawResult.message || 'Gagal mendapatkan media');
        }

        const items = normalizeResult(rawResult, platform);

        if (items.length === 0) {
            throw new Error('Tidak ada media yang ditemukan dari URL ini.');
        }

        // Ambil metadata
        const firstItem = items[0];
        const title = firstItem.title || 'Media';
        const thumbnail = firstItem.thumbnail || '';

        const response = {
            status: true,
            statusCode: 200,
            author: '@velz',
            result: {
                items: items,
                metadata: {
                    platform: platform,
                    title: title,
                    thumbnail: thumbnail
                }
            },
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
