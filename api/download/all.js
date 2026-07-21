// api/download/all.js
const axios = require('axios');

// ===== KONFIGURASI =====
const BASE_URL = 'https://api.everyvideo.app';
const TIMEOUT = 30000; // 30 detik

// ===== HEADER =====
const HEADERS = {
    'Origin': 'https://www.everyvideo.app',
    'Referer': 'https://www.everyvideo.app/',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36',
    'Accept': 'application/json',
    'Content-Type': 'application/json'
};

// ===== FETCH METADATA =====
async function fetchMetadata(url) {
    try {
        const encodedUrl = encodeURIComponent(url);
        const response = await axios.get(
            `${BASE_URL}/api/metadata/preview?url=${encodedUrl}`,
            { headers: HEADERS, timeout: TIMEOUT }
        );
        return response.data;
    } catch (error) {
        if (error.response) {
            throw new Error(`Metadata error: ${error.response.status} - ${error.response.data?.error || error.response.statusText}`);
        }
        throw new Error(`Metadata error: ${error.message}`);
    }
}

// ===== SELECT BEST FORMAT =====
function selectBestFormat(metadata) {
    const formats = metadata.video_formats || [];
    if (formats.length === 0) {
        throw new Error('Tidak ada format video yang tersedia');
    }
    
    // Urutkan berdasarkan height terbesar (kualitas terbaik)
    const sorted = [...formats].sort((a, b) => (b.height || 0) - (a.height || 0));
    return sorted[0];
}

// ===== CREATE DOWNLOAD JOB =====
async function createDownloadJob(url, format, title) {
    try {
        const payload = {
            url: url,
            format_id: format.format_id,
            format: format.ext || 'mp4',
            title: title || 'video'
        };

        const response = await axios.post(
            `${BASE_URL}/api/dl/start`,
            payload,
            { headers: HEADERS, timeout: TIMEOUT }
        );

        if (!response.data || !response.data.job_id) {
            throw new Error('Gagal membuat job download');
        }

        return response.data.job_id;
    } catch (error) {
        if (error.response) {
            throw new Error(`Job error: ${error.response.status} - ${error.response.data?.error || error.response.statusText}`);
        }
        throw new Error(`Job error: ${error.message}`);
    }
}

// ===== GET DOWNLOAD URL =====
async function getDownloadUrl(jobId) {
    try {
        const response = await axios.get(
            `${BASE_URL}/api/dl/${jobId}/download`,
            {
                headers: HEADERS,
                timeout: TIMEOUT,
                maxRedirects: 0,
                validateStatus: (status) => status === 302 || status === 301 || status === 200
            }
        );

        // Cek header location untuk redirect
        if (response.headers.location) {
            return response.headers.location;
        }

        // Jika tidak ada redirect, cek response data
        if (response.data && response.data.download_url) {
            return response.data.download_url;
        }

        // Jika masih tidak ada, return URL job
        return `${BASE_URL}/api/dl/${jobId}/download`;
    } catch (error) {
        if (error.response) {
            throw new Error(`Download error: ${error.response.status} - ${error.response.statusText}`);
        }
        throw new Error(`Download error: ${error.message}`);
    }
}

// ===== MAIN DOWNLOADER =====
async function everyVideoDownloader(url, includeDetails = false) {
    try {
        // 1. Fetch metadata
        const metadata = await fetchMetadata(url);

        if (!metadata.available) {
            throw new Error('Media tidak tersedia atau tidak dapat diakses');
        }

        // 2. Select best format
        const bestFormat = selectBestFormat(metadata);

        // 3. Create download job
        const jobId = await createDownloadJob(url, bestFormat, metadata.title);

        // 4. Get download URL
        const downloadUrl = await getDownloadUrl(jobId);

        // 5. Build result
        const result = {
            title: metadata.title || 'Untitled',
            description: metadata.description || '',
            thumbnail: metadata.thumbnail_url || null,
            duration: metadata.duration || null,
            uploader: metadata.uploader || null,
            platform: metadata.platform || 'unknown',
            uploadDate: metadata.upload_date || null,
            resolution: metadata.resolution || bestFormat.resolution || null,
            quality: bestFormat.quality || 'N/A',
            format: bestFormat.ext || 'mp4',
            fileSizeMB: bestFormat.file_size_mb || null,
            downloadUrl: downloadUrl,
            selectedFormat: {
                quality: bestFormat.quality,
                resolution: bestFormat.resolution,
                width: bestFormat.width,
                height: bestFormat.height,
                vcodec: bestFormat.vcodec,
                acodec: bestFormat.acodec,
                ext: bestFormat.ext,
                fileSizeMB: bestFormat.file_size_mb
            },
            available: metadata.available || false,
            source: 'EveryVideo'
        };

        // Tambahkan details jika diminta
        if (includeDetails) {
            result.video_formats = metadata.video_formats || [];
            result.audio_formats = metadata.audio_formats || [];
            result.all_formats = metadata.formats || [];
        }

        return result;

    } catch (error) {
        throw new Error(`EveryVideo downloader error: ${error.message}`);
    }
}

// ========== ENDPOINT UTAMA ==========
module.exports = async (req, res) => {
    const startTime = Date.now();

    // Ambil parameter dari query (GET) atau body (POST)
    const { url, details = false } = req.method === 'GET' ? req.query : req.body;

    // ===== VALIDASI =====
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

    // Validasi URL
    try {
        new URL(url);
    } catch (error) {
        return res.status(400).json({
            status: false,
            statusCode: 400,
            author: '@velz',
            error: 'URL tidak valid. Harap berikan URL yang benar.',
            responseTimeMs: Date.now() - startTime,
            timestamp: new Date().toISOString()
        });
    }

    try {
        // Proses download
        const result = await everyVideoDownloader(url, details === 'true' || details === true);

        // ===== RESPON SUKSES =====
        res.status(200).json({
            status: true,
            statusCode: 200,
            author: '@velz',
            result: result,
            responseTimeMs: Date.now() - startTime,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('[EveryVideo Downloader] Error:', error.message);

        // ===== RESPON ERROR =====
        let statusCode = 500;
        let errorMessage = error.message;

        if (error.message.includes('429')) {
            statusCode = 429;
            errorMessage = 'Terlalu banyak permintaan. Silakan coba lagi nanti.';
        } else if (error.message.includes('Media tidak tersedia')) {
            statusCode = 404;
        } else if (error.message.includes('URL tidak valid')) {
            statusCode = 400;
        } else if (error.message.includes('timeout')) {
            statusCode = 408;
            errorMessage = 'Request timeout: Server tidak merespons dalam waktu yang ditentukan.';
        } else if (error.message.includes('502') || error.message.includes('503') || error.message.includes('504')) {
            statusCode = 503;
            errorMessage = 'Server EveryVideo sedang sibuk. Silakan coba lagi nanti.';
        }

        res.status(statusCode).json({
            status: false,
            statusCode: statusCode,
            author: '@velz',
            error: errorMessage,
            responseTimeMs: Date.now() - startTime,
            timestamp: new Date().toISOString()
        });
    }
};
