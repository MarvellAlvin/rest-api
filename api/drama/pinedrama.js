const axios = require('axios');
const cheerio = require('cheerio');

// ===== KONFIGURASI =====
const AUTHOR = "@Velz";
const TIMEOUT = 15000; // 15 detik
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// ===== FUNGSI BANTU =====
function getResponseTime(startTime) {
    return Date.now() - startTime;
}

// ===== PARSE EPISODE LIST =====
function extractJsonArray(str, startIdx) {
    let depth = 0;
    let inString = false;
    let escape = false;
    let result = '';
    
    for (let i = startIdx; i < str.length; i++) {
        const char = str[i];
        if (escape) { result += char; escape = false; continue; }
        if (char === '\\') { escape = true; result += char; continue; }
        if (char === '"') inString = !inString;
        
        if (!inString) {
            if (char === '[') depth++;
            else if (char === ']') {
                depth--;
                if (depth === 0) { result += char; return result; }
            }
        }
        result += char;
    }
    return null;
}

function parseEpisodeList(htmlStr) {
    const markers = ['episode_list":', 'episode_list\\":', '"episode_list":', '\\"episode_list\\":'];
    
    for (const marker of markers) {
        let searchIdx = 0;
        while (true) {
            const idx = htmlStr.indexOf(marker, searchIdx);
            if (idx === -1) break;
            
            const arrayStart = idx + marker.length;
            let start = arrayStart;
            while (start < htmlStr.length && /\s/.test(htmlStr[start])) start++;
            
            if (htmlStr[start] !== '[') { searchIdx = idx + 1; continue; }
            
            const arrayStr = extractJsonArray(htmlStr, start);
            if (!arrayStr) { searchIdx = idx + 1; continue; }
            
            try {
                let cleaned = arrayStr.replace(/\\"/g, '"').replace(/\\\\/g, '\\').replace(/\\u0022/g, '"').replace(/\\n/g, '').replace(/\\t/g, '');
                const parsed = JSON.parse(cleaned);
                if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].url) return parsed;
            } catch (e) {
                try {
                    const urls = [];
                    const urlRegex = /"episode_id":(\d+),"url":"([^"]+)"/g;
                    let match;
                    while ((match = urlRegex.exec(arrayStr)) !== null) {
                        urls.push({ episode_id: parseInt(match[1]), url: match[2].replace(/\\\//g, '/').replace(/\\"/g, '"') });
                    }
                    if (urls.length > 0) return urls;
                } catch (e2) {}
            }
            searchIdx = idx + 1;
        }
    }
    return [];
}

// ===== PARSE RELATED DRAMAS =====
function parseRelatedDramas(htmlStr) {
    const results = [];
    const regex = /"series_slug":"([^"]+)","short_desc":"([^"]*)"/g;
    let match;
    
    while ((match = regex.exec(htmlStr)) !== null) {
        const slug = match[1];
        const desc = match[2].replace(/\\u0027/g, "'").replace(/\\"/g, '"');
        
        const nameMatch = htmlStr.substring(match.index - 500, match.index).match(/"name":"([^"]+)"/);
        const ratingMatch = htmlStr.substring(match.index - 500, match.index).match(/"rating":"([^"]+)"/);
        const coverMatch = htmlStr.substring(match.index - 500, match.index).match(/"cover_url":"([^"]+)"/);
        const epMatch = htmlStr.substring(match.index - 500, match.index).match(/"episode_num":(\d+)/);
        
        if (nameMatch) {
            results.push({
                name: nameMatch[1],
                slug: slug,
                url: `https://pinedrama.com/dramas/${slug}`,
                rating: ratingMatch ? ratingMatch[1] : 'N/A',
                episodes: epMatch ? parseInt(epMatch[1]) : 'N/A',
                cover: coverMatch ? coverMatch[1].split('!')[0] : null,
                description: desc
            });
        }
    }
    
    return results.slice(0, 10);
}

// ===== PARSE FAQ =====
function parseFAQ(htmlStr) {
    const faqs = [];
    const regex = /"name":"(\d+\.[^"]+)","acceptedAnswer":\{"@type":"Answer","text":"([^"]+)"\}/g;
    let match;
    
    while ((match = regex.exec(htmlStr)) !== null) {
        faqs.push({
            question: match[1].replace(/\\u0027/g, "'").replace(/\\"/g, '"'),
            answer: match[2].replace(/\\u0027/g, "'").replace(/\\"/g, '"')
        });
    }
    
    return faqs;
}

// ===== SCRAPE DRAMA DETAIL =====
async function scrapeDramaDetail(url) {
    const { data: html } = await axios.get(url, {
        headers: { 'User-Agent': USER_AGENT },
        timeout: TIMEOUT
    });

    const $ = cheerio.load(html);
    const htmlStr = $.html();
    const detail = {};

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

    // Parse genres
    const genres = [];
    $('a[href*="/genres/"]').each((_, el) => {
        const genre = $(el).text().trim();
        if (genre && !genres.includes(genre)) genres.push(genre);
    });
    detail.genres = genres;

    detail.rating = $('div.text-yellow-400').first().text().trim() || 'N/A';

    // Parse metadata
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

    // Parse FAQ
    if (faqJson && faqJson.mainEntity) {
        detail.faq = faqJson.mainEntity.map(item => ({
            question: item.name,
            answer: item.acceptedAnswer.text
        }));
    } else {
        detail.faq = parseFAQ(htmlStr);
    }

    // Parse episode list
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

// ===== SEARCH DRAMA =====
async function getTopSearchResult(searchQuery) {
    const encodedQuery = encodeURIComponent(searchQuery);
    const url = `https://pinedrama.com/search?q=${encodedQuery}`;
    
    try {
        const { data: html } = await axios.get(url, {
            headers: { 'User-Agent': USER_AGENT },
            timeout: TIMEOUT
        });

        const $ = cheerio.load(html);
        const firstElement = $('.grid.grid-cols-2 > div').first();
        const titleElement = firstElement.find('a.hover_btn');
        const title = titleElement.text().trim();
        const link = titleElement.attr('href');
        
        if (!title || !link) {
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
        // Ambil parameter query
        const { query } = req.method === 'GET' ? req.query : req.body;

        // ===== VALIDASI =====
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

        // ===== PROSES SCRAPE =====
        const result = await getTopSearchResult(query.trim());

        // ===== CEK APAKAH DRAMA DITEMUKAN =====
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
        // ===== RESPON ERROR =====
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
