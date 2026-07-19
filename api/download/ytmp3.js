// api/download/ytmp3.js
const axios = require('axios');

const browserHeaders = {
    'User-Agent': 'Mozilla/5.0 (Linux; Android 16; Infinix X6837 Build/BP2A.250605.031.A2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.7778.217 Mobile Safari/537.36',
    'Accept': '*/*',
    'Origin': 'https://y2mate.cc',
    'Referer': 'https://y2mate.cc/',
    'X-Requested-With': 'com.xbrowser.play',
    'Sec-Fetch-Site': 'cross-site',
    'Sec-Fetch-Mode': 'cors'
};

async function ytmp3(youtubeUrl, format = 'mp3') {
    const match = /(?:youtu\.be\/|youtube\.com\/(?:embed\/|live\/|shorts\/)|[?&]v=)([a-zA-Z0-9-_]{11})/.exec(youtubeUrl);
    if (!match) throw new Error('URL YouTube tidak valid');
    const videoId = match[1];
    const endpoint = 'etacloud.org';
    const getTs = () => Date.now();

    const safeFetch = async (url, options = {}) => {
        const res = await axios.get(url, {
            headers: { ...browserHeaders, ...options.headers },
            validateStatus: () => true
        });
        if (typeof res.data === 'string' && res.data.startsWith('{')) {
            return JSON.parse(res.data);
        }
        return res.data;
    };

    const appendParam = (url, params) => url.includes('?') ? `${url}&${params}` : `${url}?${params}`;

    try {
        const authData = await safeFetch(`https://eta.${endpoint}/api/v1/auth?_=${getTs()}`);
        if (authData.error > 0) throw new Error('Authorization gagal');

        const initData = await safeFetch(`https://eta.${endpoint}/api/v1/init?_=${getTs()}`, {
            headers: { 'Authorization': `Bearer ${authData.key}` }
        });
        if (initData.error > 0) throw new Error('Initialization gagal');

        let fetchUrl = appendParam(initData.convertURL, `v=${videoId}&f=${format}&_=${getTs()}`);
        let convertData = await safeFetch(fetchUrl);
        if (convertData.error > 0) throw new Error(`Server menolak konversi. Error Code: ${convertData.error}`);
        if (convertData.redirect === 1) {
            fetchUrl = appendParam(convertData.redirectURL, `v=${videoId}&f=${format}&_=${getTs()}`);
            convertData = await safeFetch(fetchUrl);
        }

        while (convertData.progress !== undefined && convertData.progress < 3) {
            await new Promise(resolve => setTimeout(resolve, 3000));
            const progressUrl = appendParam(convertData.progressURL, `_=${getTs()}`);
            convertData = await safeFetch(progressUrl);
            if (convertData.error > 0) throw new Error('Server gagal saat men-convert');
        }

        return {
            videoId,
            format,
            title: convertData.title || '',
            downloadURL: convertData.downloadURL || ''
        };
    } catch (error) {
        throw new Error(error.message || 'Gagal mengonversi YouTube ke MP3');
    }
}

module.exports = async (req, res) => {
    const startTime = Date.now();
    const { url, format = 'mp3' } = req.method === 'GET' ? req.query : req.body;

    if (!url) {
        return res.status(400).json({
            status: false,
            statusCode: 400,
            author: '@velz',
            error: 'Parameter "url" (YouTube URL) wajib diisi.',
            responseTimeMs: Date.now() - startTime,
            timestamp: new Date().toISOString()
        });
    }

    try {
        const result = await ytmp3(url, format);
        res.status(200).json({
            status: true,
            statusCode: 200,
            author: '@velz',
            result,
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
