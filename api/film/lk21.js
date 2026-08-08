// api/film/lk21.js
const axios = require('axios');
const cheerio = require('cheerio');

// ===== KONFIGURASI =====
const BASE = 'https://tv10.lk21official.cc';
const DRAMAMU = 'https://dramamu.lk21.de';
const COVER = 'https://cover.showcdnx.com/wp-content/uploads/';
const SEARCH_API = 'https://gudangvape.com/search.php';
const TIMEOUT = 30000;
const DEBUG = true;

// ===== HEADER =====
function getHeaders(extra = {}) {
    return {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Mobile Safari/537.36',
        'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8',
        'Referer': BASE + '/',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        ...extra
    };
}

function getJsonHeaders() {
    return {
        ...getHeaders(),
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'X-Requested-With': 'XMLHttpRequest'
    };
}

// ===== FUNGSI LOGGING =====
function log(message, data = null) {
    if (!DEBUG) return;
    if (data) {
        console.log(`[LK21] ${message}`, data);
    } else {
        console.log(`[LK21] ${message}`);
    }
}

// ===== HTTP REQUEST =====
async function fetchHtml(url, extra = {}) {
    const response = await axios.get(url, {
        headers: { ...getHeaders(), ...extra },
        timeout: TIMEOUT
    });
    return response.data;
}

async function fetchJson(url) {
    const response = await axios.get(url, {
        headers: getJsonHeaders(),
        timeout: TIMEOUT
    });
    return response.data;
}

