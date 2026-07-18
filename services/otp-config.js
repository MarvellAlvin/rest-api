// services/otp-config.js
const axios = require('axios');

const API_KEY = 'np_live_B84zVkR9GTm3lNe0YCsAOa1jTrRUnd4rz88qr3vQqYg';
const BASE_URL = 'https://numberpanel.tech/api';
const HEADERS = { 'Authorization': `Bearer ${API_KEY}` };

/**
 * Polling OTP dengan interval tertentu
 * @param {string} number - Nomor telepon
 * @param {number} maxAttempts - Maksimal percobaan (default 3)
 * @param {number} intervalMs - Interval polling dalam milidetik (default 5000)
 * @returns {Promise<{found: boolean, otp?: string, raw?: object}>}
 */
async function pollOtp(number, maxAttempts = 3, intervalMs = 5000) {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        await new Promise(resolve => setTimeout(resolve, intervalMs));
        try {
            const { data } = await axios.get(`${BASE_URL}/latest_otp?number=${number}`, { headers: HEADERS });
            if (data.has_otp === true) {
                return {
                    found: true,
                    otp: data.otp || data.sms || 'OTP ditemukan',
                    raw: data
                };
            }
        } catch (e) {
            // ignore error, lanjut polling
        }
    }
    return { found: false };
}

module.exports = { API_KEY, BASE_URL, HEADERS, pollOtp };
