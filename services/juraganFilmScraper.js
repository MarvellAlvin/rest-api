// services/juraganFilmScraper.js
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

    // 1. Scrape Homepage
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

    // 2. Scrape Category
    async scrapeCategory(categoryPath, pageNumber = 1) {
        try {
            const cleanPath = categoryPath.replace(/^\/|\/$/g, '');
            const baseCategoryUrl = `${this.baseDomain}/kategori-film/${cleanPath}`;
            const targetUrl = this._buildPagedUrl(baseCategoryUrl, pageNumber);
            const response = await axios.get(targetUrl, { headers: this.defaultHeaders });
            const $ = cheerio.load(response.data);

            const result = {
                categoryPath: cleanPath,
                categoryTitle: $('.page-title').text().replace('Genre:', '').trim() || cleanPath,
                currentPage: pageNumber,
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

            return result;
        } catch (error) {
            throw new Error(`Gagal scrape kategori ${categoryPath}: ${error.message}`);
        }
    }

    // 3. Scrape Search
    async scrapeSearch(query, pageNumber = 1) {
        try {
            const encodedQuery = encodeURIComponent(query);
            const targetUrl = (pageNumber && pageNumber > 1)
                ? `${this.baseDomain}/page/${pageNumber}/?s=${encodedQuery}`
                : `${this.baseDomain}/?s=${encodedQuery}`;
            const response = await axios.get(targetUrl, { headers: this.defaultHeaders });
            const $ = cheerio.load(response.data);

            const result = {
                searchQuery: query,
                currentPage: pageNumber,
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

            return result;
        } catch (error) {
            throw new Error(`Gagal mencari "${query}": ${error.message}`);
        }
    }

    // 4. Bypass Player (dapatkan link m3u8/mp4 asli)
    async bypassPlayer(playerUrl) {
        try {
            const urlObj = new URL(playerUrl);
            const baseUrl = `${urlObj.protocol}//${urlObj.host}`;
            const response = await axios.get(playerUrl, {
                headers: {
                    'User-Agent': this.userAgent,
                    'Referer': `${this.baseDomain}/`
                }
            });

            const html = response.data;
            const hlsMatch = html.match(/const\s+HLS_URL\s*=\s*["']([^"']+)["']/);
            const hlsUrl = hlsMatch ? hlsMatch[1] : null;

            const fallbackMatch = html.match(/const\s+FALLBACK_JSON_URL\s*=\s*["']([^"']+)["']/);
            let mp4Sources = [];

            if (fallbackMatch) {
                const fallbackPath = fallbackMatch[1];
                const separator = fallbackPath.includes('?') ? '&' : '?';
                const fullFallbackUrl = `${baseUrl}${fallbackPath}${separator}_js_cb=${Date.now()}`;
                const fallbackResponse = await axios.get(fullFallbackUrl, {
                    headers: {
                        'User-Agent': this.userAgent,
                        'Referer': playerUrl
                    }
                });
                if (fallbackResponse.data && fallbackResponse.data.success) {
                    mp4Sources = fallbackResponse.data.sources || [];
                }
            }

            return {
                success: true,
                mainStreamHls: hlsUrl,
                downloadMp4Sources: mp4Sources
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // 5. Ambil Detail Film + Link Streaming
    async getMovieCompleteData(targetUrl) {
        try {
            const response = await axios.get(targetUrl, { headers: this.defaultHeaders });
            const $ = cheerio.load(response.data);

            const result = {
                title: $('.entry-title[itemprop="name"]').text().trim() || $('title').text().trim(),
                episodes: [],
                playerData: null
            };

            let streamingUrl = '';
            const iframeSrc = $('iframe[id^="jf-frame-"]').attr('src') || $('.jf-vid-container iframe').attr('src');
            if (iframeSrc) {
                streamingUrl = iframeSrc.startsWith('http') ? iframeSrc : 'https:' + iframeSrc;
            }

            if (streamingUrl) {
                result.playerData = await this.bypassPlayer(streamingUrl);
            }

            $('.jf-eps-wrap a, .jf-eps-wrap span').each((_, element) => {
                const el = $(element);
                if (el.hasClass('page-text')) return;
                result.episodes.push({
                    episode: el.text().trim(),
                    url: el.attr('href') || targetUrl
                });
            });

            return result;
        } catch (error) {
            throw new Error(`Gagal ambil detail film: ${error.message}`);
        }
    }
}

module.exports = JuraganFilmScraper;
