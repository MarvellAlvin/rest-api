const axios = require("axios");
const cheerio = require("cheerio");
const { CookieJar } = require("tough-cookie");
const { wrapper } = require("axios-cookiejar-support");

const jar = new CookieJar();
const client = wrapper(axios.create({ jar }));

const HEADERS = {
    "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "accept-language": "id-ID,id;q=0.9,en;q=0.8",
    "referer": "https://pantunis.com/",
};

const pantunSearch = async (kata) => {
    try {
        if (!kata) throw new Error("Kata kunci wajib diisi");
        const { data: html } = await client.get("https://pantunis.com/cari", { params: { kata }, headers: HEADERS });
        const $ = cheerio.load(html);
        const results = [];
        $(".card").each((_, el) => {
            const $el = $(el);
            const $link = $el.find('a[href^="/pantun/"]').first();
            if (!$link.length) return;
            const href = $link.attr("href");
            const id = (href.match(/\/pantun\/(\d+)/) || [])[1] || null;
            const lines = $el.find(".card-body p").map((_, p) => $(p).text().trim().replace(/\s+/g, " ")).get().filter(Boolean);
            const highlights = [...new Set($el.find(".card-body strong.text-primary").map((_, s) => $(s).text().trim()).get())];
            const $footer = $el.find(".card-footer small");
            const source = $footer.eq(0).find("span").text().trim() || null;
            const author = $footer.eq(1).find("span").text().trim() || null;
            results.push({ id: id ? Number(id) : null, url: `https://pantunis.com${href}`, pantun: lines, sampiran: lines.slice(0, 2), isi: lines.slice(2), highlights, source, author });
        });
        if (!results.length) throw new Error("Tidak ada hasil ditemukan");
        const cookies = await jar.getCookieString("https://pantunis.com");
        return { status: true, kata, total: results.length, cookies: cookies || null, results };
    } catch (error) {
        return { status: false, error: error.message };
    }
};

module.exports = { pantunSearch };
