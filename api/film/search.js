const axios = require('axios');
const cheerio = require('cheerio');

module.exports = async (req, res) => {
    const startTime = Date.now();
    const { query, page = 1 } = req.method === 'GET' ? req.query : req.body;

    if (!query) {
        return res.status(400).json({
            status: false,
            statusCode: 400,
            author: '@velz',
            error: 'Parameter "query" wajib diisi untuk pencarian.',
            responseTimeMs: Date.now() - startTime,
            timestamp: new Date().toISOString()
        });
    }

    try {
        const baseDomain = 'https://tv44.juragan.film';
        const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
        const encodedQuery = encodeURIComponent(query);
        const targetUrl = (page > 1)
            ? `${baseDomain}/page/${page}/?s=${encodedQuery}`
            : `${baseDomain}/?s=${encodedQuery}`;

        const response = await axios.get(targetUrl, {
            headers: { 'User-Agent': userAgent }
        });
        const $ = cheerio.load(response.data);

        const result = {
            searchQuery: query,
            currentPage: parseInt(page),
            movies: []
        };

        $('#gmr-main-load article.item').each((_, element) => {
            const el = $(element);
            const titleAnchor = el.find('.entry-title a');
            const genres = [];
            const countries = [];

            el.find('.gmr-movie-on a[rel="category tag"]').each((_, genreEl) => {
                genres.push($(genreEl).text().trim());
            });
            el.find('.gmr-movie-on [itemprop="contentLocation"] a').each((_, countryEl) => {
                countries.push($(countryEl).text().trim());
            });

            result.movies.push({
                title: titleAnchor.text().trim(),
                url: titleAnchor.attr('href'),
                thumbnail: el.find('.content-thumbnail img').attr('src'),
                type: el.find('.gmr-posttype-item').text().trim() || 'Movie',
                episode: el.find('.gmr-episode-item').text().trim() || null,
                rating: el.find('.gmr-rating-item').text().trim() || null,
                duration: el.find('.gmr-duration-item').text().trim() || null,
                quality: el.find('.gmr-quality-item a').text().trim() || null,
                subtitle: el.find('.gmr-pilihsub-item').text().trim() || null,
                genres: genres,
                countries: countries,
                trailer: el.find('.gmr-trailer-popup').attr('href') || null
            });
        });

        res.status(200).json({
            status: true,
            statusCode: 200,
            author: '@velz',
            result: result,
            responseTimeMs: Date.now() - startTime,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            status: false,
            statusCode: 500,
            author: '@velz',
            error: error.message,
            responseTimeMs: Date.now() - startTime,
            timestamp: new Date().toISOString()
        });
    }
};
