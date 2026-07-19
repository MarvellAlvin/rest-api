// api/tools/iloveimg.js
const multer = require('multer');
const { removeBg, upscale, resize } = require('../../services/iloveimg');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

const handler = async (req, res) => {
    const startTime = Date.now();
    const { action, multiplier = 2, width = 500, height = 500, percentage } = req.body;

    if (!action) {
        return res.status(400).json({
            status: false,
            statusCode: 400,
            author: '@velz',
            error: 'Parameter "action" wajib diisi. Pilihan: remove-bg, upscale, resize.',
            responseTimeMs: Date.now() - startTime,
            timestamp: new Date().toISOString()
        });
    }

    if (!req.file) {
        return res.status(400).json({
            status: false,
            statusCode: 400,
            author: '@velz',
            error: 'File gambar wajib diupload sebagai multipart/form-data dengan field "file".',
            responseTimeMs: Date.now() - startTime,
            timestamp: new Date().toISOString()
        });
    }

    const fileBuffer = req.file.buffer;
    const filename = req.file.originalname;

    try {
        let result;
        switch (action) {
            case 'remove-bg':
                result = await removeBg(fileBuffer, filename);
                break;
            case 'upscale':
                result = await upscale(fileBuffer, filename, parseInt(multiplier));
                break;
            case 'resize':
                if (percentage) {
                    result = await resize(fileBuffer, filename, { percentage: parseInt(percentage) });
                } else {
                    result = await resize(fileBuffer, filename, { width: parseInt(width), height: parseInt(height), maintainRatio: true });
                }
                break;
            default:
                return res.status(400).json({
                    status: false,
                    statusCode: 400,
                    author: '@velz',
                    error: 'Action tidak dikenali. Pilihan: remove-bg, upscale, resize.',
                    responseTimeMs: Date.now() - startTime,
                    timestamp: new Date().toISOString()
                });
        }

        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Content-Disposition', `attachment; filename="${result.filename || 'output.png'}"`);
        res.send(result.buffer);
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

module.exports = [upload.single('file'), handler];
