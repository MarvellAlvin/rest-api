const axios = require('axios');
const cheerio = require('cheerio');

async function fetchDetikSearch(query) {
    const url = `https://www.detik.com/search/searchall?query=${encodeURIComponent(query)}`;
    const response = await axios.get(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
        },
        timeout: 15000,
    });
    return response.data;
}

async function fetchArticleContent(url) {
    try {
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
            },
            timeout: 15000,
        });
        const $ = cheerio.load(response.data);
        $('script, style, .ads, .iklan, .adsbygoogle, nav, header, footer, .sidebar').remove();
        const contentSelectors = ['.detail__body-text', '.itp_bodycontent', 'div[class*="detail__body"]', '.content__body', 'article .body'];
        let content = '';
        for (const sel of contentSelectors) {
            const text = $(sel).text().replace(/\s+/g, ' ').trim();
            if (text.length > 100) { content = text; break; }
        }
        return content;
    } catch (e) { return ''; }
}

function parseDetikSearch(html) {
    const $ = cheerio.load(html);
    const articles = [];
    const selectors = ['article', '.list-content .list__item', '.list-content article', 'div.list__item'];
    let $items = $();
    for (const sel of selectors) { $items = $(sel); if ($items.length > 0) break; }
    $items.each((_, el) => {
        const $el = $(el);
        const $link = $el.find('a').first();
        const url = $link.attr('href') || '';
        const title = $el.find('.title, h2, h3').first().text().replace(/\s+/g, ' ').trim() || $link.attr('title') || $link.text().replace(/\s+/g, ' ').trim();
        const summary = $el.find('p').first().text().replace(/\s+/g, ' ').trim();
        const date = $el.find('.date, .media__date span, time').first().text().replace(/\s+/g, ' ').trim();
        const label = $el.find('.labdate, .category, .kanal').first().text().replace(/\s+/g, ' ').trim();
        const $img = $el.find('img').first();
        const image = $img.attr('data-src') || $img.attr('data-lazy') || $img.attr('data-original') || $img.attr('src') || '';
        if (url && title) {
            articles.push({ title, url: url.trim(), date, summary, label, image: image.trim(), content: '', source: 'detik' });
        }
    });
    return articles;
}

async function scrapeDetik(query, fetchContent = true) {
    try {
        const html = await fetchDetikSearch(query);
        const articles = parseDetikSearch(html);
        if (fetchContent && articles.length > 0) {
            const contents = await Promise.all(articles.map(a => fetchArticleContent(a.url)));
            contents.forEach((content, i) => { articles[i].content = content; });
        }
        return { success: true, query, timestamp: new Date().toISOString(), total_results: articles.length, articles };
    } catch (error) {
        return { success: false, query, timestamp: new Date().toISOString(), error: error.message };
    }
}

module.exports = { scrapeDetik, parseDetikSearch, fetchDetikSearch, fetchArticleContent };
