// services/capcut.js
const axios = require('axios');

const API_URL = 'https://3bic.com/api/download';
const TIMEOUT = 10000; // 10 detik

// Daftar User-Agent untuk rotasi
const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
];

/**
 * Mendapatkan User-Agent acak
 */
function getRandomUserAgent() {
    return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

/**
 * Normalisasi response dari API 3bic
 * Mencari field yang umum dan mengembalikan object dengan struktur yang konsisten
 */
function normalizeResponse(rawData) {
    // Jika response memiliki field 'data', gunakan itu, jika tidak gunakan rawData
    const data = rawData.data || rawData;

    // Ekstrak informasi dengan fallback
    const title = data.title || data.judul || data.name || 'Untitled';
    const thumbnail = data.thumbnail || data.thumb || data.cover || null;
    const duration = data.duration || data.durasi || data.length || null;
    const author = data.author || data.creator || data.username || data.owner || null;

    // Ekstrak media
    let medias = [];

    // Coba beberapa kemungkinan field untuk daftar media
    const mediaCandidates = data.medias || data.videos || data.files || data.downloads || data.links || data.sources || data.download || [];

    if (Array.isArray(mediaCandidates) && mediaCandidates.length > 0) {
        // Jika sudah array, petakan
        medias = mediaCandidates.map(item => ({
            quality: item.quality || item.resolution || item.label || 'default',
            type: item.type || item.extension || (item.url && 'video') || 'video',
            url: item.url || item.link || item.download_url || item.src || null
        })).filter(m => m.url);
    } else if (typeof mediaCandidates === 'object' && mediaCandidates !== null) {
        // Jika object, coba ambil value-nya sebagai URL
        const urls = Object.values(mediaCandidates).filter(v => typeof v === 'string' && v.startsWith('http'));
        medias = urls.map((url, index) => ({
            quality: `quality_${index + 1}`,
            type: 'video',
            url
        }));
    } else {
        // Jika tidak ada, coba cari field tunggal seperti video_url, download_url, link
        const singleUrl = data.video_url || data.download_url || data.link || data.src || data.url;
        if (singleUrl && typeof singleUrl === 'string' && singleUrl.startsWith('http')) {
            medias.push({
                quality: 'default',
                type: 'video',
                url: singleUrl
            });
        }
    }

    // Jika masih kosong, fallback ke thumbnail sebagai media (gambar)
    if (medias.length === 0 && thumbnail) {
        medias.push({
            quality: 'thumbnail',
            type: 'image',
            url: thumbnail
        });
    }

    return {
        title,
        thumbnail,
        duration,
        author,
        medias
    };
}

/**
 * Download video CapCut via API 3bic
 */
async function downloadCapcut(url) {
    try {
        // Validasi awal: pastikan URL mengandung 'capcut'
        if (!url || typeof url !== 'string') {
            throw new Error('URL tidak valid');
        }

        // Kirim request ke API 3bic
        const response = await axios.post(
            API_URL,
            { url },
            {
                headers: {
                    'User-Agent': getRandomUserAgent(),
                    'Accept': 'application/json, text/plain, */*',
                    'Content-Type': 'application/json',
                    'origin': 'https://3bic.com',
                    'referer': 'https://3bic.com/'
                },
                timeout: TIMEOUT,
                validateStatus: (status) => status < 500 // Hanya anggap error jika >= 500
            }
        );

        // Cek status HTTP
        if (response.status >= 400) {
            const errorMsg = response.data?.message || response.data?.error || `HTTP ${response.status}`;
            throw new Error(errorMsg);
        }

        // Cek apakah response memiliki data
        const raw = response.data;
        if (!raw) {
            throw new Error('API mengembalikan response kosong');
        }

        // Cek field 'status' jika ada
        if (raw.status === false || raw.success === false) {
            const errorMsg = raw.message || raw.error || 'Request gagal di sisi API';
            throw new Error(errorMsg);
        }

        // Normalisasi response
        const normalized = normalizeResponse(raw);

        return {
            url,
            type: 'video', // default
            title: normalized.title,
            thumbnail: normalized.thumbnail,
            duration: normalized.duration,
            author: normalized.author,
            medias: normalized.medias
        };

    } catch (error) {
        // Tangani error dari axios atau lainnya
        if (error.code === 'ECONNABORTED') {
            throw new Error('Request timeout: API tidak merespons dalam batas waktu');
        }
        if (error.response) {
            // Error dari API (4xx atau 5xx)
            const status = error.response.status;
            let msg = error.response.data?.message || error.response.data?.error || error.message;
            if (status === 429) {
                msg = 'Terlalu banyak request, coba lagi nanti (rate limit)';
            } else if (status >= 500) {
                msg = 'Server tujuan sedang mengalami gangguan';
            }
            throw new Error(msg);
        }
        // Error lain (network, dll)
        throw new Error(error.message || 'Gagal mengunduh video CapCut');
    }
}

module.exports = { downloadCapcut };
