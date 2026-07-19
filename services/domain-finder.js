// services/domain-finder.js
const axios = require('axios');
const cheerio = require('cheerio');

async function getCRT(domain) {
    const url = `https://crt.sh/?q=%25.${domain}`;
    const res = await axios.get(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        timeout: 15000
    });
    const $ = cheerio.load(res.data);
    const results = [];
    $('table.identities tr').each((_, tr) => {
        const td = $(tr).find('td');
        if (td.length < 6) return;
        results.push({
            crtsh_id: $(td[0]).text().trim(),
            logged_at: $(td[1]).text().trim(),
            not_before: $(td[2]).text().trim(),
            not_after: $(td[3]).text().trim(),
            common_name: $(td[4]).text().trim(),
            matching_identities: $(td[5]).text().split('\n').map(v => v.trim()).filter(Boolean)
        });
    });
    return results;
}

module.exports = { getCRT };
