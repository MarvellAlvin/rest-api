// api/all-dl.js
const axios = require('axios');

// Gunakan public Cobalt API instance
// PENTING: Instance ini memiliki rate limit dan proteksi bot.
// Untuk penggunaan production, sangat disarankan untuk self-host Cobalt sendiri.
// Panduan: https://github.com/imputnet/cobalt/blob/main/docs/run-an-instance.md
const COBALT_API_URL = 'https://api.cobalt.tools/api/json';

/**
 * Mendownload media menggunakan Cobalt API
 * Dokumentasi: https://github.com/imputnet/cobalt/blob/main/docs/api.md
 */
async function cobaltDownloader(url) {
    try {
        // Validasi URL
        if (!url.includes('https://')) {
            throw new Error('Invalid url. URL harus menggunakan HTTPS.');
        }

        // Request ke Cobalt API
        // Body: { url: "..." }
        // Header: Accept: application/json, Content-Type: application/json
        const { data } = await axios.post(
            COBALT_API_URL,
            { url: url },
            {
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (compatible; CobaltDownloader/1.0)'
                }
            }
        );

        // Cek apakah Cobalt mengembalikan error
        if (data.status === 'error') {
            throw new Error(data.error?.message || 'Gagal memproses URL di Cobalt');
        }

        // Cobalt mengembalikan { status: "tunnel", url: "..." } atau { status: "redirect", url: "..." }
        // Kita akan mengambil URL download dari field 'url'
        if (!data.url) {
            throw new Error('Cobalt tidak mengembalikan URL download');
        }

        return {
            success: true,
            downloadUrl: data.url,
            filename: data.filename || 'download',
            // Cobalt tidak mengembalikan metadata seperti title/thumbnail secara langsung
            // Tapi kita bisa mengambil dari response jika ada
        };
    } catch (error) {
        // Tangani error dari Cobalt atau dari axios
        throw new Error(error.response?.data?.error?.message || error.message);
    }
}

/**
 * Mendeteksi platform dari URL (hanya untuk informasi di metadata)
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
 * Mendeteksi tipe media dari URL (hanya untuk informasi di metadata)
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

    // Ambil parameter url dari query (GET) atau body (POST)
    const { url } = req.method === 'GET' ? req.query : req.body;

    // Validasi URL
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

    // Deteksi platform untuk metadata
    const platform = detectPlatform(url);

    try {
        // Panggil Cobalt API
        const result = await cobaltDownloader(url);

        // Siapkan items array (Cobalt biasanya hanya mengembalikan 1 file)
        const items = [{
            title: result.filename || 'Media',
            url: result.downloadUrl,
            quality: 'Best',
            thumbnail: '', // Cobalt tidak menyediakan thumbnail di response sederhana
            type: detectMediaType(result.downloadUrl)
        }];

        // Format respons sesuai dengan yang kamu inginkan
        const response = {
            status: true,
            statusCode: 200,
            author: '@velz',
            result: {
                items: items,
                metadata: {
                    platform: platform,
                    author: 'Unknown', // Cobalt tidak mengembalikan author
                    title: result.filename || 'Media'
                }
            },
            responseTimeMs: Date.now() - startTime,
            timestamp: new Date().toISOString()
        };

        res.status(200).json(response);
    } catch (error) {
        // Kirim respons error
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
