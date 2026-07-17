// api/all-dl.js
const {
    youtube,
    tiktok,
    instagram,
    twitter,
    facebook,
    savefrom
} = require('@bochilteam/scraper');

/**
 * Deteksi platform dari URL
 */
function detectPlatform(url) {
    const lower = url.toLowerCase();
    if (lower.includes('youtube.com') || lower.includes('youtu.be')) return 'youtube';
    if (lower.includes('tiktok.com')) return 'tiktok';
    if (lower.includes('instagram.com')) return 'instagram';
    if (lower.includes('twitter.com') || lower.includes('x.com')) return 'twitter';
    if (lower.includes('facebook.com') || lower.includes('fb.watch')) return 'facebook';
    return 'unknown';
}

/**
 * Pilih scraper berdasarkan platform
 */
async function getScraper(url, platform) {
    switch (platform) {
        case 'youtube':
            return await youtube(url);
        case 'tiktok':
            return await tiktok(url);
        case 'instagram':
            return await instagram(url);
        case 'twitter':
            return await twitter(url);
        case 'facebook':
            return await facebook(url);
        default:
            // Fallback ke savefrom untuk platform lain
            return await savefrom(url);
    }
}

/**
 * Normalisasi hasil scraper ke format items
 */
function normalizeResult(data, platform) {
    let items = [];

    // Jika data berupa array
    if (Array.isArray(data)) {
        data.forEach(item => {
            if (item.url) {
                items.push({
                    title: item.title || 'Media',
                    url: item.url,
                    quality: item.quality || 'Best',
                    thumbnail: item.thumbnail || '',
                    type: item.type || (item.url.includes('audio') ? 'audio' : 'video')
                });
            }
        });
    } 
    // Jika data berupa objek tunggal
    else if (data && typeof data === 'object') {
        // Coba ambil dari properti umum
        const possibleUrls = [data.url, data.downloadUrl, data.link, data.videoUrl, data.audioUrl];
        const foundUrl = possibleUrls.find(u => u);
        if (foundUrl) {
            items.push({
                title: data.title || 'Media',
                url: foundUrl,
                quality: data.quality || 'Best',
                thumbnail: data.thumbnail || '',
                type: data.type || (foundUrl.includes('audio') ? 'audio' : 'video')
            });
        }

        // Cek sub-properti (hd, sd, audio, dll.)
        for (const key of ['hd', 'sd', 'low', 'high', 'audio']) {
            if (data[key] && typeof data[key] === 'object' && data[key].url) {
                items.push({
                    title: data.title || 'Media',
                    url: data[key].url,
                    quality: key.toUpperCase(),
                    thumbnail: data.thumbnail || '',
                    type: key === 'audio' ? 'audio' : 'video'
                });
            }
        }

        // Jika platform Instagram dan ada properti 'media' (array)
        if (platform === 'instagram' && data.media && Array.isArray(data.media)) {
            data.media.forEach(item => {
                if (item.url) {
                    items.push({
                        title: data.title || 'Media',
                        url: item.url,
                        quality: item.quality || 'Best',
                        thumbnail: item.thumbnail || '',
                        type: item.type || 'video'
                    });
                }
            });
        }
    }

    // Jika masih kosong, coba ambil dari properti 'result' atau 'data'
    if (items.length === 0 && data.result) {
        return normalizeResult(data.result, platform);
    }
    if (items.length === 0 && data.data) {
        return normalizeResult(data.data, platform);
    }

    return items;
}

// ===== Route Handler Express =====
module.exports = async (req, res) => {
    const startTime = Date.now();

    // Ambil url dari query atau body
    const { url } = req.method === 'GET' ? req.query : req.body;

    // Validasi
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

    try {
        // Panggil scraper yang sesuai
        const rawResult = await getScraper(url, platform);

        // Normalisasi hasil
        const items = normalizeResult(rawResult, platform);

        // Jika tidak ada items, lempar error
        if (items.length === 0) {
            throw new Error('Tidak ada media yang ditemukan dari URL ini.');
        }

        // Ambil metadata dari item pertama
        const firstItem = items[0];
        const title = firstItem.title || 'Media';
        const thumbnail = firstItem.thumbnail || '';

        // Format response
        const response = {
            status: true,
            statusCode: 200,
            author: '@velz',
            result: {
                items: items,
                metadata: {
                    platform: platform,
                    author: 'Unknown',
                    title: title
                }
            },
            responseTimeMs: Date.now() - startTime,
            timestamp: new Date().toISOString()
        };

        res.status(200).json(response);
    } catch (error) {
        // Kirim error
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
