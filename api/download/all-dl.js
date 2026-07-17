const axios = require('axios');

// Daftar tool/platform yang didukung oleh socialdownloader.space
// Berdasarkan dokumentasi, platform yang didukung: TikTok, Twitter/X, Instagram, Facebook, YouTube[reference:6]
const supportedPlatforms = [
  'tiktok',
  'twitter', 
  'x',
  'instagram',
  'facebook',
  'youtube'
];

/**
 * Mendownload media menggunakan API socialdownloader.space
 * Dokumentasi: https://github.com/Vette1123/social-media-downloader#api-reference[reference:7]
 */
async function socialDownloader(url) {
  try {
    // Validasi URL
    if (!url.includes('https://')) {
      throw new Error('Invalid url. URL harus menggunakan HTTPS.');
    }

    // Kirim request ke API socialdownloader.space
    const { data } = await axios.post(
      'https://www.socialdownloader.space/api/download',
      { url: url },
      {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (compatible; SocialDownloaderAPI/1.0)'
        }
      }
    );

    // Cek apakah request berhasil
    if (!data.success) {
      throw new Error(data.error || 'Gagal mendapatkan data dari socialdownloader.space');
    }

    return data;
  } catch (error) {
    throw new Error(error.response?.data?.error || error.message);
  }
}

/**
 * Mendeteksi platform dari URL
 */
function detectPlatform(url) {
  const urlLower = url.toLowerCase();
  if (urlLower.includes('tiktok.com')) return 'tiktok';
  if (urlLower.includes('twitter.com') || urlLower.includes('x.com')) return 'twitter';
  if (urlLower.includes('instagram.com')) return 'instagram';
  if (urlLower.includes('facebook.com') || urlLower.includes('fb.watch')) return 'facebook';
  if (urlLower.includes('youtube.com') || urlLower.includes('youtu.be')) return 'youtube';
  return null;
}

// ===== Route Handler Express =====
module.exports = async (req, res) => {
  const startTime = Date.now();

  // Ambil parameter dari query (GET) atau body (POST)
  const { url } = req.method === 'GET' ? req.query : req.body;

  // Validasi URL
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

  // Deteksi platform secara otomatis
  const platform = detectPlatform(url);
  if (!platform) {
    return res.status(400).json({
      status: false,
      statusCode: 400,
      author: '@velz',
      error: 'URL tidak dikenali. Support: TikTok, Twitter/X, Instagram, Facebook, YouTube',
      responseTimeMs: Date.now() - startTime,
      timestamp: new Date().toISOString()
    });
  }

  try {
    const result = await socialDownloader(url);

    // Format hasil sesuai dengan struktur yang diinginkan
    let items = [];

    if (result.metadata?.images && result.metadata.images.length > 0) {
      // Ini adalah carousel foto - setiap image jadi satu item[reference:8]
      items = result.metadata.images.map((imgUrl, index) => ({
        title: result.metadata.title || `Image ${index + 1}`,
        url: imgUrl,
        quality: 'Image',
        thumbnail: imgUrl
      }));
    } else if (result.downloadUrl) {
      // Ini adalah video[reference:9]
      items = [
        {
          title: result.metadata?.title || 'Video',
          url: result.downloadUrl,
          quality: 'Video',
          thumbnail: result.metadata?.thumbnail || ''
        }
      ];
      
      // Jika ada audio, tambahkan sebagai item terpisah
      if (result.audioUrl) {
        items.push({
          title: (result.metadata?.title || 'Audio') + ' · Audio',
          url: result.audioUrl,
          quality: 'MP3 · Audio',
          thumbnail: result.metadata?.thumbnail || ''
        });
      }
    } else {
      throw new Error('Tidak ada media yang dapat diunduh dari URL ini.');
    }

    const response = {
      status: true,
      statusCode: 200,
      author: '@velz',
      result: {
        items: items,
        metadata: {
          platform: result.metadata?.platform || platform,
          author: result.metadata?.author || '',
          title: result.metadata?.title || ''
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
