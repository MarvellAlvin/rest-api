// api/all-dl.js
const axios = require('axios');
const {
    savefrom,
    youtube,
    tiktok,
    instagram,
    twitter,
    facebook
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

    // Cek apakah data memiliki properti 'url' (video tunggal)
    if (data.url) {
        items.push({
            title: data.title || 'Media',
            url: data.url,
            quality: data.quality || 'Best',
            thumbnail: data.thumbnail || '',
            type: 'video'
        });
    }

    // Cek jika ada 'urls' (array of videos)
    if (data.urls && Array.isArray(data.urls)) {
        data.urls.forEach(item => {
            items.push({
                title: item.title || data.title || 'Media',
                url: item.url,
                quality: item.quality || 'Best',
                thumbnail: item.thumbnail || data.thumbnail || '',
                type: 'video'
            });
        });
    }

    // Cek jika ada 'audio' (audio stream)
    if (data.audio) {
        items.push({
            title: (data.title || 'Audio') + ' · Audio',
            url: data.audio,
            quality: 'MP3 · Audio',
            thumbnail: data.thumbnail || '',
            type: 'audio'
        });
    }

    // Jika masih kosong, coba ambil dari properti lain
    if (items.length === 0) {
        // Coba ambil dari 'result' atau 'data'
        const result = data.result || data.data || data;
        if (typeof result === 'object' && result !== null) {
            for (const key of ['url', 'downloadUrl', 'link', 'videoUrl', 'audioUrl']) {
                if (result[key]) {
                    items.push({
                        title: result.title || 'Media',
                        url: result[key],
                        quality: 'Best',
                        thumbnail: result.thumbnail || '',
                        type: key.includes('audio') ? 'audio' : 'video'
                    });
                    break;
                }
            }
        }
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

    // Deteksi platform
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

        // Ambil metadata
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
        // Jika error, coba fallback ke savefrom (untuk platform yang tidak didukung)
        if (platform === 'unknown') {
            try {
                const fallbackResult = await savefrom(url);
                const fallbackItems = normalizeResult(fallbackResult, 'savefrom');
                if (fallbackItems.length > 0) {
                    const response = {
                        status: true,
                        statusCode: 200,
                        author: '@velz',
                        result: {
                            items: fallbackItems,
                            metadata: {
                                platform: 'savefrom',
                                author: 'Unknown',
                                title: fallbackItems[0]?.title || 'Media'
                            }
                        },
                        responseTimeMs: Date.now() - startTime,
                        timestamp: new Date().toISOString()
                    };
                    return res.status(200).json(response);
                }
            } catch (fallbackError) {
                // Jika fallback juga gagal, lanjut ke error utama
            }
        }

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
