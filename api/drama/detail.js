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

// ===== [COPY PASTE SEMUA FUNGSI PARSING DARI pinedrama.js] =====
// extractJsonArray, parseEpisodeList, parseRelatedDramas, parseFAQ, scrapeDramaDetail
// (sama persis seperti di pinedrama.js)

// ===== SCRAPE DRAMA DETAIL =====
async function scrapeDramaDetail(url) {
    const { data: html } = await axios.get(url, {
        headers: { 'User-Agent': USER_AGENT },
        timeout: TIMEOUT
    });

    const $ = cheerio.load(html);
    const htmlStr = $.html();
    const detail = {};

    // Parse JSON-LD
    const ldJsonScripts = $('script[type="application/ld+json"]');
    let ldJson = null;
    let faqJson = null;
    
    ldJsonScripts.each((_, el) => {
        try {
            const parsed = JSON.parse($(el).html());
            if (parsed['@type'] === 'TVEpisode' || parsed['@type'] === 'TVSeries') ldJson = parsed;
            else if (parsed['@type'] === 'FAQPage') faqJson = parsed;
        } catch (e) {}
    });

    if (ldJson) {
        detail.title = ldJson.name;
        detail.synopsis = ldJson.description || '';
        detail.image = ldJson.image ? ldJson.image.split('!')[0] : null;
        detail.total_episodes = ldJson.numberOfEpisodes || 'N/A';
        detail.drama_url = ldJson.url;
    } else {
        detail.title = $('h1').first().text().trim();
        detail.synopsis = $('div.line-clamp-5').first().text().trim() || 
                          $('div.line-clamp-4').first().text().trim() ||
                          $('div.line-clamp-2').first().text().trim();
        detail.image = $('img[alt]').first().attr('src');
        if (detail.image) detail.image = detail.image.split('!')[0];
        detail.total_episodes = 'N/A';
        detail.drama_url = url;
    }

    // Genres
    const genres = [];
    $('a[href*="/genres/"]').each((_, el) => {
        const genre = $(el).text().trim();
        if (genre && !genres.includes(genre)) genres.push(genre);
    });
    detail.genres = genres;

    detail.rating = $('div.text-yellow-400').first().text().trim() || 'N/A';

    // Metadata
    const metadataMatch = htmlStr.match(/"Obj":\{([^}]+(?:\{[^}]*\}[^}]*)*)\}/);
    if (metadataMatch) {
        try {
            const objStr = '{' + metadataMatch[1] + '}';
            const cleaned = objStr.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
            const obj = JSON.parse(cleaned);
            detail.supplier = obj.supplier || null;
            detail.source_language = obj.source_language || null;
            detail.release_date = obj.release_date || null;
            detail.series_slug = obj.series_slug || null;
            detail.shortlink = obj.shortlink || null;
        } catch (e) {}
    }

    // FAQ
    if (faqJson && faqJson.mainEntity) {
        detail.faq = faqJson.mainEntity.map(item => ({
            question: item.name,
            answer: item.acceptedAnswer.text
        }));
    } else {
        detail.faq = parseFAQ(htmlStr);
    }

    // Episode list
    detail.episode_list = parseEpisodeList(htmlStr);
    
    if (detail.episode_list.length === 0) {
        const ep1Url = url.endsWith('/') ? url + 'ep1' : url + '/ep1';
        try {
            const { data: epHtml } = await axios.get(ep1Url, {
                headers: { 'User-Agent': USER_AGENT },
                timeout: TIMEOUT
            });
            detail.episode_list = parseEpisodeList(epHtml);
        } catch (e) {}
    }

    detail.related_dramas = parseRelatedDramas(htmlStr);

    return detail;
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
        if (!url.includes('pinedrama.com/dramas/')) {
            return res.status(400).json({
                status: false,
                statusCode: 400,
                author: AUTHOR,
                result: null,
                error: 'URL harus dari domain pinedrama.com/dramas/',
                responseTimeMs: getResponseTime(startTime),
                timestamp: new Date().toISOString()
            });
        }

        // ===== PROSES SCRAPE =====
        const detail = await scrapeDramaDetail(url.trim());

        if (!detail || !detail.title) {
            return res.status(404).json({
                status: false,
                statusCode: 404,
                author: AUTHOR,
                result: null,
                error: 'Drama tidak ditemukan atau gagal di-scrape.',
                responseTimeMs: getResponseTime(startTime),
                timestamp: new Date().toISOString()
            });
        }

        // ===== RESPON SUKSES =====
        res.status(200).json({
            status: true,
            statusCode: 200,
            author: AUTHOR,
            result: detail,
            responseTimeMs: getResponseTime(startTime),
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('[PineDrama Detail] Error:', error.message);

        const statusCode = error.message.includes('timeout') ? 408 : 500;
        
        res.status(statusCode).json({
            status: false,
            statusCode: statusCode,
            author: AUTHOR,
            result: null,
            error: error.message || 'Terjadi kesalahan saat mengambil data drama.',
            responseTimeMs: getResponseTime(startTime),
            timestamp: new Date().toISOString()
        });
    }
};
