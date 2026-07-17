const JuraganFilmScraper = require('../../services/juraganFilmScraper');

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
