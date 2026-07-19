// services/tempmail.js
const axios = require('axios');

const BASE_URL = 'https://api.temp-mail.org';

class Tempmail {
    /**
     * Generate alamat email sementara
     * @param {number} length - Panjang nama email (default 10)
     * @returns {Promise<{ email: string }>}
     */
    async generate(length = 10) {
        try {
            // Gunakan endpoint request/email yang paling sederhana
            const response = await axios.get(`${BASE_URL}/request/email/format/json`, {
                params: {
                    domain: 'temp-mail.org',
                    length: length
                },
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
                    'Accept': 'application/json'
                },
                timeout: 10000
            });

            const data = response.data;
            if (data && data.email) {
                return { email: data.email };
            } else {
                throw new Error('Response tidak memiliki field email.');
            }
        } catch (error) {
            throw new Error(`Gagal generate email: ${error.message}`);
        }
    }

    /**
     * Ambil daftar pesan dari inbox
     * @param {string} email - Alamat email lengkap
     * @returns {Promise<Array>} Daftar pesan
     */
    async inbox(email) {
        try {
            const response = await axios.get(`${BASE_URL}/request/mail/id/${email}/format/json`, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
                    'Accept': 'application/json'
                },
                timeout: 10000
            });

            return response.data; // array of messages
        } catch (error) {
            throw new Error(`Gagal mengambil inbox: ${error.message}`);
        }
    }

    /**
     * Baca detail pesan berdasarkan ID
     * @param {string} email - Alamat email
     * @param {string} messageId - ID pesan
     * @returns {Promise<Object>}
     */
    async readMessage(email, messageId) {
        try {
            const response = await axios.get(`${BASE_URL}/request/mail/id/${email}/${messageId}/format/json`, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
                    'Accept': 'application/json'
                },
                timeout: 10000
            });
            return response.data;
        } catch (error) {
            throw new Error(`Gagal membaca pesan: ${error.message}`);
        }
    }
}

module.exports = Tempmail;
