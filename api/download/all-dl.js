// api/all-dl.js
const { savefrom } = require('@bochilteam/scraper');

/**
 * Deteksi platform dari URL (hanya untuk metadata)
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
 * Normalisasi hasil dari savefrom ke format items
 */
function normalizeSavefromResult(data) {
    let items = [];

    // Jika data berupa array (beberapa link)
    if (Array.isArray(data)) {
        data.forEach(item => {
            if (item.url) {
                items.push({
                    title: item.title || 'Media',
                    url: item.url,
                    quality: item.quality || 'Best',
                    thumbnail: item.thumbnail || '',
                    type: item.type || 'video'
                });
            }
        });
    } 
    // Jika data berupa objek tunggal
    else if (data && typeof data === 'object') {
        // Cek properti umum
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
        // Jika ada sub-properti seperti 'hd', 'sd', dll.
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
    }

    // Jika masih kosong, coba ambil dari properti 'result' atau 'data'
    if (items.length === 0 && data.result) {
        return normalizeSavefromResult(data.result);
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
        // Panggil savefrom
        const rawResult = await savefrom(url);

        // Normalisasi hasil
        const items = normalizeSavefromResult(rawResult);

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
