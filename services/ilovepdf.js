// services/ilovepdf.js
const axios = require('axios');
const cheerio = require('cheerio');
const FormData = require('form-data');

async function ilovepdf(fileBuffer, filename, endpoint, toolName, processParams = {}, uploadMime = 'application/octet-stream') {
    const landingUrl = `https://www.ilovepdf.com/${endpoint}`;
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
        throw new Error(`Gagal mengekstrak konfigurasi iLovePDF untuk ${endpoint}`);
    }

    const randomServer = servers[Math.floor(Math.random() * servers.length)];
    const workerServer = `${randomServer}.ilovepdf.com`;

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
    if (!serverFilename) throw new Error('Gagal mengupload file ke server iLovePDF.');

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
            throw new Error('Terjadi kesalahan saat memproses file di iLovePDF.');
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    if (!isCompleted) throw new Error('Proses pengerjaan iLovePDF timeout.');

    const downloadRes = await axios.get(`https://${workerServer}/v1/download/${taskId}`, {
        responseType: 'arraybuffer',
        headers: { 'Authorization': `Bearer ${token}`, 'User-Agent': headers['User-Agent'] }
    });

    return {
        filename: filename,
        buffer: Buffer.from(downloadRes.data)
    };
}

async function compress(pdfBuffer, filename = 'document.pdf') {
    return ilovepdf(pdfBuffer, filename, 'compress_pdf', 'compress', { compression_level: 'recommended' }, 'application/pdf');
}

async function imageToPdf(imageBuffer, filename = 'image.jpg') {
    const mime = filename.endsWith('.png') ? 'image/png' : 'image/jpeg';
    return ilovepdf(imageBuffer, filename, 'jpg_to_pdf', 'imagepdf', { orientation: 'portrait', pagesize: 'A4', margin: 0, merge_after: true }, mime);
}

async function pdfToImage(pdfBuffer, filename = 'document.pdf') {
    return ilovepdf(pdfBuffer, filename, 'pdf_to_jpg', 'pdfjpg', { pdfjpg_mode: 'pages', dpi: '150' }, 'application/pdf');
}

async function wordToPdf(wordBuffer, filename = 'document.docx') {
    return ilovepdf(wordBuffer, filename, 'word_to_pdf', 'officepdf', {}, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
}

async function pdfToWord(pdfBuffer, filename = 'document.pdf') {
    return ilovepdf(pdfBuffer, filename, 'pdf_to_word', 'pdfoffice', { convert_to: 'docx' }, 'application/pdf');
}

async function pptToPdf(pptBuffer, filename = 'presentation.pptx') {
    return ilovepdf(pptBuffer, filename, 'powerpoint_to_pdf', 'officepdf', {}, 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
}

async function pdfToPpt(pdfBuffer, filename = 'document.pdf') {
    return ilovepdf(pdfBuffer, filename, 'pdf_to_powerpoint', 'pdfoffice', { convert_to: 'pptx' }, 'application/pdf');
}

module.exports = { compress, imageToPdf, pdfToImage, wordToPdf, pdfToWord, pptToPdf, pdfToPpt };
