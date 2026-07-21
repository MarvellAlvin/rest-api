// api/download/youtube.js
const axios = require('axios');
const { CookieJar } = require('tough-cookie');
const { wrapper } = require('axios-cookiejar-support');

// ===== KONFIGURASI =====
const WEB_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const VR_UA = 'com.google.android.apps.youtube.vr.oculus/1.60.19 (Linux; U; Android 12L; eureka-user Build/SQ3A.220605.009.A1) gzip';

// ===== COOKIE JAR =====
const jar = new CookieJar();
const client = wrapper(axios.create({ jar, timeout: 30000 }));

// ===== FUNGSI BANTU =====
function parseVideoId(input) {
    if (/^[a-zA-Z0-9_-]{11}$/.test(input)) return input;
    const match = String(input).match(
        /(?:youtu\.be\/|watch\?v=|\/embed\/|\/shorts\/|\/v\/)([a-zA-Z0-9_-]{11})/
    );
    if (!match) throw new Error('Video ID tidak valid / URL tidak dikenali');
    return match[1];
}

function parseFormat(f) {
    const mime = f.mimeType || '';
    const hasVideo = !!f.qualityLabel;
    const hasAudio = !!f.audioQuality || mime.startsWith('audio/');
    return {
        itag: f.itag,
        mimeType: mime.split(';')[0],
        container: (mime.match(/\/(\w+)/) || [])[1] || null,
        quality: f.qualityLabel || f.audioQuality || f.quality || null,
        hasVideo,
        hasAudio,
        muxed: hasVideo && hasAudio,
        bitrate: f.bitrate || null,
        fps: f.fps || null,
        width: f.width || null,
        height: f.height || null,
        sizeBytes: f.contentLength ? Number(f.contentLength) : null,
        sizeMB: f.contentLength ? +(Number(f.contentLength) / 1048576).toFixed(2) : null,
        url: f.url,
    };
}

// ===== GET YOUTUBE INFO =====
async function youtubeInfo(input) {
    const videoId = parseVideoId(input);

    // 1. Get HTML untuk visitorData
    const { data: html } = await client.get(`https://www.youtube.com/watch?v=${videoId}`, {
        headers: {
            'user-agent': WEB_UA,
            'accept-language': 'en-US,en;q=0.9',
            'cookie': 'CONSENT=YES+cb; SOCS=CAI'
        }
    });
    
    const visitorData = (html.match(/"visitorData":"([^"]+)"/) || [])[1];

    // 2. Request ke API YouTube
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
                visitorData,
            },
        },
        videoId,
        contentCheckOk: true,
        racyCheckOk: true,
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
                'x-goog-visitor-id': visitorData || '',
            },
        }
    );

    // 3. Check playability
    const ps = player.playabilityStatus || {};
    if (ps.status !== 'OK') {
        throw new Error(`Video tidak bisa diputar: ${ps.status} - ${ps.reason || ''}`);
    }

    // 4. Parse data
    const sd = player.streamingData || {};
    const vd = player.videoDetails || {};
    const rawFormats = [...(sd.formats || []), ...(sd.adaptiveFormats || [])].filter((f) => f.url);
    const formats = rawFormats.map(parseFormat);

    // 5. Filter MP4 muxed
    const mp4Muxed = formats
        .filter((f) => f.muxed && f.container === 'mp4')
        .sort((a, b) => (b.height || 0) - (a.height || 0));

    // 6. Filter audio only
    const audioFormats = formats
        .filter((f) => f.hasAudio && !f.hasVideo)
        .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));

    const cookies = await jar.getCookieString('https://www.youtube.com');

    return {
        videoId,
        url: `https://www.youtube.com/watch?v=${videoId}`,
        title: vd.title,
        author: vd.author,
        channelId: vd.channelId,
        lengthSeconds: Number(vd.lengthSeconds) || null,
        viewCount: Number(vd.viewCount) || null,
        thumbnail: (vd.thumbnail?.thumbnails || []).slice(-1)[0]?.url || null,
        mp4Muxed: mp4Muxed[0] || null,
        audioFormats: audioFormats,
        allFormats: formats,
        cookies: cookies || null,
    };
}

