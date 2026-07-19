// api/download/tiktok.js
const axios = require('axios');
const crypto = require('crypto');

const BASE_URL = 'https://appdl.pro/';
const APP_VERSION = '1.55';
const SSS_SALT = 'ssstik.io';
const SSS_KEY = 'b0lF_14022023_DK';

const client = axios.create({ baseURL: BASE_URL });

function simpleIntStrConvert(text) {
    let out = '';
    for (const ch of text) {
        out += String(ch.charCodeAt(0)).padStart(3, '0');
    }
    return out;
}

function md5(str) {
    return crypto.createHash('md5').update(Buffer.from(str, 'utf8')).digest('hex');
}

function generateTs() {
    return String(Math.floor(Date.now() / 1000 / 60));
}

function generateTt(id, ts) {
    const raw = ts + APP_VERSION + id + SSS_SALT + SSS_KEY;
    const conv = simpleIntStrConvert(raw);
    return md5(String(conv.length) + conv);
}

function buildUserAgent(ip = '192.168.0.101') {
    return `ssstik.io/${APP_VERSION}/${ip}/(com.universal.video.downloader)`;
}

let cookieStore = {};

function grabCookies(res) {
    const setCookie = res.headers?.['set-cookie'];
    if (!Array.isArray(setCookie)) return;
    for (const c of setCookie) {
        const [pair] = c.split(';');
        const idx = pair.indexOf('=');
        if (idx > 0) {
            cookieStore[pair.slice(0, idx).trim()] = pair.slice(idx + 1).trim();
        }
    }
}

function cookieHeader() {
    const keys = Object.keys(cookieStore);
    return keys.length ? keys.map(k => `${k}=${cookieStore[k]}`).join('; ') : null;
}

async function fetchInfo(id, hd = false) {
    const ts = generateTs();
    const tt = generateTt(id, ts);
    const payload = new URLSearchParams({ id, locale: 'en', tt, ts }).toString();
    const cookie = cookieHeader();

    const res = await client.post(hd ? '1/fetch?hd' : '1/fetch', payload, {
        headers: {
            'user-agent': buildUserAgent(),
            'authorization': 'd9a97b094b5a1cdbfaab98d117031de5f01e4faec165c5a6bdc452d1a52fc268',
            'accept': 'application/json',
            'content-type': 'application/x-www-form-urlencoded',
            'accept-encoding': 'gzip',
            ...(cookie ? { cookie } : {})
        },
        decompress: true,
        validateStatus: () => true
    });
    grabCookies(res);
    return res.data;
}

async function tiktokDownloader(url, options = { hd: false }) {
    if (!url || !/tiktok\.com/i.test(url)) throw new Error('URL TikTok tidak valid');

    const data = await fetchInfo(url, false);
    if (!data || !data.itemId) {
        const msg = data?.error?.message || 'Gagal mengambil data dari server';
        throw new Error(msg);
    }

    const result = {
        id: data.itemId,
        type: data.type === 2 ? 'image' : 'video',
        title: data.text || null,
        author: {
            id: data.author_id,
            username: data.author_unique_id,
            nickname: data.author_nickname,
            avatar: data.author_cover_link || null
        },
        stats: {
            views: data.play_count,
            likes: data.like_count,
            comments: data.comment_count,
            shares: data.share_count
        },
        duration: data.duration,
        createTime: data.create_time,
        cover: data.cover_link || data.origin_cover || null,
        music: data.music_link || null,
        download: {
            noWatermark: data.no_watermark_link || null,
            noWatermarkHd: data.no_watermark_link_hd || null,
            watermark: data.watermark_link || null
        },
        slides: data.slides || null
    };

    if (options.hd && !result.download.noWatermarkHd) {
        const hdData = await fetchInfo(url, true);
        if (hdData?.no_watermark_link_hd) {
            result.download.noWatermarkHd = hdData.no_watermark_link_hd;
        }
    }

    return result;
}

module.exports = async (req, res) => {
    const startTime = Date.now();
    const { url, hd = false } = req.method === 'GET' ? req.query : req.body;

    if (!url) {
        return res.status(400).json({
            status: false,
            statusCode: 400,
            author: '@velz',
            error: 'Parameter "url" wajib diisi.',
            responseTimeMs: Date.now() - startTime,
            timestamp: new Date().toISOString()
        });
    }

    try {
        const result = await tiktokDownloader(url, { hd: hd === 'true' || hd === true });
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
