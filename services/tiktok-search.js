const axios = require('axios');

async function scrapeTiktokSearch(query, page = 1) {
    const baseUrl = "https://www.t1kt0k-lite.zone.id/api/search";
    const url = new URL(baseUrl);
    url.searchParams.append("query", query);
    url.searchParams.append("page", page.toString());

    const headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json"
    };

    const response = await axios.get(url.toString(), { headers, timeout: 15000 });
    return response.data;
}

module.exports = { scrapeTiktokSearch };