// ===== DOWNLOAD MP4 =====
async function youtubeMp4(input) {
    const info = await youtubeInfo(input);
    if (!info.mp4Muxed) {
        throw new Error('Tidak ada format MP4 muxed yang tersedia');
    }

    return {
        title: info.title,
        author: info.author,
        thumbnail: info.thumbnail,
        duration: info.lengthSeconds,
        quality: info.mp4Muxed.quality,
        sizeMB: info.mp4Muxed.sizeMB,
        downloadUrl: info.mp4Muxed.url,
        formats: {
            mp4Muxed: info.mp4Muxed,
            all: info.allFormats
        }
    };
}

// ===== DOWNLOAD MP3 =====
async function youtubeMp3(input) {
    const info = await youtubeInfo(input);
    
    // Cari audio terbaik (prioritaskan audio/mp4, lalu audio/webm)
    const audioPriority = ['audio/mp4', 'audio/webm'];
    let bestAudio = null;
    
    for (const mimeType of audioPriority) {
        const found = info.audioFormats.find(f => f.mimeType === mimeType);
        if (found) {
            bestAudio = found;
            break;
        }
    }
    
    // Jika tidak ada yang cocok, ambil audio dengan bitrate tertinggi
    if (!bestAudio && info.audioFormats.length > 0) {
        bestAudio = info.audioFormats[0];
    }
    
    if (!bestAudio) {
        throw new Error('Tidak ada format audio yang tersedia');
    }

    return {
        title: info.title,
        author: info.author,
        thumbnail: info.thumbnail,
        duration: info.lengthSeconds,
        bitrate: bestAudio.bitrate ? `${Math.round(bestAudio.bitrate / 1000)} kbps` : 'N/A',
        sizeMB: bestAudio.sizeMB,
        downloadUrl: bestAudio.url,
        format: bestAudio.mimeType
    };
}

// ===== MAIN DOWNLOADER =====
async function youtubeDownloader(input, format = 'mp4') {
    if (format === 'mp4') {
        return await youtubeMp4(input);
    } else if (format === 'mp3') {
        return await youtubeMp3(input);
    } else {
        throw new Error('Format tidak didukung. Gunakan: mp4 atau mp3');
    }
}

// ========== ENDPOINT UTAMA ==========
module.exports = async (req, res) => {
    const startTime = Date.now();

    // Ambil parameter dari query (GET) atau body (POST)
    const { url, format = 'mp4' } = req.method === 'GET' ? req.query : req.body;

    // ===== VALIDASI =====
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

    // Validasi format
    if (format && !['mp4', 'mp3'].includes(format.toLowerCase())) {
        return res.status(400).json({
            status: false,
            statusCode: 400,
            author: '@velz',
            error: 'Format tidak didukung. Gunakan: mp4 atau mp3',
            responseTimeMs: Date.now() - startTime,
            timestamp: new Date().toISOString()
        });
    }

    try {
        // Proses download
        const result = await youtubeDownloader(url, format.toLowerCase());

        // ===== RESPON SUKSES =====
        res.status(200).json({
            status: true,
            statusCode: 200,
            author: '@velz',
            result: {
                ...result,
                source: 'YouTube'
            },
            responseTimeMs: Date.now() - startTime,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('[YouTube Downloader] Error:', error.message);

        // ===== RESPON ERROR =====
        let statusCode = 500;
        let errorMessage = error.message;

        if (error.message.includes('Video tidak bisa diputar')) {
            statusCode = 403;
        } else if (error.message.includes('Video ID tidak valid')) {
            statusCode = 400;
        } else if (error.message.includes('timeout')) {
            statusCode = 408;
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
