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

// ===== [SISANYA SAMA: extractJsonArray, parseEpisodeList, parseRelatedDramas, parseFAQ] =====
// (Kode parsing episode, related dramas, FAQ tetap sama seperti sebelumnya)

// ===== FUNGSI BARU: AKSES LANGSUNG =====
async function tryDirectAccess(searchQuery) {
    const slug = searchQuery
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-');
    
    const possibleUrls = [
        `https://pinedrama.com/dramas/${slug}`,
        `https://pinedrama.com/dramas/${slug}-drama`,
        `https://pinedrama.com/dramas/${slug}-kdrama`,
        `https://pinedrama.com/dramas/${slug}-mini-drama`,
        `https://pinedrama.com/dramas/${slug}-series`
    ];
    
    for (const url of possibleUrls) {
        try {
            const response = await axios.get(url, {
                headers: { 'User-Agent': USER_AGENT },
                timeout: TIMEOUT,
                validateStatus: (status) => status < 400
            });
            
            if (response.status === 200) {
                console.log(`[PineDrama] Direct access success: ${url}`);
                return url;
            }
        } catch (e) {
            continue;
        }
    }
    return null;
}

// ===== SCRAPE DRAMA DETAIL =====
async function scrapeDramaDetail(url) {
    // [KODE SAMA PERSIS SEPERTI SEBELUMNYA]
    // ...
}

// ===== SEARCH DRAMA (DENGAN FALLBACK) =====
async function getTopSearchResult(searchQuery) {
    const encodedQuery = encodeURIComponent(searchQuery);
    const url = `https://pinedrama.com/search?q=${encodedQuery}`;
    
    try {
        console.log(`[PineDrama] Searching: ${searchQuery}`);
        
        const { data: html } = await axios.get(url, {
            headers: { 'User-Agent': USER_AGENT },
            timeout: TIMEOUT
        });

        const $ = cheerio.load(html);
        const firstElement = $('.grid.grid-cols-2 > div').first();
        const titleElement = firstElement.find('a.hover_btn');
        const title = titleElement.text().trim();
        const link = titleElement.attr('href');
        
        // JIKA PENCARIAN GAGAL, COBA AKSES LANGSUNG
        if (!title || !link) {
            console.log('[PineDrama] Search returned no results, trying direct access...');
            const directUrl = await tryDirectAccess(searchQuery);
            
            if (directUrl) {
                const detail = await scrapeDramaDetail(directUrl);
                return {
                    search_query: searchQuery,
                    result_url: directUrl,
                    scraped_at: new Date().toISOString(),
                    ...detail
                };
            }
            return { error: 'Drama tidak ditemukan' };
        }
        
        const fullUrl = link.startsWith('http') ? link : `https://pinedrama.com${link}`;
        const detail = await scrapeDramaDetail(fullUrl);
        
        return {
            search_query: searchQuery,
            result_url: fullUrl,
            scraped_at: new Date().toISOString(),
            ...detail
        };
        
    } catch (error) {
        // JIKA ERROR, COBA AKSES LANGSUNG
        console.log('[PineDrama] Error scraping, trying direct access...', error.message);
        const directUrl = await tryDirectAccess(searchQuery);
        
        if (directUrl) {
            const detail = await scrapeDramaDetail(directUrl);
            return {
                search_query: searchQuery,
                result_url: directUrl,
                scraped_at: new Date().toISOString(),
                ...detail
            };
        }
        
        if (error.code === 'ECONNABORTED') {
            throw new Error('Request timeout: Website tidak merespons');
        }
        throw new Error(`Scraping error: ${error.message}`);
    }
}

// ========== ENDPOINT UTAMA ==========
module.exports = async (req, res) => {
    const startTime = Date.now();

    try {
        const { query } = req.method === 'GET' ? req.query : req.body;

        if (!query || query.trim() === '') {
            return res.status(400).json({
                status: false,
                statusCode: 400,
                author: AUTHOR,
                result: null,
                error: 'Parameter "query" wajib diisi.',
                responseTimeMs: getResponseTime(startTime),
                timestamp: new Date().toISOString()
            });
        }

        const result = await getTopSearchResult(query.trim());

        if (result.error) {
            return res.status(404).json({
                status: false,
                statusCode: 404,
                author: AUTHOR,
                result: null,
                error: result.error,
                responseTimeMs: getResponseTime(startTime),
                timestamp: new Date().toISOString()
            });
        }

        res.status(200).json({
            status: true,
            statusCode: 200,
            author: AUTHOR,
            result: result,
            responseTimeMs: getResponseTime(startTime),
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('[PineDrama] Error:', error.message);

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
