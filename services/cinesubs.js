// services/cinesubs.js
const axios = require('axios');
const cheerio = require('cheerio');

const BASE_URL = 'https://cinesubz.net';

class CineSubz {
    
    static _parseList($) {
        const items = [];
        $('.display-item, .module-item').each((i, el) => {
            const title = $(el).find('.item-box a').attr('title') || $(el).find('.item-desc-title h3').text().trim();
            const url = $(el).find('.item-box a').attr('href');
            const image = $(el).find('img.thumb').attr('data-original') || $(el).find('img.thumb').attr('src');
            const rating = $(el).find('.imdb-score').text().trim();
            const badge = $(el).find('.poster-corner-badges span').text().trim();

            if (url) {
                items.push({
                    title: title,
                    url: url,
                    image: image,
                    rating: rating || null,
                    badge: badge || null
                });
            }
        });
        return items;
    }

    static async getHome() {
        try {
            const { data } = await axios.get(`${BASE_URL}/`);
            const $ = cheerio.load(data);
            return this._parseList($);
        } catch (error) {
            console.error("Error in getHome:", error.message);
            return [];
        }
    }

    static async search(query) {
        try {
            const { data } = await axios.get(`${BASE_URL}/?s=${encodeURIComponent(query)}`);
            const $ = cheerio.load(data);
            return this._parseList($);
        } catch (error) {
            console.error("Error in search:", error.message);
            return [];
        }
    }

    static async getMovies(page = 1) {
        try {
            const pagePath = page > 1 ? `page/${page}/` : '';
            const { data } = await axios.get(`${BASE_URL}/movies/${pagePath}`);
            const $ = cheerio.load(data);
            return this._parseList($);
        } catch (error) {
            console.error("Error in getMovies:", error.message);
            return [];
        }
    }

    static async getTvShows(page = 1) {
        try {
            const pagePath = page > 1 ? `page/${page}/` : '';
            const { data } = await axios.get(`${BASE_URL}/tvshows/${pagePath}`);
            const $ = cheerio.load(data);
            return this._parseList($);
        } catch (error) {
            console.error("Error in getTvShows:", error.message);
            return [];
        }
    }

    static async getGenre(slug, page = 1) {
        try {
            const pagePath = page > 1 ? `page/${page}/` : '';
            const { data } = await axios.get(`${BASE_URL}/genre/${slug}/${pagePath}`);
            const $ = cheerio.load(data);
            return this._parseList($);
        } catch (error) {
            console.error("Error in getGenre:", error.message);
            return [];
        }
    }

    static async getLanguage(slug, page = 1) {
        return await this.getGenre(slug, page);
    }

    static async getDetail(url) {
        try {
            const { data } = await axios.get(url);
            const $ = cheerio.load(data);

            const title = $('.details-title h3').text().trim();
            const image = $('.content-poster img').attr('src');
            const synopsis = $('.details-desc p').text().trim();
            const rating = $('.zt_rating_vgs').text().trim();
            const duration = $('span[itemprop="duration"]').text().trim() || $('.data-views').first().text().trim();
            const quality = $('.data-quality').text().trim();
            
            const genres = [];
            $('.details-genre a').each((i, el) => {
                genres.push($(el).text().trim());
            });

            const cast = [];
            $('.zt-cast-card').each((i, el) => {
                cast.push({
                    name: $(el).find('.zt-cast-name').text().trim(),
                    role: $(el).find('.zt-cast-role').text().trim(),
                    image: $(el).find('.zt-cast-image img').attr('src')
                });
            });

            return { title, image, synopsis, rating, duration, quality, genres, cast };
        } catch (error) {
            console.error("Error in getDetail:", error.message);
            return null;
        }
    }

    static async getEpisodes(url) {
        try {
            const { data } = await axios.get(url);
            const $ = cheerio.load(data);
            
            const episodes = [];
            $('.episodes-list li').each((i, el) => {
                const epUrl = $(el).find('a').attr('href');
                
                let epNum = $(el).find('.numerando, .num-epi').text().trim();
                let epTitle = $(el).find('.episodiotitle, .ep-title').text().trim();
                let epDate = $(el).find('.date, .ep-date').text().trim();

                if (!epTitle) {
                    epTitle = $(el).find('a').text().trim() || 'Episode'; 
                }
                if (!epNum && epUrl) {
                    const match = epUrl.match(/-(\d+x\d+)\/?$/);
                    if (match) epNum = match[1];
                }

                if (epUrl) {
                    episodes.push({ num: epNum, title: epTitle, date: epDate, url: epUrl });
                }
            });

            return episodes;
        } catch (error) {
            console.error("Error in getEpisodes:", error.message);
            return [];
        }
    }

    static async getEpisode(url) {
        try {
            const detail = await this.getDetail(url);
            const downloads = await this.getDownloadLinks(url);
            const streaming = await this.getStreaming(url);
            
            return { ...detail, downloads, streaming };
        } catch (error) {
            console.error("Error in getEpisode:", error.message);
            return null;
        }
    }

    static async getDownloadLinks(url) {
        try {
            const { data } = await axios.get(url);
            const $ = cheerio.load(data);
            
            const downloads = [];
            $('.movie-download-link-item a').each((i, el) => {
                downloads.push({
                    url: $(el).attr('href'),
                    type: $(el).find('.movie-download-type').text().trim(),
                    meta: $(el).find('.movie-download-meta').text().trim()
                });
            });

            return downloads;
        } catch (error) {
            console.error("Error in getDownloadLinks:", error.message);
            return [];
        }
    }

    static async getStreaming(url) {
        try {
            const { data } = await axios.get(url);
            const $ = cheerio.load(data);
            
            const streaming = [];
            $('.zetaflix_player_option').each((i, el) => {
                streaming.push({
                    serverName: $(el).find('.opt-name').text().trim(),
                    serverType: $(el).find('.opt-titl').text().trim(),
                    dataType: $(el).attr('data-type'),
                    dataPost: $(el).attr('data-post'),
                    dataNume: $(el).attr('data-nume')
                });
            });

            return streaming;
        } catch (error) {
            console.error("Error in getStreaming:", error.message);
            return [];
        }
    }

    static async getStreamingUrl(dataPost, dataNume, dataType) {
        try {
            const formData = new URLSearchParams();
            formData.append('action', 'zeta_player_ajax');
            formData.append('post', dataPost);
            formData.append('nume', dataNume);
            formData.append('type', dataType);

            const { data } = await axios.post(`${BASE_URL}/wp-admin/admin-ajax.php`, formData, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                    'X-Requested-With': 'XMLHttpRequest',
                    'Accept': 'application/json, text/javascript, */*; q=0.01'
                }
            });

            return data;
        } catch (error) {
            console.error("Error in getStreamingUrl:", error.message);
            return null;
        }
    }
}

module.exports = CineSubz;