// ===== PARSER ITEM =====
function parseItem($, el) {
    const a = $(el).find('a[itemprop="url"], a').first();
    const img = $(el).find('img').first();
    const poster = img.attr('src') || img.attr('data-src') || '';
    const href = a.attr('href') || '';

    return {
        title: $(el).find('.poster-title').text().trim(),
        slug: href.replace(/^\//, '').replace(/\/$/, ''),
        url: href.startsWith('http') ? href : `${BASE}${href}`,
        year: $(el).find('.year').text().trim(),
        rating: $(el).find('.poster .rating [itemprop="ratingValue"]').text().trim() ||
                ($(el).find('.poster .rating').text().match(/\d+(\.\d+)?/) || [''])[0],
        quality: $(el).find('.poster .label').text().trim(),
        episode: $(el).find('.episode strong').text().trim(),
        season: ($(el).find('.duration:not([itemprop])').text().trim() || '').replace('S.', ''),
        runtime: $(el).find('.duration[itemprop="duration"]').text().trim(),
        genre: $(el).find('meta[itemprop="genre"]').attr('content') || '',
        poster: poster.startsWith('http') ? poster : poster ? COVER + poster : ''
    };
}

// ===== 1. HOME =====
async function getHome() {
    log('Fetching home...');
    const html = await fetchHtml(BASE + '/');
    const $ = cheerio.load(html);
    const sections = [];

    $('.widget[data-type]').each((_, w) => {
        const type = $(w).attr('data-type') || '';
        const title = $(w).find('.header h2').text().trim();
        const seeAll = $(w).find('.header a').attr('href') || '';
        if ($(w).attr('id') === 'you-may-wrapper') return;

        const items = [];
        $(w).find('li.slider, #you-may-also-like li').each((_, el) => {
            items.push(parseItem($, el));
        });

        sections.push({
            type,
            title,
            seeAll: seeAll.startsWith('http') ? seeAll : `${BASE}${seeAll}`,
            items
        });
    });

    const latest = [];
    $('#post-container article, .gallery-grid article').each((_, el) => {
        latest.push(parseItem($, el));
    });

    return { sections, latest };
}

// ===== 2. BROWSE =====
async function getBrowse(path, page = 1, type = '') {
    log(`Browsing: ${path}, page: ${page}, type: ${type}`);
    let url = path.startsWith('http') ? path : `${BASE}/${path.replace(/^\//, '')}`;
    if (page > 1) {
        url += `${url.endsWith('/') ? '' : '/'}page/${page}`;
    }
    if (type && ['movie', 'series', 'both'].includes(type)) {
        url += `${url.includes('?') ? '&' : '?'}type=${type}`;
    }

    const html = await fetchHtml(url);
    const $ = cheerio.load(html);

    const title = $('h1').first().text().trim();
    const items = [];
    $('.gallery-grid article, #post-container article').each((_, el) => {
        items.push(parseItem($, el));
    });

    const totalPages = $('.pagination li:not(.active) a')
        .map((_, a) => parseInt($(a).attr('href')?.match(/page\/(\d+)/)?.[1] || $(a).text(), 10))
        .get()
        .filter(n => !isNaN(n));
    const last = totalPages.length ? Math.max(...totalPages) : 1;

    return { title, page, totalPages: last, items };
}

// ===== 3. GENRES =====
async function getGenres() {
    log('Fetching genres...');
    const html = await fetchHtml(BASE + '/genre/');
    const $ = cheerio.load(html);
    const genres = [];

    $('a[href^="/genre/"]').each((_, a) => {
        const slug = $(a).attr('href').split('/').filter(Boolean)[1];
        const name = $(a).text().trim();
        if (name && slug) {
            genres.push({ slug, name });
        }
    });

    // Remove duplicates
    const seen = new Set();
    return genres.filter(g => {
        const key = g.slug;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

// ===== 4. COUNTRIES =====
async function getCountries() {
    log('Fetching countries...');
    const html = await fetchHtml(BASE + '/country/');
    const $ = cheerio.load(html);
    const map = new Map();

    $('a[href^="/country/"]').each((_, a) => {
        const slug = $(a).attr('href').split('/').filter(Boolean)[1];
        const name = $(a).text().trim();
        if (name && slug && !map.has(slug)) {
            map.set(slug, { slug, name });
        }
    });

    return [...map.values()];
}

// ===== 5. YEARS =====
async function getYears() {
    log('Fetching years...');
    const html = await fetchHtml(BASE + '/year/');
    const $ = cheerio.load(html);
    const years = [];

    $('a[href^="/year/"]').each((_, a) => {
        const year = $(a).attr('href').split('/').filter(Boolean)[1];
        if (year && !years.includes(year)) {
            years.push(year);
        }
    });

    return years;
}

// ===== 6. SEARCH =====
async function searchMovies(query, page = 1) {
    log(`Searching: ${query}, page: ${page}`);
    const url = `${SEARCH_API}?s=${encodeURIComponent(query)}&page=${page}`;
    const data = await fetchJson(url);

    const items = (data?.data || data?.items || []).map(it => ({
        title: it.title,
        slug: it.slug,
        url: `${BASE}/${it.slug}`,
        year: it.year,
        rating: it.rating,
        quality: it.quality,
        episode: it.episode || undefined,
        season: it.season || undefined,
        runtime: it.runtime || undefined,
        type: it.type || undefined,
        poster: it.poster?.startsWith('http') ? it.poster : it.poster ? COVER + it.poster : ''
    }));

    return {
        query,
        page,
        totalPages: data?.totalPages || data?.total_pages || 1,
        items
    };
}

// ===== 7. DETAIL =====
async function getDetail(url) {
    log(`Fetching detail: ${url}`);
    let html = await fetchHtml(url);

    // Check if it's a series redirect
    const $tmp = cheerio.load(html);
    const openNow = $tmp('#openNow').attr('href');

    if (openNow) {
        return await getDetailSeries(openNow, html);
    }
    return await getDetailMovie(html, url);
}

function parseDetailCore($) {
    const infoTag = $('.info-tag span').map((_, el) => $(el).text().trim()).get();
    const tags = $('.tag-list .tag a').map((_, el) => ({
        type: $(el).attr('href').split('/').filter(Boolean)[0],
        slug: $(el).attr('href').split('/').filter(Boolean)[1],
        name: $(el).text().trim()
    })).get();

    const meta = {};
    $('.detail p').each((_, el) => {
        const label = $(el).find('span').text().replace(':', '').trim();
        const val = $(el).clone().find('span').remove().end().text().trim();
        if (label) meta[label] = val;
    });

    const terbaru = $('.meta-info > p').first().find('a').text().trim();

    return {
        title: $('h1').first().text().trim(),
        infoTag,
        rating: $('.rating-number').attr('data-base-rating') || '',
        votes: $('.rating-users').attr('data-base-votes') || '',
        genres: tags.filter(t => t.type === 'genre').map(t => t.name),
        country: tags.filter(t => t.type === 'country').map(t => t.name),
        director: meta['Sutradara'] || '',
        cast: (meta['Bintang Film'] || '').split(',').map(s => s.trim()).filter(Boolean),
        release: meta['Release'] || '',
        updated: meta['Updated'] || '',
        votesMeta: meta['Votes'] || '',
        synopsis: $('.synopsis').text().trim(),
        latestEpisode: terbaru,
        poster: ($('.detail img').attr('src') || $('.detail img').attr('data-src') || ''),
        trailer: $('.trailer-series iframe, .simple-box iframe').attr('src') || ''
    };
}

async function getDetailMovie(html, url) {
    const $ = cheerio.load(html);
    const core = parseDetailCore($);

    const playLinks = [];
    $('.movie-action a').each((_, a) => {
        const href = $(a).attr('href') || '';
        const text = $(a).text().replace(/\s+/g, ' ').trim();
        if (/^\/|^https?:\/\//.test(href) && !/^#/.test(href)) {
            playLinks.push({ text, url: href });
        }
    });

    const players = [];
    $('#player-list a[data-url], #player-list li a').each((_, a) => {
        players.push({
            server: $(a).attr('data-server') || $(a).text().trim().toLowerCase(),
            url: $(a).attr('data-url') || $(a).attr('href')
        });
    });

    return {
        type: 'movie',
        url,
        ...core,
        download: $('a[title^="Download"]').attr('href') || '',
        playAwal: playLinks[0]?.url || '',
        playTerbaru: playLinks[1]?.url || '',
        players: players.filter(p => p.url),
        related: []
    };
}

async function getDetailSeries(url) {
    const $ = cheerio.load(await fetchHtml(url));
    const core = parseDetailCore($);

    // Parse seasons from JSON
    const seasons = {};
    const sd = $('#season-data').text();
    if (sd) {
        try {
            const parsed = JSON.parse(sd);
            for (const [s, eps] of Object.entries(parsed)) {
                seasons[s] = eps.map(e => ({
                    episode: e.episode_no,
                    title: e.title,
                    slug: e.slug,
                    url: `${DRAMAMU}/${e.slug}`
                }));
            }
        } catch (e) {
            log(`Season parse error: ${e.message}`);
        }
    }

    const playLinks = [];
    $('.movie-action a').each((_, a) => {
        const href = $(a).attr('href') || '';
        const text = $(a).text().replace(/\s+/g, ' ').trim();
        if (!/^(#|\/country|\/genre)/.test(href)) {
            playLinks.push({ text, url: href });
        }
    });

    const related = [];
    $('.widget[data-type] li.slider').each((_, el) => {
        related.push(parseItem($, el));
    });

    return {
        type: 'series',
        url,
        ...core,
        seasons,
        totalEpisodes: Object.values(seasons).reduce((n, e) => n + e.length, 0),
        playAwal: playLinks[0]?.url || '',
        playTerbaru: playLinks[1]?.url || '',
        related
    };
}

// ===== 8. STREAM =====
async function getStream(url) {
    log(`Fetching stream: ${url}`);
    const html = await fetchHtml(url);
    const $ = cheerio.load(html);

    const players = [];
    $('#player-list a[data-url], #player-list li a').each((_, a) => {
        const server = $(a).attr('data-server') || $(a).text().trim().toLowerCase();
        const u = $(a).attr('data-url') || $(a).attr('href');
        if (u && u !== '#') {
            players.push({ server, url: u, active: $(a).hasClass('active') });
        }
    });

    if (!players.length) {
        const src = $('#main-player').attr('src');
        if (src) players.push({ server: 'p2p', url: src, active: true });
    }

    // Episode navigation
    const nav = [];
    $('a:contains("EPISODE SEBELUMNYA"), a:contains("EPISODE BERIKUTNYA"), .prev-episode a, .next-episode a').each((_, a) => {
        const href = $(a).attr('href');
        if (href && /^\/|^https?:/.test(href)) {
            nav.push({ text: $(a).text().trim(), url: href });
        }
    });

    return {
        url,
        title: $('h1').first().text().trim(),
        players,
        nav
    };
}

// ========== ENDPOINT UTAMA ==========
module.exports = async (req, res) => {
    const startTime = Date.now();

    // Ambil parameter dari query (GET) atau body (POST)
    const { action, path, page = 1, type = '', query, url } = req.method === 'GET' ? req.query : req.body;

    log(`Action: ${action}`);

    try {
        let result;
        let actionName = action;

        // Jika action tidak diberikan, default ke home
        if (!action) {
            actionName = 'home';
        }

        switch (actionName) {
            case 'home':
                result = await getHome();
                break;

            case 'browse':
                if (!path) {
                    return res.status(400).json({
                        status: false,
                        statusCode: 400,
                        author: '@velz',
                        error: 'Parameter "path" wajib diisi untuk action browse. Contoh: /populer, /genre/action, /country/us',
                        responseTimeMs: Date.now() - startTime,
                        timestamp: new Date().toISOString()
                    });
                }
                result = await getBrowse(path, parseInt(page) || 1, type);
                break;

            case 'genres':
                result = await getGenres();
                break;

            case 'countries':
                result = await getCountries();
                break;

            case 'years':
                result = await getYears();
                break;

            case 'search':
                if (!query) {
                    return res.status(400).json({
                        status: false,
                        statusCode: 400,
                        author: '@velz',
                        error: 'Parameter "query" wajib diisi untuk action search.',
                        responseTimeMs: Date.now() - startTime,
                        timestamp: new Date().toISOString()
                    });
                }
                result = await searchMovies(query, parseInt(page) || 1);
                break;

            case 'detail':
                if (!url) {
                    return res.status(400).json({
                        status: false,
                        statusCode: 400,
                        author: '@velz',
                        error: 'Parameter "url" wajib diisi untuk action detail.',
                        responseTimeMs: Date.now() - startTime,
                        timestamp: new Date().toISOString()
                    });
                }
                result = await getDetail(url);
                break;

            case 'stream':
                if (!url) {
                    return res.status(400).json({
                        status: false,
                        statusCode: 400,
                        author: '@velz',
                        error: 'Parameter "url" wajib diisi untuk action stream.',
                        responseTimeMs: Date.now() - startTime,
                        timestamp: new Date().toISOString()
                    });
                }
                result = await getStream(url);
                break;

            default:
                return res.status(400).json({
                    status: false,
                    statusCode: 400,
                    author: '@velz',
                    error: `Action "${actionName}" tidak dikenal. Actions: home, browse, genres, countries, years, search, detail, stream`,
                    responseTimeMs: Date.now() - startTime,
                    timestamp: new Date().toISOString()
                });
        }

        // ===== RESPON SUKSES =====
        res.status(200).json({
            status: true,
            statusCode: 200,
            author: '@velz',
            result: {
                action: actionName,
                data: result,
                provider: 'LK21 V2'
            },
            responseTimeMs: Date.now() - startTime,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        log(`Error: ${error.message}`);

        // ===== RESPON ERROR =====
        let statusCode = 500;
        let errorMessage = error.message || 'Terjadi kesalahan pada server.';

        if (error.message.includes('timeout') || error.message.includes('ETIMEDOUT')) {
            statusCode = 408;
            errorMessage = 'Request timeout. Server LK21 tidak merespons.';
        } else if (error.message.includes('404')) {
            statusCode = 404;
            errorMessage = 'Halaman tidak ditemukan.';
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
