// api/download/instagram.js
const axios = require('axios');

async function getDynamicApiKey() {
    const htmlRes = await axios.get('https://instaddl.com/');
    const scriptMatch = htmlRes.data.match(/src="([^"]*assets\/index-[^"]*\.js)"/);
    if (!scriptMatch) throw new Error('Gagal menemukan script');
    const jsUrl = 'https://instaddl.com' + scriptMatch[1];
    const jsRes = await axios.get(jsUrl);
    const keyMatch = jsRes.data.match(/(eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[^"'\s]+)/);
    if (!keyMatch) throw new Error('Gagal mengekstrak API key');
    return keyMatch[1];
}

async function instagramDownloader(url) {
    const apiKey = await getDynamicApiKey();
    const authorization = `Bearer ${apiKey}`;

    const { data: create } = await axios.post(
        'https://eoehwyffvhpmvpeblkbi.supabase.co/functions/v1/instagram-fetch',
        { url },
        {
            headers: {
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36',
                'origin': 'https://instaddl.com',
                'referer': 'https://instaddl.com/',
                'content-type': 'application/json',
                'x-client-info': 'supabase-js-web/2.58.0',
                'apikey': apiKey,
                'authorization': authorization
            }
        }
    );

    if (!create.success) throw new Error('Gagal memulai fetch');
    const { runId, datasetId } = create;

    for (let i = 0; i < 20; i++) {
        await new Promise(resolve => setTimeout(resolve, 2000));
        const { data: result } = await axios.post(
            'https://eoehwyffvhpmvpeblkbi.supabase.co/functions/v1/instagram-poll',
            { runId, datasetId, url },
            {
                headers: {
                    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36',
                    'origin': 'https://instaddl.com',
                    'referer': 'https://instaddl.com/',
                    'content-type': 'application/json',
                    'x-client-info': 'supabase-js-web/2.58.0',
                    'apikey': apiKey,
                    'authorization': authorization
                }
            }
        );
        if (result.data && !result.pending) {
            return result.data;
        }
    }
    throw new Error('Waktu polling habis (40 detik)');
}

module.exports = async (req, res) => {
    const startTime = Date.now();
    const { url } = req.method === 'GET' ? req.query : req.body;

    if (!url) {
        return res.status(400).json({
            status: false,
            statusCode: 400,
            author: '@velz',
            error: 'Parameter "url" (Instagram URL) wajib diisi.',
            responseTimeMs: Date.now() - startTime,
            timestamp: new Date().toISOString()
        });
    }

    try {
        const result = await instagramDownloader(url);
        res.status(200).json({
            status: true,
            statusCode: 200,
            author: '@velz',
            result,
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
