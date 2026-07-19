const https = require('https');
const http = require('http');
const url = require('url');
const querystring = require('querystring');
const zlib = require('zlib');

class YouTubeScraper {
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
        const searchUrl = `https://www.youtube.com/results?search_query=${encodedQuery}&sp=EgIQAQ%3D%3D`;
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
            const results = [];
            // Parse ytInitialData
            const jsonMatch = html.match(/var ytInitialData = ([\s\S]*?);<\/script>/i);
            if (jsonMatch) {
                try {
                    const data = JSON.parse(jsonMatch[1]);
                    const contents = data?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents || [];
                    for (const section of contents) {
                        const items = section?.itemSectionRenderer?.contents || [];
                        for (const item of items) {
                            const video = item?.videoRenderer;
                            if (video) {
                                const title = video?.title?.runs?.[0]?.text || '';
                                const videoId = video?.videoId || '';
                                const channelName = video?.ownerText?.runs?.[0]?.text || '';
                                const views = video?.viewCountText?.simpleText || '';
                                const published = video?.publishedTimeText?.simpleText || '';
                                const duration = video?.lengthText?.simpleText || '';
                                const thumbnail = video?.thumbnail?.thumbnails?.[0]?.url || '';
                                if (title && videoId) {
                                    results.push({
                                        title,
                                        videoId,
                                        url: `https://www.youtube.com/watch?v=${videoId}`,
                                        channelName,
                                        views,
                                        published,
                                        duration,
                                        thumbnail
                                    });
                                }
                            }
                        }
                        if (results.length >= limit) break;
                    }
                } catch (e) {}
            }
            if (results.length === 0) {
                const videoMatches = html.match(/{"videoId":"([^"]+)","title":{"runs":\[{"text":"([^"]+)"}/g) || [];
                for (const match of videoMatches) {
                    const idMatch = match.match(/"videoId":"([^"]+)"/);
                    const titleMatch = match.match(/"text":"([^"]+)"/);
                    if (idMatch && titleMatch) {
                        const videoId = idMatch[1];
                        const title = titleMatch[1];
                        if (!results.some(r => r.videoId === videoId)) {
                            results.push({ title, videoId, url: `https://www.youtube.com/watch?v=${videoId}`, channelName: '', views: '', published: '', duration: '', thumbnail: '' });
                        }
                    }
                }
            }
            return results.slice(0, limit);
        } catch (error) { return []; }
    }
}

module.exports = YouTubeScraper;
