// api/download/ytmp4.js
const axios = require('axios');
const { CookieJar } = require('tough-cookie');
const { wrapper } = require('axios-cookiejar-support');

const jar = new CookieJar();
const client = wrapper(axios.create({ jar }));

const WEB_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const VR_UA = 'com.google.android.apps.youtube.vr.oculus/1.60.19 (Linux; U; Android 12L; eureka-user Build/SQ3A.220605.009.A1) gzip';

function parseVideoId(input) {
    if (/^[a-zA-Z0-9_-]{11}$/.test(input)) return input;
    const m = String(input).match(/(?:youtu\.be\/|watch\?v=|\/embed\/|\/shorts\/|\/v\/)([a-zA-Z0-9_-]{11})/);
    if (!m) throw new Error('Video ID tidak valid');
    return m[1];
}

function parseFormat(f) {
    const mime = f.mimeType || '';
    return {
        itag: f.itag,
        mimeType: mime.split(';')[0],
        container: (mime.match(/\/(\w+)/) || [])[1] || null,
        quality: f.qualityLabel || f.audioQuality || f.quality || null,
        hasVideo: !!f.qualityLabel,
        hasAudio: !!f.audioQuality || mime.startsWith('audio/'),
        muxed: !!f.qualityLabel && (!!f.audioQuality || mime.startsWith('audio/')),
        bitrate: f.bitrate || null,
        fps: f.fps || null,
        width: f.width || null,
        height: f.height || null,
        sizeBytes: f.contentLength ? Number(f.contentLength) : null,
        sizeMB: f.contentLength ? +(Number(f.contentLength) / 1048576).toFixed(2) : null,
        url: f.url
    };
}

async function youtubeInfo(input) {
    const videoId = parseVideoId(input);
    const { data: html } = await client.get(`https://www.youtube.com/watch?v=${videoId}`, {
        headers: { 'user-agent': WEB_UA, 'accept-language': 'en-US,en;q=0.9', cookie: 'CONSENT=YES+cb; SOCS=CAI' }
    });
    const visitorData = (html.match(/"visitorData":"([^"]+)"/) || [])[1];

    const body = {
        context: {
            client: {
                clientName: 'ANDROID_VR',
                clientVersion: '1.60.19',
                deviceMake: 'Oculus',
                deviceModel: 'Quest 3',
                androidSdkVersion: 32,
                osName: 'Android',
                osVersion: '12L',
                hl: 'en',
                gl: 'US',
                visitorData
            }
        },
        videoId,
        contentCheckOk: true,
        racyCheckOk: true
    };

    const { data: player } = await client.post(
        'https://www.youtube.com/youtubei/v1/player?prettyPrint=false',
        body,
        {
            headers: {
                'user-agent': VR_UA,
                'content-type': 'application/json',
                'x-youtube-client-name': '28',
                'x-youtube-client-version': '1.60.19',
                'x-goog-visitor-id': visitorData || ''
            }
        }
    );

    const ps = player.playabilityStatus || {};
    if (ps.status !== 'OK') {
        throw new Error(`Video tidak bisa diputar: ${ps.status} - ${ps.reason || ''}`);
    }

    const sd = player.streamingData || {};
    const vd = player.videoDetails || {};
    const rawFormats = [...(sd.formats || []), ...(sd.adaptiveFormats || [])].filter(f => f.url);
    const formats = rawFormats.map(parseFormat);

    const mp4Muxed = formats.filter(f => f.muxed && f.container === 'mp4')
        .sort((a, b) => (b.height || 0) - (a.height || 0));

    return {
        videoId,
        title: vd.title,
        author: vd.author,
        channelId: vd.channelId,
        lengthSeconds: Number(vd.lengthSeconds) || null,
        viewCount: Number(vd.viewCount) || null,
        thumbnail: (vd.thumbnail?.thumbnails || []).slice(-1)[0]?.url || null,
        download: mp4Muxed[0] || null,
        allFormats: formats
    };
}

async function youtubeMp4(input) {
    const info = await youtubeInfo(input);
    if (!info.download) throw new Error('Tidak ada format MP4 muxed yang tersedia');
    return {
        title: info.title,
        author: info.author,
        thumbnail: info.thumbnail,
        lengthSeconds: info.lengthSeconds,
        quality: info.download.quality,
        sizeMB: info.download.sizeMB,
        downloadUrl: info.download.url
    };
}

module.exports = async (req, res) => {
    const startTime = Date.now();
    const { url } = req.method === 'GET' ? req.query : req.body;

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
        const result = await youtubeMp4(url);
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
