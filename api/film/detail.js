const axios = require('axios');
const cheerio = require('cheerio');

module.exports = async (req, res) => {
    const startTime = Date.now();
    const { url } = req.method === 'GET' ? req.query : req.body;

    if (!url) {
        return res.status(400).json({
            status: false,
            statusCode: 400,
            author: '@velz',
            error: 'Parameter "url" wajib diisi untuk detail film.',
            responseTimeMs: Date.now() - startTime,
            timestamp: new Date().toISOString()
        });
    }

    try {
        const baseDomain = 'https://tv44.juragan.film';
        const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

        // Ambil halaman detail film
        const response = await axios.get(url, {
            headers: { 'User-Agent': userAgent }
        });
        const $ = cheerio.load(response.data);

        const result = {
            title: $('.entry-title[itemprop="name"]').text().trim() || $('title').text().trim(),
            episodes: [],
            playerData: null
        };

        // Cari iframe player
        let streamingUrl = '';
        const iframeSrc = $('iframe[id^="jf-frame-"]').attr('src') || $('.jf-vid-container iframe').attr('src');
        if (iframeSrc) {
            streamingUrl = iframeSrc.startsWith('http') ? iframeSrc : 'https:' + iframeSrc;
        }

        // Bypass player jika ada
        if (streamingUrl) {
            try {
                const playerResponse = await axios.get(streamingUrl, {
                    headers: {
                        'User-Agent': userAgent,
                        'Referer': `${baseDomain}/`
                    }
                });
                const playerHtml = playerResponse.data;

                // Cari HLS_URL
                const hlsMatch = playerHtml.match(/const\s+HLS_URL\s*=\s*["']([^"']+)["']/);
                const hlsUrl = hlsMatch ? hlsMatch[1] : null;

                // Cari fallback JSON
                const fallbackMatch = playerHtml.match(/const\s+FALLBACK_JSON_URL\s*=\s*["']([^"']+)["']/);
                let mp4Sources = [];
                if (fallbackMatch) {
                    const urlObj = new URL(streamingUrl);
                    const baseUrl = `${urlObj.protocol}//${urlObj.host}`;
                    const fallbackPath = fallbackMatch[1];
                    const separator = fallbackPath.includes('?') ? '&' : '?';
                    const fullFallbackUrl = `${baseUrl}${fallbackPath}${separator}_js_cb=${Date.now()}`;
                    const fallbackResponse = await axios.get(fullFallbackUrl, {
                        headers: {
                            'User-Agent': userAgent,
                            'Referer': streamingUrl
                        }
                    });
                    if (fallbackResponse.data && fallbackResponse.data.success) {
                        mp4Sources = fallbackResponse.data.sources || [];
                    }
                }

                result.playerData = {
                    success: true,
                    mainStreamHls: hlsUrl,
                    downloadMp4Sources: mp4Sources
                };
            } catch (playerError) {
                result.playerData = {
                    success: false,
                    error: playerError.message
                };
            }
        }

        // Ambil daftar episode
        $('.jf-eps-wrap a, .jf-eps-wrap span').each((_, element) => {
            const el = $(element);
            if (el.hasClass('page-text')) return;
            result.episodes.push({
                episode: el.text().trim(),
                url: el.attr('href') || url
            });
        });

        res.status(200).json({
            status: true,
            statusCode: 200,
            author: '@velz',
            result: result,
            responseTimeMs: Date.now() - startTime,
            timestamp: new Date().toISOString()
        });
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
