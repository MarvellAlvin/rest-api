// services/iloveimg.js
const axios = require('axios');
const cheerio = require('cheerio');
const FormData = require('form-data');

async function iloveimg(fileBuffer, filename, endpoint, toolName, processParams = {}, uploadMime = 'application/octet-stream') {
    const landingUrl = `https://www.iloveimg.com/${endpoint}`;
    const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
    };

    const response = await axios.get(landingUrl, { headers });
    const $ = cheerio.load(response.data);

    let token = '', taskId = '', servers = [];
    $('script').each((i, el) => {
        const content = $(el).html();
        if (content && content.includes('ilovepdfConfig')) {
            const configMatch = content.match(/var\s+ilovepdfConfig\s*=\s*(\{.*?\});/s);
            if (configMatch) {
                const config = JSON.parse(configMatch[1]);
                token = config.token;
                servers = config.servers;
            }
            const taskIdMatch = content.match(/ilovepdfConfig\.taskId\s*=\s*'([^']+)'/);
            if (taskIdMatch) taskId = taskIdMatch[1];
        }
    });

    if (!token || !taskId || servers.length === 0) {
        throw new Error(`Gagal mengekstrak konfigurasi iLoveIMG untuk ${endpoint}`);
    }

    const randomServer = servers[Math.floor(Math.random() * servers.length)];
    const workerServer = `${randomServer}.iloveimg.com`;

    const uploadForm = new FormData();
    uploadForm.append('task', taskId);
    uploadForm.append('preview', '1');
    uploadForm.append('pdfinfo', '0');
    uploadForm.append('pdfforms', '0');
    uploadForm.append('pdfresetforms', '0');
    uploadForm.append('v', 'web.0');
    uploadForm.append('chunk', '0');
    uploadForm.append('chunks', '1');
    uploadForm.append('name', filename);
    uploadForm.append('file', fileBuffer, { filename, contentType: uploadMime });

    const uploadRes = await axios.post(`https://${workerServer}/v1/upload`, uploadForm, {
        headers: { 'Authorization': `Bearer ${token}`, ...uploadForm.getHeaders(), 'User-Agent': headers['User-Agent'] }
    });

    const serverFilename = uploadRes.data.server_filename;
    if (!serverFilename) throw new Error('Gagal mengupload file ke server iLoveIMG.');

    const processForm = new FormData();
    processForm.append('task', taskId);
    processForm.append('tool', toolName);
    for (const [key, value] of Object.entries(processParams)) processForm.append(key, String(value));
    processForm.append('files[0][server_filename]', serverFilename);
    processForm.append('files[0][filename]', filename);

    await axios.post(`https://${workerServer}/v1/process`, processForm, {
        headers: { 'Authorization': `Bearer ${token}`, ...processForm.getHeaders(), 'User-Agent': headers['User-Agent'] }
    });

    let isCompleted = false;
    for (let attempt = 0; attempt < 30; attempt++) {
        const statusRes = await axios.get(`https://${workerServer}/v1/task/${taskId}`, {
            headers: { 'Authorization': `Bearer ${token}`, 'User-Agent': headers['User-Agent'] }
        });
        const status = statusRes.data.status;
        if (status === 'TaskSuccess' || status === 'TaskSuccessWithWarnings') {
            isCompleted = true;
            break;
        } else if (status === 'TaskError') {
            throw new Error('Terjadi kesalahan saat memproses file di iLoveIMG.');
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    if (!isCompleted) throw new Error('Proses pengerjaan iLoveIMG timeout.');

    const downloadRes = await axios.get(`https://${workerServer}/v1/download/${taskId}`, {
        responseType: 'arraybuffer',
        headers: { 'Authorization': `Bearer ${token}`, 'User-Agent': headers['User-Agent'] }
    });

    return {
        filename: filename,
        buffer: Buffer.from(downloadRes.data)
    };
}

async function removeBg(imageBuffer, filename = 'image.jpg') {
    const mime = filename.endsWith('.png') ? 'image/png' : 'image/jpeg';
    return iloveimg(imageBuffer, filename, 'remove-background', 'removebackgroundimage', {}, mime);
}

async function upscale(imageBuffer, filename = 'image.jpg', multiplier = 2) {
    const mime = filename.endsWith('.png') ? 'image/png' : 'image/jpeg';
    return iloveimg(imageBuffer, filename, 'upscale-image', 'upscaleimage', { multiplier }, mime);
}

async function resize(imageBuffer, filename = 'image.jpg', options = {}) {
    const mime = filename.endsWith('.png') ? 'image/png' : 'image/jpeg';
    const params = {};
    if (options.percentage) {
        params.resize_mode = 'percentage';
        params.percentage = options.percentage;
    } else {
        params.resize_mode = 'pixels';
        params.pixels_width = options.width || 200;
        params.pixels_height = options.height || 200;
        params.maintain_ratio = options.maintainRatio !== false ? 'true' : 'false';
        params.no_enlarge_if_smaller = 'false';
    }
    return iloveimg(imageBuffer, filename, 'resize-image', 'resizeimage', params, mime);
}

module.exports = { removeBg, upscale, resize };
