const https = require('https');
const http = require('http');
const url = require('url');
const querystring = require('querystring');
const zlib = require('zlib');

class WikipediaSearch {
    constructor() {
        this.userAgents = [
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15',
            'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0'
        ];
    }

    getRandomUserAgent() { return this.userAgents[Math.floor(Math.random() * this.userAgents.length)]; }

    request(options) {
        return new Promise((resolve) => {
            const parsedOptions = { ...options };
            if (!parsedOptions.headers) parsedOptions.headers = {};
            parsedOptions.headers['User-Agent'] = this.getRandomUserAgent();
            parsedOptions.headers['Accept'] = 'application/json, text/plain, */*';
            parsedOptions.headers['Accept-Language'] = 'en-US,en;q=0.9';
            parsedOptions.headers['Accept-Encoding'] = 'gzip, deflate';
            parsedOptions.headers['Connection'] = 'keep-alive';
            parsedOptions.timeout = options.timeout || 15000;
            parsedOptions.rejectUnauthorized = false;

            const protocol = parsedOptions.protocol === 'https:' ? https : http;
            const req = protocol.request(parsedOptions, (res) => {
                let chunks = [];
                res.on('data', chunk => chunks.push(chunk));
                res.on('end', () => {
                    let buffer = Buffer.concat(chunks);
                    let body = buffer.toString('utf-8');
                    const encoding = res.headers['content-encoding'];
                    if (encoding === 'gzip' || encoding === 'deflate') {
                        try { const decompressed = zlib.gunzipSync(buffer); body = decompressed.toString('utf-8'); } catch (e) {}
                    }
                    resolve({ statusCode: res.statusCode, headers: res.headers, body });
                });
            });
            req.on('error', (err) => resolve({ statusCode: 503, body: '', error: err.message }));
            req.on('timeout', () => { req.destroy(); resolve({ statusCode: 408, body: '', error: 'Timeout' }); });
            if (options.body) req.write(options.body);
            req.end();
        });
    }

    async search(query, limit = 10) {
        const encodedQuery = querystring.escape(query);
        const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodedQuery}&format=json&srlimit=${Math.min(limit, 50)}`;
        const parsed = new URL(searchUrl);
        const options = {
            protocol: parsed.protocol, hostname: parsed.hostname, port: parsed.port || 443,
            path: parsed.pathname + parsed.search, method: 'GET', headers: {}, timeout: 15000
        };
        try {
            const response = await this.request(options);
            if (response.error || response.statusCode !== 200) return [];
            if (!response.body || response.body.trim() === '') return [];
            const data = JSON.parse(response.body);
            const searchResults = data?.query?.search || [];
            if (searchResults.length === 0) return [];
            const results = [];
            for (const item of searchResults) {
                const title = item.title || '';
                if (title) {
                    results.push({
                        title,
                        url: `https://en.wikipedia.org/wiki/${title.replace(/ /g, '_')}`,
                        snippet: item.snippet ? item.snippet.replace(/<[^>]+>/g, '').trim() : '',
                        pageId: item.pageid || ''
                    });
                }
                if (results.length >= limit) break;
            }
            return results;
        } catch (error) { return []; }
    }

    async getPageContent(title) {
        const encodedTitle = querystring.escape(title);
        const pageUrl = `https://en.wikipedia.org/w/api.php?action=query&prop=extracts&exintro&explaintext&titles=${encodedTitle}&format=json`;
        const parsed = new URL(pageUrl);
        const options = {
            protocol: parsed.protocol, hostname: parsed.hostname, port: parsed.port || 443,
            path: parsed.pathname + parsed.search, method: 'GET', headers: {}, timeout: 15000
        };
        try {
            const response = await this.request(options);
            if (response.statusCode !== 200) return null;
            const data = JSON.parse(response.body);
            const pages = data?.query?.pages || {};
            const pageIds = Object.keys(pages);
            if (pageIds.length === 0 || pageIds[0] === '-1') return null;
            const pageId = pageIds[0];
            return { title: pages[pageId].title || title, extract: pages[pageId].extract || '', pageId };
        } catch (error) { return null; }
    }
}

module.exports = WikipediaSearch;
