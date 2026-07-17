// api/tools/scanurl.js
const axios = require('axios');

/**
 * Fungsi utama untuk scan URL menggunakan pindaidulu.com
 */
async function scanUrl(url) {
    try {
        const response = await axios.post(
            'https://pindaidulu.com/api/scan',
            { url: url },
            {
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': '*/*',
                    'Origin': 'https://pindaidulu.com',
                    'Referer': 'https://pindaidulu.com/',
                    'User-Agent': 'Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Mobile Safari/537.36',
                    // ⚠️ Cookie ini mungkin kadaluarsa. Perbarui secara berkala.
                    'Cookie': 'cf_clearance=92fK0OAwH5JnZuCx5CDmwbZgmuzMJMnI9q97fdS8jg0-170166936-1.2.1.1-LJThU31n081UjvyQNxC6NoItG1gzU63dI3WqVtF0UuUxwvYcd3sqvJXv81nqLH4f47IYHWwm.zMLWOLGr_3msWlXL4VPyJv0kFmNcXzmnuEaP.LZpx8WKaLXAhYzOsz5Nm.jRDrqfYshW78fO4eAYrU2xP3DxZPkTGqtnAgNVJ1_E65_vHsY0NjJXl4Br.mw88jjJknnAYZUq5NA7YCShTnCSDNMDX1NPdztZB979E8C36foQhszGs2mnhlc1ZHh196DZiUfS1MP1yGT_3jg_GAfHuGQ6XxdW0YUA7KCSkbD9D9ZRP_Ge4y9tDR0fBg'
                }
            }
        );

        return response.data;
    } catch (error) {
        throw new Error(error.response?.data?.message || error.message);
    }
}

/**
 * Normalisasi hasil scan
 */
function normalizeScanResult(data) {
    // Hasil dari pindaidulu biasanya memiliki properti:
    // - status (boolean)
    // - message (string)
    // - result (object) berisi: url, status, threat, dll.
    return {
        url: data.result?.url || data.url || 'Unknown',
        status: data.status || false,
        message: data.message || 'No message',
        threat: data.result?.threat || 'Unknown',
        scanId: data.result?.scan_id || null,
        rawResult: data
    };
}

// ===== ROUTE HANDLER EXPRESS =====
module.exports = async (req, res) => {
    const startTime = Date.now();

    const { url } = req.method === 'GET' ? req.query : req.body;

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

    try {
        const rawResult = await scanUrl(url);
        const normalized = normalizeScanResult(rawResult);

        const response = {
            status: true,
            statusCode: 200,
            author: '@velz',
            result: normalized,
            responseTimeMs: Date.now() - startTime,
            timestamp: new Date().toISOString()
        };

        res.status(200).json(response);
    } catch (error) {
        res.status(500).json({
            status: false,
            statusCode: 500,
            author: '@velz',
            error: error.message || 'Gagal memindai URL.',
            responseTimeMs: Date.now() - startTime,
            timestamp: new Date().toISOString()
        });
    }
};
