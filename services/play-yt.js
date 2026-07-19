// services/play-yt.js
const axios = require('axios');
const { createDecipheriv } = require('crypto');
const yts = require('yt-search');

const METADATA_DECRYPTION_KEY = Buffer.from('C5D58EF67A7584E4A29F6C35BBC4EB12', 'hex');

const HEADERS = {
    'Content-Type': 'application/json',
    Origin: 'https://yt.savetube.me',
    'User-Agent': 'Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36'
};

async function savetube(url, { downloadType = 'audio', quality = '320kbps' } = {}) {
    const idMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|embed\/))([a-zA-Z0-9_-]{11})/);
    if (!idMatch) throw new Error('URL tidak valid');

    const videoId = idMatch[1];
    const cdn = await axios.get('https://media.savetube.vip/api/random-cdn', { headers: HEADERS }).then(r => r.data);
    const info = await axios.post(`https://${cdn.cdn}/v2/info`, {
        url: 'https://www.youtube.com/watch?v=' + videoId
    }, { headers: HEADERS }).then(r => r.data);

    const encrypted = Buffer.from(info.data, 'base64');
    const decipher = createDecipheriv('aes-128-cbc', METADATA_DECRYPTION_KEY, encrypted.subarray(0, 16));
    const decrypted = Buffer.concat([decipher.update(encrypted.subarray(16)), decipher.final()]);
    const metadata = JSON.parse(decrypted.toString('utf8'));

    const dl = await axios.post(`https://${cdn.cdn}/download`, {
        id: videoId,
        downloadType,
        quality,
        key: metadata.key
    }, { headers: HEADERS }).then(r => r.data);

    if (!dl.data?.downloadUrl) throw new Error(dl.message || 'Gagal ambil audio');

    return {
        title: metadata.title,
        duration: metadata.durationLabel,
        thumbnail: metadata.thumbnail,
        url: dl.data.downloadUrl,
        size: dl.data.size || 0
    };
}

async function searchAndDownload(query, type = 'audio') {
    const search = await yts(query);
    if (!search.videos || search.videos.length === 0) throw new Error('Tidak ada video ditemukan');
    const video = search.videos[0];
    const result = await savetube(video.url, { downloadType: type === 'audio' ? 'audio' : 'video', quality: type === 'audio' ? '320kbps' : '720p' });
    return {
        ...result,
        author: video.author.name,
        views: video.views,
        timestamp: video.timestamp,
        videoUrl: video.url
    };
}

module.exports = { savetube, searchAndDownload };
