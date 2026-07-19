// api/download/all-dl.js
const fetch = require('node-fetch');

module.exports = async (req, res) => {
    const startTime = Date.now();
    const url = req.method === 'GET' ? req.query.url : req.body.url;
    const type = (req.method === 'GET' ? req.query.type : req.body.type) || 'mp4';

    if (!url) {
        return res.status(400).json({
            status: false,
            statusCode: 400,
            author: '@velz',
            error: 'Parameter "url" wajib diisi.',
            responseTimeMs: Date.now() - startTime,
            timestamp: new Date().toISOString()
        });
    }

    try {
        let result = null;

        // Coba metode berdasarkan domain
        if (url.includes('tiktok.com')) {
            result = await tiktokDownloader(url);
        } else if (url.includes('instagram.com')) {
            result = await instagramDownloader(url);
        } else if (url.includes('youtube.com') || url.includes('youtu.be')) {
            result = await youtubeDownloader(url, type);
        } else {
            // Fallback: coba semua metode
            result = await universalDownloader(url, type);
        }

        if (!result || !result.status) {
            throw new Error(result?.error || 'Gagal mendownload media.');
        }

        res.status(200).json({
            status: true,
            statusCode: 200,
            author: '@velz',
            result: result.result,
            responseTimeMs: Date.now() - startTime,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        res.status(500).json({
            status: false,
            statusCode: 500,
            author: '@velz',
            error: error.message || 'Internal server error',
            responseTimeMs: Date.now() - startTime,
            timestamp: new Date().toISOString()
        });
    }
};

// ===== TIKTOK DOWNLOADER =====
async function tiktokDownloader(url) {
    try {
        // Pakai EveryVideo API
        const response = await fetch(`https://api.everyvideo.app/api/metadata/preview?url=${encodeURIComponent(url)}`, {
            headers: {
                'origin': 'https://www.everyvideo.app',
                'referer': 'https://www.everyvideo.app/',
                'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        const data = await response.json();

        if (!data || !data.video_formats || data.video_formats.length === 0) {
            throw new Error('Tidak ada format video ditemukan');
        }

        const bestFormat = data.video_formats.sort((a, b) => (b.height || 0) - (a.height || 0))[0];
        const title = data.title || 'TikTok Video';

        return {
            status: true,
            result: {
                title: title,
                type: 'mp4',
                url: bestFormat.url || `https://api.everyvideo.app/api/dl/${data.job_id}/download`,
                quality: bestFormat.quality || 'Best',
                thumbnail: data.thumbnail_url || '',
                duration: data.duration || 0,
                author: data.uploader || 'Unknown',
                viewCount: data.view_count || 0
            }
        };
    } catch (error) {
        return { status: false, error: error.message };
    }
}

// ===== INSTAGRAM DOWNLOADER =====
async function instagramDownloader(url) {
    try {
        // Coba pakai instaddl.com
        const htmlRes = await fetch('https://instaddl.com/');
        const html = await htmlRes.text();
        
        const scriptMatch = html.match(/src="([^"]*assets\/index-[^"]*\.js)"/);
        if (!scriptMatch) throw new Error('Gagal menemukan script');
        
        const jsUrl = 'https://instaddl.com' + scriptMatch[1];
        const jsRes = await fetch(jsUrl);
        const jsText = await jsRes.text();
        
        const keyMatch = jsText.match(/(eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[^"'\s]+)/);
        if (!keyMatch) throw new Error('Gagal mengekstrak API key');
        
        const apiKey = keyMatch[1];
        const authorization = `Bearer ${apiKey}`;

        const createRes = await fetch('https://eoehwyffvhpmvpeblkbi.supabase.co/functions/v1/instagram-fetch', {
            method: 'POST',
            headers: {
                'user-agent': 'Mozilla/5.0',
                'origin': 'https://instaddl.com',
                'referer': 'https://instaddl.com/',
                'content-type': 'application/json',
                'apikey': apiKey,
                'authorization': authorization
            },
            body: JSON.stringify({ url })
        });
        const create = await createRes.json();

        if (!create.success) throw new Error('Gagal memulai fetch');

        // Polling
        for (let i = 0; i < 20; i++) {
            await new Promise(resolve => setTimeout(resolve, 2000));
            const pollRes = await fetch('https://eoehwyffvhpmvpeblkbi.supabase.co/functions/v1/instagram-poll', {
                method: 'POST',
                headers: {
                    'user-agent': 'Mozilla/5.0',
                    'origin': 'https://instaddl.com',
                    'referer': 'https://instaddl.com/',
                    'content-type': 'application/json',
                    'apikey': apiKey,
                    'authorization': authorization
                },
                body: JSON.stringify({ runId: create.runId, datasetId: create.datasetId, url })
            });
            const result = await pollRes.json();

            if (result.data && !result.pending) {
                const items = result.data || [];
                const media = items.map(item => ({
                    title: item.title || 'Instagram Media',
                    url: item.url || '',
                    type: item.type || 'video',
                    thumbnail: item.thumbnail || ''
                }));
                return {
                    status: true,
                    result: {
                        title: 'Instagram Media',
                        type: 'mp4',
                        items: media,
                        total: media.length
                    }
                };
            }
        }
        throw new Error('Timeout menunggu hasil');
    } catch (error) {
        return { status: false, error: error.message };
    }
}

// ===== YOUTUBE DOWNLOADER =====
async function youtubeDownloader(url, type) {
    try {
        // Coba ytdown.to
        const step1 = await fetch('https://app.ytdown.to/proxy.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'User-Agent': 'Mozilla/5.0',
                'Origin': 'https://app.ytdown.to',
                'Referer': 'https://app.ytdown.to/id2/',
                'X-Requested-With': 'XMLHttpRequest'
            },
            body: `url=${encodeURIComponent(url)}`
        });

        const videoInfo = await step1.json();

        if (!videoInfo.api || videoInfo.api.status !== 'ok') {
            throw new Error('Gagal mengambil info video');
        }

        const { title, mediaItems } = videoInfo.api;

        const videos = mediaItems.filter(v => v.type === 'Video');
        const audios = mediaItems.filter(v => v.type === 'Audio');

        const target = type === 'mp3' ? audios[0] : videos[0];
        if (!target) {
            throw new Error('Format tidak tersedia');
        }

        const step2 = await fetch('https://app.ytdown.to/proxy.php', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Origin': 'https://app.ytdown.to',
                'Referer': 'https://app.ytdown.to/id2/'
            },
            body: `url=${encodeURIComponent(target.mediaUrl)}`
        });

        const data = await step2.json();

        return {
            status: true,
            result: {
                title: title || 'YouTube Video',
                type: type,
                url: data.api.fileUrl,
                filename: data.api.fileName || `${title}.${type === 'mp3' ? 'mp3' : 'mp4'}`,
                size: data.api.fileSize || 'Unknown'
            }
        };
    } catch (error) {
        return { status: false, error: error.message };
    }
}

// ===== UNIVERSAL DOWNLOADER (FALLBACK) =====
async function universalDownloader(url, type) {
    const methods = [
        youtubeDownloader,
        tiktokDownloader,
        instagramDownloader
    ];

    for (const method of methods) {
        try {
            const result = await method(url, type);
            if (result && result.status) {
                return result;
            }
        } catch (e) {
            // lanjut
        }
    }

    return { status: false, error: 'Semua metode gagal' };
}
