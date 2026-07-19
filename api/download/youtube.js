// api/download/youtube.js
const axios = require('axios');
const ytSearch = require('yt-search');

module.exports = async (req, res) => {
    const startTime = Date.now();

    // Ambil parameter (GET atau POST)
    const params = req.method === 'GET' ? req.query : req.body;
    let { url, type = 'audio', query } = params;

    // Validasi: harus ada url atau query
    if (!url && !query) {
        return res.status(400).json({
            status: false,
            statusCode: 400,
            author: '@velz',
            error: 'Parameter "url" atau "query" wajib diisi.',
            responseTimeMs: Date.now() - startTime,
            timestamp: new Date().toISOString()
        });
    }

    try {
        let videoUrl = url;

        // Jika tidak ada url tapi ada query, lakukan pencarian
        if (!url && query) {
            const searchResults = await ytSearch(query);
            if (!searchResults.videos || searchResults.videos.length === 0) {
                return res.status(404).json({
                    status: false,
                    statusCode: 404,
                    author: '@velz',
                    error: 'Tidak ada video ditemukan untuk query tersebut.',
                    responseTimeMs: Date.now() - startTime,
                    timestamp: new Date().toISOString()
                });
            }
            // Ambil video pertama
            const firstVideo = searchResults.videos[0];
            videoUrl = firstVideo.url;
            // Simpan metadata dari search untuk fallback
            var searchMeta = {
                title: firstVideo.title,
                author: firstVideo.author.name,
                duration: firstVideo.duration,
                thumbnail: firstVideo.thumbnail,
                url: firstVideo.url
            };
        }

        if (!videoUrl) {
            return res.status(400).json({
                status: false,
                statusCode: 400,
                author: '@velz',
                error: 'Gagal mendapatkan URL video.',
                responseTimeMs: Date.now() - startTime,
                timestamp: new Date().toISOString()
            });
        }

        // Validasi tipe
        if (!['audio', 'video'].includes(type)) {
            return res.status(400).json({
                status: false,
                statusCode: 400,
                author: '@velz',
                error: 'Parameter "type" harus "audio" atau "video".',
                responseTimeMs: Date.now() - startTime,
                timestamp: new Date().toISOString()
            });
        }

        // Tentukan endpoint API eksternal
        const apiEndpoint = type === 'audio'
            ? 'https://api.kanata.web.id/youtube2/download-audio'
            : 'https://api.kanata.web.id/youtube2/download-video';

        // Panggil API eksternal
        const { data } = await axios.post(apiEndpoint, { url: videoUrl }, {
            headers: { 'Content-Type': 'application/json' },
            timeout: 30000
        });

        // Periksa respons
        if (!data || typeof data.url !== 'string' || !data.url.startsWith('http')) {
            throw new Error('Gagal mendapatkan link download dari API eksternal.');
        }

        // Gunakan metadata dari search jika ada, atau dari respons API
        const title = searchMeta?.title || data.title || 'Unknown Title';
        const author = searchMeta?.author || data.author || 'Unknown';
        const duration = searchMeta?.duration || data.duration || 0;
        const thumbnail = searchMeta?.thumbnail || data.thumbnail || '';

        // Format hasil
        const result = {
            title,
            author,
            duration,
            thumbnail,
            downloadUrl: data.url,
            type: type,
            source: 'api.kanata.web.id'
        };

        res.status(200).json({
            status: true,
            statusCode: 200,
            author: '@velz',
            result,
            responseTimeMs: Date.now() - startTime,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('[YouTube Download] Error:', error.message);
        res.status(500).json({
            status: false,
            statusCode: 500,
            author: '@velz',
            error: error.message || 'Internal server error',
            responseTimeMs: Date.now() - startTime,
            timestamp: new Date().toISOString()
        });
    }
};
