// api/otp/countries.js
const axios = require('axios');
const { BASE_URL, HEADERS } = require('../../services/otp-config');

module.exports = async (req, res) => {
    const startTime = Date.now();

    // Ambil parameter service dari query (GET) atau body (POST)
    const { service } = req.method === 'GET' ? req.query : req.body;

    // Validasi: service wajib diisi
    if (!service) {
        return res.status(400).json({
            status: false,
            statusCode: 400,
            author: '@velz',
            error: 'Parameter "service" wajib diisi. Contoh: ?service=WhatsApp',
            responseTimeMs: Date.now() - startTime,
            timestamp: new Date().toISOString()
        });
    }

    try {
        // Request ke API numberpanel
        const { data } = await axios.get(
            `${BASE_URL}/countries?service=${encodeURIComponent(service)}`,
            { headers: HEADERS }
        );

        // Cek apakah response sukses
        if (!data.success) {
            throw new Error(data.message || 'Gagal mengambil daftar negara.');
        }

        // Kirim response sukses
        res.status(200).json({
            status: true,
            statusCode: 200,
            author: '@velz',
            result: {
                service: data.filters?.service || service,
                countries: data.countries || [],
                total: data.countries?.length || 0,
                generated_at: data.generated_at
            },
            responseTimeMs: Date.now() - startTime,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        // Tangani error
        res.status(500).json({
            status: false,
            statusCode: 500,
            author: '@velz',
            error: error.response?.data?.error || error.message || 'Internal server error',
            responseTimeMs: Date.now() - startTime,
            timestamp: new Date().toISOString()
        });
    }
};
