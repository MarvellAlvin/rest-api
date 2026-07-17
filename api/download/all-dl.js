const axios = require('axios');

// Daftar instance Cobalt API (public & alternatif)
const COBALT_INSTANCES = [
    'https://api.cobalt.tools',
    'https://cobalt-api.vercel.app',
    'https://cobalt-api.onrender.com'
];

// Proxy CORS eksternal sebagai fallback terakhir
const CORS_PROXY = 'https://cors.siputzx.my.id/url?url=';

/**
 * Mendownload media menggunakan Cobalt API dengan fallback
 */
async function cobaltDownloader(url) {
    // Coba setiap instance Cobalt secara bergantian
    for (const baseUrl of COBALT_INSTANCES) {
        try {
            const requestUrl = `${baseUrl}/api/json`;
            const { data } = await axios.post(
                requestUrl,
                { url: url },
                {
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json',
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
                        'Origin': 'https://cobalt.tools',
                        'Referer': 'https://cobalt.tools/'
                    },
                    // Timeout agar tidak terlalu lama
                    timeout: 15000
                }
            );

            // Jika Cobalt mengembalikan error
            if (data.status === 'error') {
                throw new Error(data.error?.message || 'Cobalt error');
            }
            if (!data.url) {
                throw new Error('Tidak ada URL download dari Cobalt');
            }

            // Sukses
            return {
                success: true,
                downloadUrl: data.url,
                filename: data.filename || 'download'
            };
        } catch (error) {
            // Jika error 400/403 (bot protection), coba instance berikutnya
            if (error.response?.status === 400 || error.response?.status === 403) {
                continue;
            }
            // Jika error lain (timeout, network), coba instance berikutnya juga
            if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
                continue;
            }
            // Jika error lain yang tidak terduga, lempar agar ditangani di akhir
            throw error;
        }
    }

    // Jika semua instance gagal, coba melalui proxy eksternal
    // (agar bisa melewati bot protection)
    try {
        const proxyUrl = CORS_PROXY + encodeURIComponent(`${COBALT_INSTANCES[0]}/api/json`);
        const { data } = await axios.post(
            proxyUrl,
            { url: url },
            {
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                },
                timeout: 20000
            }
        );

        if (data.status === 'error') {
            throw new Error(data.error?.message || 'Proxy Cobalt error');
        }
        if (!data.url) {
            throw new Error('Tidak ada URL download dari proxy');
        }

        return {
            success: true,
            downloadUrl: data.url,
            filename: data.filename || 'download'
        };
    } catch (error) {
        // Jika semua upaya gagal, lempar error terakhir
        throw new Error('Semua upaya gagal: ' + error.message);
    }
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
    if (urlLower.includes('reddit.com')) return 'reddit';
    if (urlLower.includes('soundcloud.com')) return 'soundcloud';
    if (urlLower.includes('vimeo.com')) return 'vimeo';
    if (urlLower.includes('pinterest.com')) return 'pinterest';
    if (urlLower.includes('twitch.tv')) return 'twitch';
    return 'unknown';
}

/**
 * Deteksi tipe media dari URL
 */
function detectMediaType(url) {
    if (!url) return 'video';
    const lower = url.toLowerCase();
    if (/\.(mp3|m4a|wav|ogg|aac|flac)\b/.test(lower) || /[?&]audio=1/.test(lower)) return 'audio';
    if (/\.(jpg|jpeg|png|webp|gif|bmp|svg|tiff|ico)\b/.test(lower)) return 'image';
    if (/\.(mp4|mov|webm|avi|mkv|flv|3gp|m4v)\b/.test(lower)) return 'video';
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

    try {
        const result = await cobaltDownloader(url);

        const items = [{
            title: result.filename || 'Media',
            url: result.downloadUrl,
            quality: 'Best',
            thumbnail: '',
            type: detectMediaType(result.downloadUrl)
        }];

        const response = {
            status: true,
            statusCode: 200,
            author: '@velz',
            result: {
                items: items,
                metadata: {
                    platform: platform,
                    author: 'Unknown',
                    title: result.filename || 'Media'
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
