const https = require('https');
const http = require('http');
const url = require('url');
const querystring = require('querystring');
const zlib = require('zlib');

class PlayStoreScraper {
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
            parsedOptions.headers['Accept'] = 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8';
            parsedOptions.headers['Accept-Language'] = 'en-US,en;q=0.9';
            parsedOptions.headers['Accept-Encoding'] = 'gzip, deflate, br';
            parsedOptions.headers['Connection'] = 'keep-alive';
            parsedOptions.headers['Upgrade-Insecure-Requests'] = '1';
            parsedOptions.timeout = options.timeout || 20000;
            parsedOptions.rejectUnauthorized = false;

            const protocol = parsedOptions.protocol === 'https:' ? https : http;
            const req = protocol.request(parsedOptions, (res) => {
                let chunks = [];
                res.on('data', chunk => chunks.push(chunk));
                res.on('end', () => {
                    let buffer = Buffer.concat(chunks);
                    let body = buffer.toString('utf-8');
                    const encoding = res.headers['content-encoding'];
                    if (encoding === 'gzip' || encoding === 'deflate') { try { const decompressed = zlib.gunzipSync(buffer); body = decompressed.toString('utf-8'); } catch (e) {} }
                    else if (encoding === 'br') { try { const decompressed = zlib.brotliDecompressSync(buffer); body = decompressed.toString('utf-8'); } catch (e) {} }
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
        const searchUrl = `https://play.google.com/store/search?q=${encodedQuery}&c=apps&hl=en&gl=US`;
        const parsed = new URL(searchUrl);
        const options = {
            protocol: parsed.protocol, hostname: parsed.hostname, port: parsed.port || 443,
            path: parsed.pathname + parsed.search, method: 'GET', headers: {}, timeout: 20000
        };
        try {
            const response = await this.request(options);
            if (response.error || response.statusCode !== 200) return [];
            const html = response.body;
            if (!html || html.length < 1000) return [];
            const results = this.parseResults(html, limit);
            if (results.length === 0) {
                const fallbackResults = this.parseResultsFallback(html, limit);
                if (fallbackResults.length > 0) return fallbackResults;
            }
            return results;
        } catch (error) { return []; }
    }

    parseResults(html, limit) {
        const results = [];
        try {
            const appRegex = /<a[^>]*href="\/store\/apps\/details\?id=([^"]+)"[^>]*>[\s\S]*?<span[^>]*class="[^"]*title[^"]*"[^>]*>([^<]+)<\/span>[\s\S]*?<span[^>]*class="[^"]*subtitle[^"]*"[^>]*>([^<]*)<\/span>[\s\S]*?<span[^>]*class="[^"]*rating[^"]*"[^>]*>([^<]*)<\/span>/gi;
            let match; const tempResults = [];
            while ((match = appRegex.exec(html)) !== null) {
                const appId = match[1] || '', title = match[2] || '', developer = match[3] || '', rating = match[4] || '';
                if (title && appId) tempResults.push({ title: title.trim(), appId, url: `https://play.google.com/store/apps/details?id=${appId}`, developer: developer.trim(), rating: rating.trim(), description: '', icon: '' });
                if (tempResults.length >= limit * 2) break;
            }
            // icon dan desc parsing...
            const iconRegex = /<img[^>]*srcset="([^"]+)"[^>]*>/gi;
            let iconMatch, iconIndex = 0;
            while ((iconMatch = iconRegex.exec(html)) !== null && iconIndex < tempResults.length) {
                const iconUrl = iconMatch[1].split(',')[0].split(' ')[0];
                if (iconUrl && tempResults[iconIndex]) tempResults[iconIndex].icon = iconUrl;
                iconIndex++;
            }
            const descRegex = /<span[^>]*class="[^"]*description[^"]*"[^>]*>([\s\S]*?)<\/span>/gi;
            let descMatch, descIndex = 0;
            while ((descMatch = descRegex.exec(html)) !== null && descIndex < tempResults.length) {
                const desc = descMatch[1].replace(/<[^>]+>/g, '').trim();
                if (desc && tempResults[descIndex]) tempResults[descIndex].description = desc.substring(0, 200);
                descIndex++;
            }
            for (const item of tempResults) {
                if (!results.some(r => r.appId === item.appId)) results.push(item);
                if (results.length >= limit) break;
            }
        } catch (e) {}
        return results.slice(0, limit);
    }

    parseResultsFallback(html, limit) {
        const results = [];
        try {
            const idRegex = /href="\/store\/apps\/details\?id=([^"]+)"/g;
            const titleRegex = /<span[^>]*class="[^"]*title[^"]*"[^>]*>([^<]+)<\/span>/g;
            const devRegex = /<span[^>]*class="[^"]*subtitle[^"]*"[^>]*>([^<]*)<\/span>/g;
            const ratingRegex = /<span[^>]*class="[^"]*rating[^"]*"[^>]*>([^<]*)<\/span>/g;
            const ids = []; let match;
            while ((match = idRegex.exec(html)) !== null) ids.push(match[1]);
            const titles = []; while ((match = titleRegex.exec(html)) !== null) titles.push(match[1].trim());
            const devs = []; while ((match = devRegex.exec(html)) !== null) devs.push(match[1].trim());
            const ratings = []; while ((match = ratingRegex.exec(html)) !== null) ratings.push(match[1].trim());
            const uniqueIds = [...new Set(ids)];
            for (let i = 0; i < Math.min(uniqueIds.length, limit); i++) {
                const appId = uniqueIds[i];
                results.push({ title: titles[i] || 'App ' + (i+1), appId, url: `https://play.google.com/store/apps/details?id=${appId}`, developer: devs[i] || '', rating: ratings[i] || '', description: '', icon: `https://play-lh.googleusercontent.com/${appId}` });
            }
        } catch (e) {}
        return results;
    }
}

module.exports = PlayStoreScraper;
