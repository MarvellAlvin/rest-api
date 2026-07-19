// api/tools/web2apk.js
const multer = require('multer');
const Web2ApkService = require('../../services/web2apk');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const handler = async (req, res) => {
    const startTime = Date.now();
    const { url, appName, versionName = '1.0.0', versionCode = 1 } = req.body;

    if (!url || !appName) {
        return res.status(400).json({
            status: false,
            statusCode: 400,
            author: '@velz',
            error: 'Parameter "url" dan "appName" wajib diisi.',
            responseTimeMs: Date.now() - startTime,
            timestamp: new Date().toISOString()
        });
    }

    if (!req.file) {
        return res.status(400).json({
            status: false,
            statusCode: 400,
            author: '@velz',
            error: 'File icon (image) wajib diupload sebagai multipart/form-data dengan field "icon".',
            responseTimeMs: Date.now() - startTime,
            timestamp: new Date().toISOString()
        });
    }

    try {
        const service = new Web2ApkService();
        const result = await service.build({
            url,
            appName,
            iconBuffer: req.file.buffer,
            versionName,
            versionCode: parseInt(versionCode)
        });

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

module.exports = [upload.single('icon'), handler];
