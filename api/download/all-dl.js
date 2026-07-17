const axios = require('axios');

const SOCIAL_DOWNLOADER_BASE = 'https://www.socialdownloader.space';

/**
 * Mendownload media menggunakan API socialdownloader.space
 */
async function socialDownloader(url) {
    try {
        if (!url.includes('https://')) {
            throw new Error('Invalid url. URL harus menggunakan HTTPS.');
        }

        const { data } = await axios.post(
            `${SOCIAL_DOWNLOADER_BASE}/api/download`,
            { url },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (compatible; SocialDownloaderAPI/1.0)'
                }
            }
        );

        if (!data.success) {
            throw new Error(data.error || 'Gagal mendapatkan data dari socialdownloader.space');
        }

        return data;
    } catch (error) {
        throw new Error(error.response?.data?.error || error.message);
    }
}

/**
 * Mengubah URL media menjadi URL proxy kita sendiri
 * agar frontend tidak perlu repot dengan header
 */
function toProxyUrl(originalUrl) {
    if (!originalUrl) return null;
    // Jika sudah berupa proxy kita, biarkan
    if (originalUrl.startsWith('/api/proxy')) return originalUrl;
    // Kirimkan ke endpoint proxy kita dengan url yang di-encode
    return `/api/proxy?url=${encodeURIComponent(originalUrl)}`;
}

/**
 * Deteksi platform dari URL
 */
function detectPlatform(url) {
    const urlLower = url.toLowerCase();
    if (urlLower.includes('tiktok.com')) return 'tiktok';
    if (urlLower.includes('twitter.com') || urlLower.includes('x.com')) return 'twitter';
    if (urlLower.includes('instagram.com')) return 'instagram';
    if (urlLower.includes('facebook.com') || urlLower.includes('fb.watch')) return 'facebook';
    if (urlLower.includes('youtube.com') || urlLower.includes('youtu.be')) return 'youtube';
    return null;
}

/**
 * Mendeteksi tipe media dari URL (video/audio/image)
 */
function detectMediaType(url) {
    if (!url) return 'video';
    const lower = url.toLowerCase();
    if (/\.(mp3|m4a|wav|ogg|aac|flac)\b/.test(lower) || /[?&]audio=1/.test(lower)) return 'audio';
    if (/\.(jpg|jpeg|png|webp|gif|bmp|svg|tiff|ico)\b/.test(lower)) return 'image';
    if (/\.(mp4|mov|webm|avi|mkv|flv|3gp|m4v)\b/.test(lower)) return 'video';
    if (lower.includes('audio')) return 'audio';
    if (lower.includes('image')) return 'image';
    return 'video';
}

// ===== Route Handler Express =====
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
    if (!platform) {
        return res.status(400).json({
            status: false,
            statusCode: 400,
            author: '@velz',
            error: 'URL tidak dikenali. Support: TikTok, Twitter/X, Instagram, Facebook, YouTube',
            responseTimeMs: Date.now() - startTime,
            timestamp: new Date().toISOString()
        });
    }

    try {
        const result = await socialDownloader(url);

        let items = [];

        // Jika ada images (carousel foto)
        if (result.metadata?.images && result.metadata.images.length > 0) {
            items = result.metadata.images.map((imgUrl, index) => {
                const proxyUrl = toProxyUrl(imgUrl);
                return {
                    title: result.metadata.title || `Image ${index + 1}`,
                    url: proxyUrl,
                    quality: 'Image',
                    thumbnail: proxyUrl,
                    type: 'image'
                };
            });
        } else {
            // Video atau audio
            const downloadUrl = toProxyUrl(result.downloadUrl);
            const audioUrl = toProxyUrl(result.audioUrl);
            const thumbnail = toProxyUrl(result.metadata?.thumbnail) || '';

            if (downloadUrl) {
                const type = detectMediaType(downloadUrl);
                items.push({
                    title: result.metadata?.title || 'Video',
                    url: downloadUrl,
                    quality: 'Video',
                    thumbnail: thumbnail,
                    type: type
                });
            }

            if (audioUrl) {
                items.push({
                    title: (result.metadata?.title || 'Audio') + ' · Audio',
                    url: audioUrl,
                    quality: 'MP3 · Audio',
                    thumbnail: thumbnail,
                    type: 'audio'
                });
            }

            if (items.length === 0) {
                throw new Error('Tidak ada media yang dapat diunduh dari URL ini.');
            }
        }

        const response = {
            status: true,
            statusCode: 200,
            author: '@velz',
            result: {
                items: items,
                metadata: {
                    platform: result.metadata?.platform || platform,
                    author: result.metadata?.author || '',
                    title: result.metadata?.title || ''
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
