// services/otp-config.js
const API_KEY = 'np_live_B84zVkR9GTm3lNe0YCsAOa1jTrRUnd4rz88qr3vQqYg';
const BASE_URL = 'https://numberpanel.tech/api';

const HEADERS = {
    'Authorization': `Bearer ${API_KEY}`,
    'Content-Type': 'application/json'
};

module.exports = { API_KEY, BASE_URL, HEADERS };
