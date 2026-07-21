const axios = require('axios');
const cheerio = require('cheerio');

// ===== KONFIGURASI =====
const AUTHOR = "@MarvellAlvin";
const TIMEOUT = 15000;
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// ===== FUNGSI BANTU =====
function getResponseTime(startTime) {
    return Date.now() - startTime;
}

// ===== SCRAPE IFRAME =====
async function scrapeIframe(episodeUrl) {
    try {
        const { data: html } = await axios.get(episodeUrl, {
            headers: { 'User-Agent': USER_AGENT },
            timeout: TIMEOUT
        });

        const $ = cheerio.load(html);
        const htmlStr = $.html();

        // Cari iframe dari berbagai source
        const iframeSources = [];

        // 1. Cari dari tag iframe langsung
        $('iframe').each((_, el) => {
            const src = $(el).attr('src');
            if (src && !src.includes('googleads') && !src.includes('doubleclick')) {
                iframeSources.push({
                    type: 'direct',
                    url: src.startsWith('http') ? src : `https:${src}`
                });
            }
        });

        // 2. Cari dari JSON episode_list (jika ada)
        const episodeListMatch = htmlStr.match(/"episode_list":\s*(\[[\s\S]*?\])/);
        if (episodeListMatch) {
            try {
                const cleaned = episodeListMatch[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\');
                const episodeList = JSON.parse(cleaned);
                if (episodeList.length > 0 && episodeList[0].url) {
                    // Ambil episode pertama sebagai fallback
                    const firstEpUrl = episodeList[0].url.startsWith('http') ? 
                        episodeList[0].url : 
                        `https://pinedrama.com${episodeList[0].url}`;
                    
                    // Rekursif untuk mendapatkan iframe dari episode pertama
                    try {
                        const { data: epHtml } = await axios.get(firstEpUrl, {
                            headers: { 'User-Agent': USER_AGENT },
                            timeout: TIMEOUT
                        });
                        const ep$ = cheerio.load(epHtml);
                        ep$('iframe').each((_, el) => {
                            const src = ep$(el).attr('src');
                            if (src && !src.includes('googleads') && !src.includes('doubleclick')) {
                                iframeSources.push({
                                    type: 'from_episode_list',
                                    url: src.startsWith('http') ? src : `https:${src}`
                                });
                            }
                        });
                    } catch (e) {}
                }
            } catch (e) {}
        }

        // 3. Cari dari pattern umum (regex)
        const iframeRegex = /<iframe[^>]*src=["']([^"']*)["'][^>]*>/gi;
        let match;
        while ((match = iframeRegex.exec(htmlStr)) !== null) {
            const src = match[1];
            if (src && !src.includes('googleads') && !src.includes('doubleclick')) {
                iframeSources.push({
                    type: 'regex',
                    url: src.startsWith('http') ? src : `https:${src}`
                });
            }
        }

        // 4. Cari dari script yang mengandung embed URL
        const embedRegex = /(?:file|url|src|embed)\s*[:=]\s*["']([^"']*\.(?:mp4|m3u8|cloudfront|cdn)[^"']*)["']/gi;
        while ((match = embedRegex.exec(htmlStr)) !== null) {
            const src = match[1];
            if (src && !src.includes('googleads')) {
                iframeSources.push({
                    type: 'script_embed',
                    url: src.startsWith('http') ? src : `https:${src}`
                });
            }
        }

        // Hapus duplikat
        const uniqueSources = [];
        const seenUrls = new Set();
        for (const source of iframeSources) {
            if (!seenUrls.has(source.url)) {
                seenUrls.add(source.url);
                uniqueSources.push(source);
            }
        }

        return {
            episode_url: episodeUrl,
            iframe_sources: uniqueSources,
            total_found: uniqueSources.length
        };

    } catch (error) {
        throw new Error(`Scrape iframe error: ${error.message}`);
    }
}

// ========== ENDPOINT UTAMA ==========
module.exports = async (req, res) => {
    const startTime = Date.now();

    try {
        const { url } = req.method === 'GET' ? req.query : req.body;

        // ===== VALIDASI =====
        if (!url || url.trim() === '') {
            return res.status(400).json({
                status: false,
                statusCode: 400,
                author: AUTHOR,
                result: null,
                error: 'Parameter "url" wajib diisi.',
                responseTimeMs: getResponseTime(startTime),
                timestamp: new Date().toISOString()
            });
        }

        // Validasi format URL
        if (!url.includes('pinedrama.com')) {
            return res.status(400).json({
                status: false,
                statusCode: 400,
                author: AUTHOR,
                result: null,
                error: 'URL harus dari domain pinedrama.com',
                responseTimeMs: getResponseTime(startTime),
                timestamp: new Date().toISOString()
            });
        }

        // ===== PROSES SCRAPE IFRAME =====
        const result = await scrapeIframe(url.trim());

        if (!result.iframe_sources || result.iframe_sources.length === 0) {
            return res.status(404).json({
                status: false,
                statusCode: 404,
                author: AUTHOR,
                result: null,
                error: 'Tidak ditemukan iframe atau link video pada halaman ini.',
                responseTimeMs: getResponseTime(startTime),
                timestamp: new Date().toISOString()
            });
        }

        // ===== RESPON SUKSES =====
        res.status(200).json({
            status: true,
            statusCode: 200,
            author: AUTHOR,
            result: result,
            responseTimeMs: getResponseTime(startTime),
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('[PineDrama Iframe] Error:', error.message);

        const statusCode = error.message.includes('timeout') ? 408 : 500;
        
        res.status(statusCode).json({
            status: false,
            statusCode: statusCode,
            author: AUTHOR,
            result: null,
            error: error.message || 'Terjadi kesalahan saat mengambil iframe.',
            responseTimeMs: getResponseTime(startTime),
            timestamp: new Date().toISOString()
        });
    }
};
