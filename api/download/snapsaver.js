// api/download/snapsaver.js
const axios = require('axios');

const HEADERS = {
  "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "referer": "https://getindevice.com/"
};

/**
 * Fungsi utama untuk mengambil link download dari getindevice.com
 */
async function snapsaver(url) {
  try {
    // 1. Ambil token
    const { data: tokenData } = await axios.get(
      `https://getindevice.com/api/token/?_t=${Date.now()}`,
      { headers: HEADERS }
    );

    // 2. Kirim URL dengan token
    const { data } = await axios.post(
      "https://getindevice.com/api/download/",
      { url },
      {
        headers: {
          ...HEADERS,
          "content-type": "application/json",
          "x-request-token": tokenData.token
        }
      }
    );

    return data;
  } catch (error) {
    throw new Error(error.response?.data?.message || error.message);
  }
}

/**
 * Deteksi platform dari URL (hanya untuk metadata)
 */
function detectPlatform(url) {
  const lower = url.toLowerCase();
  if (lower.includes('tiktok.com')) return 'tiktok';
  if (lower.includes('twitter.com') || lower.includes('x.com')) return 'twitter';
  if (lower.includes('instagram.com')) return 'instagram';
  if (lower.includes('facebook.com') || lower.includes('fb.watch')) return 'facebook';
  if (lower.includes('pinterest.com')) return 'pinterest';
  if (lower.includes('linkedin.com')) return 'linkedin';
  if (lower.includes('snapchat.com')) return 'snapchat';
  if (lower.includes('threads.net')) return 'threads';
  if (lower.includes('tumblr.com')) return 'tumblr';
  return 'unknown';
}

/**
 * Normalisasi hasil dari snapsaver ke format items
 */
function normalizeResult(data, platform) {
  let items = [];

  // Data dari snapsaver biasanya punya properti 'data' yang berisi array
  const rawItems = data.data || data.items || data;

  if (Array.isArray(rawItems)) {
    items = rawItems.map(item => ({
      title: item.title || item.description || 'Media',
      url: item.url || item.downloadUrl || '',
      quality: item.quality || item.resolution || 'Best',
      thumbnail: item.thumbnail || item.cover || '',
      type: item.type || (item.url && item.url.includes('audio') ? 'audio' : 'video')
    }));
  } else if (rawItems && typeof rawItems === 'object') {
    // Jika hasil berupa objek tunggal
    const possibleUrls = [rawItems.url, rawItems.downloadUrl, rawItems.link];
    const foundUrl = possibleUrls.find(u => u);
    if (foundUrl) {
      items.push({
        title: rawItems.title || rawItems.description || 'Media',
        url: foundUrl,
        quality: rawItems.quality || 'Best',
        thumbnail: rawItems.thumbnail || rawItems.cover || '',
        type: rawItems.type || (foundUrl.includes('audio') ? 'audio' : 'video')
      });
    }
  }

  return items;
}

// ===== ROUTE HANDLER EXPRESS =====
module.exports = async (req, res) => {
  const startTime = Date.now();

  const { url } = req.method === 'GET' ? req.query : req.body;

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

  const platform = detectPlatform(url);

  try {
    const rawResult = await snapsaver(url);
    const items = normalizeResult(rawResult, platform);

    if (items.length === 0) {
      throw new Error('Tidak ada media yang ditemukan dari URL ini.');
    }

    const response = {
      status: true,
      statusCode: 200,
      author: '@velz',
      result: {
        items: items,
        metadata: {
          platform: platform,
          title: items[0]?.title || 'Media'
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
