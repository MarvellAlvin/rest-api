// api/film/homepage.js
const axios = require('axios');
const cheerio = require('cheerio');

class JuraganFilmScraper {
    constructor() {
        this.baseDomain = 'https://tv44.juragan.film';
        this.userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
        this.defaultHeaders = {
            'User-Agent': this.userAgent,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'id,en-US;q=0.7,en;q=0.3'
        };
    }

    _buildPagedUrl(basePath, pageNumber) {
        return (pageNumber && pageNumber > 1) ? `${basePath}/page/${pageNumber}/` : `${basePath}/`;
    }

    async scrapeHomepage(pageNumber = 1) {
        try {
            const targetUrl = this._buildPagedUrl(this.baseDomain, pageNumber);
            const response = await axios.get(targetUrl, { headers: this.defaultHeaders });
            const $ = cheerio.load(response.data);

            const homepageData = {
                currentPage: pageNumber,
                featuredSlider: [],
                boxOffice: [],
                seriesOngoing: [],
                latestMovies: []
            };

            // Featured Slider
            $('.gmr-owl-carousel .gmr-slider-content').each((_, element) => {
                const el = $(element);
                const anchor = el.find('.other-content-thumbnail a');
                homepageData.featuredSlider.push({
                    title: el.find('.gmr-slide-titlelink').text().trim(),
                    url: anchor.attr('href'),
                    thumbnail: anchor.find('img').attr('data-src') || anchor.find('img').attr('src'),
                    episode: el.find('.strokeepisode').text().trim() || null
                });
            });

            // Box Office
            $('#muvipro-posts-2 .gmr-module-posts [itemtype="http://schema.org/Movie"]').each((_, element) => {
                const el = $(element);
                const titleAnchor = el.find('.entry-title a');
                homepageData.boxOffice.push({
                    title: titleAnchor.find('.strokeme').text().trim(),
                    url: titleAnchor.attr('href'),
                    thumbnail: el.find('img').attr('src'),
                    rating: el.find('.gmr-rating-item').text().trim(),
                    quality: el.find('.gmr-quality-item a').text().trim(),
                    trailer: el.find('.gmr-trailer-popup').attr('href') || null
                });
            });

            // Series Ongoing
            $('#muvipro-posts-8 .gmr-module-posts [itemtype="http://schema.org/Movie"]').each((_, element) => {
                const el = $(element);
                const titleAnchor = el.find('.entry-title a');
                homepageData.seriesOngoing.push({
                    title: titleAnchor.find('.strokeme').text().trim(),
                    url: titleAnchor.attr('href'),
                    thumbnail: el.find('img').attr('src'),
                    rating: el.find('.gmr-rating-item').text().trim() || null,
                    episode: el.find('.strokeepisode').last().text().trim() || null
                });
            });

            // Latest Movies
            $('#gmr-main-load article.item').each((_, element) => {
                const el = $(element);
                const titleAnchor = el.find('.entry-title a');
                const categories = [];
                el.find('.gmr-movie-on a[rel="category tag"]').each((_, catEl) => {
                    categories.push($(catEl).text().trim());
                });
                homepageData.latestMovies.push({
                    title: titleAnchor.text().trim(),
                    url: titleAnchor.attr('href'),
                    thumbnail: el.find('.content-thumbnail img').attr('src'),
                    type: el.find('.gmr-posttype-item').text().trim(),
                    episode: el.find('.gmr-episode-item').text().trim() || null,
                    rating: el.find('.gmr-rating-item').text().trim() || null,
                    duration: el.find('.gmr-duration-item').text().trim() || null,
                    categories: categories,
                    country: el.find('.gmr-movie-on [itemprop="contentLocation"] a').text().trim(),
                    trailer: el.find('.gmr-trailer-popup').attr('href') || null
                });
            });

            return homepageData;
        } catch (error) {
            throw new Error(`Gagal scrape homepage: ${error.message}`);
        }
    }
}

module.exports = async (req, res) => {
    const startTime = Date.now();
    const { page = 1 } = req.method === 'GET' ? req.query : req.body;

    try {
        const scraper = new JuraganFilmScraper();
        const result = await scraper.scrapeHomepage(parseInt(page));

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
