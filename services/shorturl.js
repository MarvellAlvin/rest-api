// services/shorturl.js
const axios = require('axios');

async function shortUrl(longUrl) {
    try {
        const response = await axios.get(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(longUrl)}`);
        return response.data;
    } catch (error) {
        throw new Error('Gagal memperpendek URL.');
    }
}

module.exports = { shortUrl };
