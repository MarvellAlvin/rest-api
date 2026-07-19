// api/tempmail1sec/inbox.js
const Tempmail1sec = require('../../services/tempmail');

module.exports = async (req, res) => {
    const startTime = Date.now();
    const { email, readId } = req.method === 'GET' ? req.query : req.body;

    if (!email) {
        return res.status(400).json({
            status: false,
            statusCode: 400,
            author: '@velz',
            error: 'Parameter "email" wajib diisi.',
            responseTimeMs: Date.now() - startTime,
            timestamp: new Date().toISOString()
        });
    }

    // Validasi format email
    if (!email.includes('@') || !email.split('@')[1]) {
        return res.status(400).json({
            status: false,
            statusCode: 400,
            author: '@velz',
            error: 'Format email tidak valid.',
            responseTimeMs: Date.now() - startTime,
            timestamp: new Date().toISOString()
        });
    }

    try {
        const tempmail = new Tempmail1sec();

        // Jika ada readId, baca detail pesan
        if (readId) {
            const detail = await tempmail.readMessage(email, readId);
            return res.status(200).json({
                status: true,
                statusCode: 200,
                author: '@velz',
                result: detail,
                responseTimeMs: Date.now() - startTime,
                timestamp: new Date().toISOString()
            });
        }

        // Jika tidak, ambil daftar pesan
        const messages = await tempmail.inbox(email);

        // Jika tidak ada pesan
        if (!messages || messages.length === 0) {
            return res.status(200).json({
                status: true,
                statusCode: 200,
                author: '@velz',
                result: {
                    email,
                    messages: [],
                    total: 0,
                    note: 'Belum ada pesan masuk. Coba kirim email ke alamat ini.'
                },
                responseTimeMs: Date.now() - startTime,
                timestamp: new Date().toISOString()
            });
        }

        // Kirim daftar pesan dengan petunjuk untuk baca detail
        res.status(200).json({
            status: true,
            statusCode: 200,
            author: '@velz',
            result: {
                email,
                messages: messages,
                total: messages.length,
                hint: 'Gunakan parameter "readId" dengan ID pesan untuk membaca detail.'
            },
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
