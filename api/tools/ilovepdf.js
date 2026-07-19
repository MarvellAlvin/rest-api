// api/tools/ilovepdf.js
const multer = require('multer');
const { compress, imageToPdf, pdfToImage, wordToPdf, pdfToWord, pptToPdf, pdfToPpt } = require('../../services/ilovepdf');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

const handler = async (req, res) => {
    const startTime = Date.now();
    const { action } = req.body;

    if (!action) {
        return res.status(400).json({
            status: false,
            statusCode: 400,
            author: '@velz',
            error: 'Parameter "action" wajib diisi. Pilihan: compress, image-to-pdf, pdf-to-image, word-to-pdf, pdf-to-word, ppt-to-pdf, pdf-to-ppt.',
            responseTimeMs: Date.now() - startTime,
            timestamp: new Date().toISOString()
        });
    }

    if (!req.file) {
        return res.status(400).json({
            status: false,
            statusCode: 400,
            author: '@velz',
            error: 'File wajib diupload sebagai multipart/form-data dengan field "file".',
            responseTimeMs: Date.now() - startTime,
            timestamp: new Date().toISOString()
        });
    }

    const fileBuffer = req.file.buffer;
    const filename = req.file.originalname;

    try {
        let result;
        switch (action) {
            case 'compress':
                result = await compress(fileBuffer, filename);
                break;
            case 'image-to-pdf':
                result = await imageToPdf(fileBuffer, filename);
                break;
            case 'pdf-to-image':
                result = await pdfToImage(fileBuffer, filename);
                break;
            case 'word-to-pdf':
                result = await wordToPdf(fileBuffer, filename);
                break;
            case 'pdf-to-word':
                result = await pdfToWord(fileBuffer, filename);
                break;
            case 'ppt-to-pdf':
                result = await pptToPdf(fileBuffer, filename);
                break;
            case 'pdf-to-ppt':
                result = await pdfToPpt(fileBuffer, filename);
                break;
            default:
                return res.status(400).json({
                    status: false,
                    statusCode: 400,
                    author: '@velz',
                    error: 'Action tidak dikenali. Pilihan: compress, image-to-pdf, pdf-to-image, word-to-pdf, pdf-to-word, ppt-to-pdf, pdf-to-ppt.',
                    responseTimeMs: Date.now() - startTime,
                    timestamp: new Date().toISOString()
                });
        }

        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename="${result.filename || 'output'}"`);
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
