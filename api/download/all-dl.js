const axios = require('axios');

// Daftar tool yang didukung (sama seperti kode kamu)
const tools = [
  'apple-music-downloader', 'douyin-downloader', 'facebook-video-downloader',
  'instagram-reels-downloader', 'instagram-story-downloader', 'instagram-video-downloader',
  'likee-downloader', 'linkedin-video-downloader', 'pinterest-video-downloader',
  'soundcloud-downloader', 'spotify-downloader', 'tiktok-photo-downloader',
  'tiktok-story-downloader', 'tiktok-video-downloader', 'twitter-gif-downloader',
  'twitter-video-downloader', 'youtube-monetization-checker', 'youtube-money-calculator',
  'youtube-tags-extractor', 'youtube-thumbnail-downloader', 'youtube-transcript',
  'youtube-video-downloader'
];

async function wowdownloader(url, tool) {
  try {
    if (!url.includes('https://')) throw new Error('Invalid url. URL harus menggunakan HTTPS.');
    if (!tools.includes(tool)) throw new Error('Tool tidak dikenali. Daftar tool: ' + tools.join(', '));

    const { data: html, headers } = await axios.get(`https://wowdownloader.com/tool/${tool}`, {
      headers: {
        'user-agent': 'Neo/1.0'
      }
    });

    const csrfToken = html.match(/<meta name="csrf-token" content="([^"]+)">/)?.[1];
    if (!csrfToken) throw new Error('Gagal mengambil token CSRF.');

    const { data } = await axios.post('https://wowdownloader.com/api/download', {
      url: url,
      tool: tool
    }, {
      headers: {
        origin: 'https://wowdownloader.com',
        referer: `https://wowdownloader.com/tool/${tool}`,
        'x-csrf-token': csrfToken,
        cookie: headers['set-cookie']?.map(c => c.split(';')[0]).join('; '),
        'content-type': 'application/json',
        'user-agent': 'Neo/1.0'
      }
    });

    return data;
  } catch (error) {
    throw new Error(error.response?.data?.error || error.message);
  }
}

// ===== Route Handler Express =====
module.exports = async (req, res) => {
  const startTime = Date.now();

  // Ambil parameter dari query (GET) atau body (POST)
  const { url, tool } = req.method === 'GET' ? req.query : req.body;

  // Validasi
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
  if (!tool) {
    return res.status(400).json({
      status: false,
      statusCode: 400,
      author: '@velz',
      error: 'Parameter "tool" wajib diisi.',
      responseTimeMs: Date.now() - startTime,
      timestamp: new Date().toISOString()
    });
  }

  try {
    const result = await wowdownloader(url, tool);

    // Format hasil sesuai yang diinginkan
    // Asumsikan result memiliki properti 'items' (array)
    const items = result.items || [];

    const response = {
      status: true,
      statusCode: 200,
      author: '@velz',
      result: {
        items: items.map(item => ({
          title: item.title || '',
          url: item.url || '',
          quality: item.quality || '',
          thumbnail: item.thumbnail || ''
        }))
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
