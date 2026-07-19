// services/tempmail.js
const axios = require('axios');

const BASE_URL = 'https://www.1secmail.com/api/v1/';

class Tempmail1sec {
    /**
     * Generate satu atau beberapa alamat email random
     * @param {number} count - Jumlah email yang diinginkan (default 1)
     * @returns {Promise<string[] | string>}
     */
    async generate(count = 1) {
        try {
            const response = await axios.get(`${BASE_URL}?action=genRandomMailbox&count=${count}`);
            return response.data; // array of emails
        } catch (error) {
            throw new Error(`Gagal generate email: ${error.message}`);
        }
    }

    /**
     * Ambil daftar pesan dari inbox
     * @param {string} email - Alamat email lengkap (contoh: test@1secmail.com)
     * @returns {Promise<Array>} Daftar pesan
     */
    async inbox(email) {
        const [login, domain] = email.split('@');
        if (!login || !domain) throw new Error('Format email tidak valid');

        try {
            const response = await axios.get(`${BASE_URL}?action=getMessages&login=${login}&domain=${domain}`);
            return response.data; // array of { id, from, subject, date }
        } catch (error) {
            throw new Error(`Gagal mengambil inbox: ${error.message}`);
        }
    }

    /**
     * Baca detail pesan berdasarkan ID
     * @param {string} email - Alamat email
     * @param {string} messageId - ID pesan (dari inbox)
     * @returns {Promise<Object>} Detail pesan (subject, body, attachments, dll)
     */
    async readMessage(email, messageId) {
        const [login, domain] = email.split('@');
        if (!login || !domain) throw new Error('Format email tidak valid');

        try {
            const response = await axios.get(
                `${BASE_URL}?action=readMessage&login=${login}&domain=${domain}&id=${messageId}`
            );
            return response.data;
        } catch (error) {
            throw new Error(`Gagal membaca pesan: ${error.message}`);
        }
    }
}

module.exports = Tempmail1sec;
