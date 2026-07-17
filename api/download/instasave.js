// api/download/instasave.js
const axios = require('axios');

/**
 * Parse response dari Instasave untuk mendapatkan thumbnail & download URL
 * Support untuk story, dp, media
 */
function parseInstasaveResponse(html, type) {
    const items = [];

    // Pattern untuk story (bisa multiple)
    if (type === 'story') {
        // Decode unicode escapes
        const decoded = html.replace(/\\x([0-9A-Fa-f]{2})/g, (_, h) =>
            String.fromCharCode(parseInt(h, 16))
        );
        // Cari img dan link download
        const re = /<img\s+src="(https:\/\/cdn\.instasave\.website\/\?token=[^"]+)"[\s\S]*?<a\s+href="(https:\/\/cdn\.instasave\.website\/\?token=[^"]+)"/g;
        let m;
        while ((m = re.exec(decoded)) !== null) {
            items.push({
                thumbnail: m[1],
                url: m[2],
                type: 'image' // story bisa video, tapi thumbnailnya image
            });
        }
        // Jika tidak ada hasil, coba pattern lain
        if (items.length === 0) {
            // Cari langsung link download
            const linkRe = /<a[^>]+href="(https:\/\/cdn\.instasave\.website\/\?token=[^"]+)"[^>]*>/g;
            while ((m = linkRe.exec(decoded)) !== null) {
                items.push({
                    url: m[1],
                    thumbnail: m[1],
                    type: 'video'
                });
            }
        }
    }

    // Untuk DP (foto profil)
    if (type === 'dp') {
        // Cari img dengan src yang mengandung token
        const imgRe = /<img[^>]+src="(https:\/\/cdn\.instasave\.website\/\?token=[^"]+)"[^>]*>/g;
        let m;
        while ((m = imgRe.exec(html)) !== null) {
            items.push({
                thumbnail: m[1],
                url: m[1],
                type: 'image'
            });
        }
        // Jika tidak ada, coba link download langsung
        if (items.length === 0) {
            const linkRe = /<a[^>]+href="(https:\/\/cdn\.instasave\.website\/\?token=[^"]+)"[^>]*>/g;
            while ((m = linkRe.exec(html)) !== null) {
                items.push({
                    url: m[1],
                    thumbnail: m[1],
                    type: 'image'
                });
            }
        }
    }

    // Untuk media (post/reel) – bisa video atau gambar
    if (type === 'media') {
        // Cari link download (biasanya ada di <a>)
        const linkRe = /<a[^>]+href="(https:\/\/cdn\.instasave\.website\/\?token=[^"]+)"[^>]*>/g;
        let m;
        while ((m = linkRe.exec(html)) !== null) {
            // Cari thumbnail dari img di sekitar
            const thumbnail = html.substring(Math.max(0, m.index - 200), m.index);
            const thumbMatch = thumbnail.match(/<img[^>]+src="([^"]+)"/);
            const thumbUrl = thumbMatch ? thumbMatch[1] : m[1];
            items.push({
                url: m[1],
                thumbnail: thumbUrl,
                type: 'video' // default video, tapi bisa juga image
            });
        }
        // Jika tidak ada, coba img saja
        if (items.length === 0) {
            const imgRe = /<img[^>]+src="(https:\/\/cdn\.instasave\.website\/\?token=[^"]+)"[^>]*>/g;
            while ((m = imgRe.exec(html)) !== null) {
                items.push({
                    url: m[1],
                    thumbnail: m[1],
                    type: 'image'
                });
            }
        }
    }

    return items;
}

/**
 * Main function Instasave
 */
async function instasave(username, type = 'story') {
    const validTypes = ['story', 'dp', 'media'];
    if (!username) throw new Error('Username tidak boleh kosong.');
    if (!validTypes.includes(type)) throw new Error('Tipe tidak valid. Pilihan: story, dp, media');

    // Mapping tipe ke endpoint
    const endpointMap = {
        story: 'story',
        dp: 'dp',
        media: 'media'
    };
    const endpoint = endpointMap[type];

    // Build URL endpoint
    const apiUrl = `https://api.instasave.website/${endpoint}`;

    try {
        const { data } = await axios.post(
            apiUrl,
            new URLSearchParams({ url: username, lang: 'en' }).toString(),
            {
                headers: {
                    origin: 'https://instasave.website',
                    referer: `https://instasave.website/${type === 'story' ? 'instagram-stories-downloader' : type === 'dp' ? 'insta-dp-downloader' : ''}`,
                    'content-type': 'application/x-www-form-urlencoded',
                    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            }
        );

        // Parse hasil
        const items = parseInstasaveResponse(data, type);

        if (items.length === 0) {
            throw new Error('Tidak ada media ditemukan untuk username ini.');
        }

        return {
            success: true,
            items: items,
            username: username,
            type: type
        };
    } catch (error) {
        throw new Error(error.response?.data?.message || error.message);
    }
}

// ===== ROUTE HANDLER EXPRESS =====
module.exports = async (req, res) => {
    const startTime = Date.now();

    // Ambil parameter (support GET dan POST)
    const { username, type = 'story' } = req.method === 'GET' ? req.query : req.body;

    // Validasi
    if (!username) {
        return res.status(400).json({
            status: false,
            statusCode: 400,
            author: '@velz',
            error: 'Parameter "username" wajib diisi.',
            responseTimeMs: Date.now() - startTime,
            timestamp: new Date().toISOString()
        });
    }

    try {
        const result = await instasave(username, type);

        // Format items sesuai standar API
        const items = result.items.map(item => ({
            title: `${username} - ${type}`,
            url: item.url,
            quality: 'Best',
            thumbnail: item.thumbnail || '',
            type: item.type || (item.url.includes('video') ? 'video' : 'image')
        }));

        const response = {
            status: true,
            statusCode: 200,
            author: '@velz',
            result: {
                items: items,
                metadata: {
                    username: username,
                    type: type,
                    total: items.length
                }
            },
            responseTimeMs: Date.now() - startTime,
            timestamp: new Date().toISOString()
        };

        res.status(200).json(response);
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
