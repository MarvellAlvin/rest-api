// api/tools/free-views-tt.js
const axios = require("axios");
const FormData = require("form-data");

// ===== KONFIGURASI =====
const ZEFAME_URL = "https://zefame.com/id/free-tiktok-views";
const API_URL = "https://app.zefame.com/api_free.php";
const SOLVER_URL = "https://fgsi.dpdns.org/api/tools/cfclearance/turnstile-min";

const USER_AGENTS = [
  "Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36",
  "Mozilla/5.0 (Linux; Android 11) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36",
  "Mozilla/5.0 (Linux; Android 12) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36",
  "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36",
  "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
];

function randomIP() {
  return `${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}`;
}

function randomUserAgent() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function generateUUID() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === "x" ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function getRandomDelay(min = 500, max = 2000) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function extractSitekey(html) {
  const match = html.match(/sitekey['"]\s*:\s*['"]([^'"]+)['"]/);
  return match ? match[1] : "0x4AAAAAACWzOmyoRZoUyJWP";
}

async function solveTurnstile(apiKey, sitekey, maxRetries = 3) {
  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const { data } = await axios.get(SOLVER_URL, {
        params: {
          apikey: apiKey,
          url: ZEFAME_URL,
          sitekey: sitekey
        },
        timeout: 120000
      });
      if (!data.data?.token) {
        throw new Error(`Solver failed: ${data.message || "unknown"}`);
      }
      return data.data.token;
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries) {
        await sleep(getRandomDelay(2000, 5000));
      }
    }
  }
  throw new Error(`Turnstile solve failed after ${maxRetries} attempts: ${lastError.message}`);
}

async function checkVideo(videoUrl, cfToken) {
  try {
    const randomIp = randomIP();
    const userAgent = randomUserAgent();
    const form = new FormData();
    form.append("action", "checkVideoId");
    form.append("link", videoUrl);
    form.append("lang", "id");
    form.append("cf_token", cfToken);

    const { data } = await axios.post(API_URL, form, {
      headers: {
        ...form.getHeaders(),
        "User-Agent": userAgent,
        "X-Forwarded-For": randomIp,
        "X-Real-IP": randomIp,
        Origin: ZEFAME_URL,
        Referer: ZEFAME_URL,
        "Accept-Language": "id-ID,id;q=0.9"
      }
    });

    if (!data.success) {
      throw new Error(data.message || "Video check failed");
    }
    return data.data.videoId;
  } catch (err) {
    throw new Error(`Video check failed: ${err.message}`);
  }
}

async function orderViews(videoId, quantity, cfToken, device, service) {
  try {
    const randomIp = randomIP();
    const userAgent = randomUserAgent();
    const form = new FormData();
    form.append("action", "order");
    form.append("lang", "id");
    form.append("service", service);
    form.append("link", `https://www.tiktok.com/video/${videoId}`);
    form.append("uuid", device);
    form.append("videoid", videoId);
    form.append("cf_token", cfToken);

    const { data } = await axios.post(API_URL, form, {
      headers: {
        ...form.getHeaders(),
        "User-Agent": userAgent,
        "X-Forwarded-For": randomIp,
        "X-Real-IP": randomIp,
        Origin: ZEFAME_URL,
        Referer: ZEFAME_URL,
        "Accept-Language": "id-ID,id;q=0.9"
      }
    });

    if (!data.success) {
      throw new Error(data.message || "Order failed");
    }
    return data.data;
  } catch (err) {
    throw new Error(`Order failed: ${err.message}`);
  }
}

/**
 * Fungsi utama untuk order 100 views TikTok
 * @param {string} tikTokUrl - URL video TikTok
 * @param {string} apiKey - API key dari fgsi.dpdns.org
 * @param {number} quantity - Jumlah views (default 100)
 * @param {number} service - ID service (default 229)
 * @param {boolean} quiet - Jika true, tidak mencetak log ke stdout
 * @returns {Promise<Object>}
 */
async function zefame(tikTokUrl, apiKey, quantity = 100, service = 229, quiet = true) {
  try {
    let sitekey = "0x4AAAAAACWzOmyoRZoUyJWP";
    // Skip home page untuk mempercepat (kita tidak perlu menunggu 60 detik)
    // Langsung gunakan sitekey default

    // Solve Turnstile
    const cfToken = await solveTurnstile(apiKey, sitekey);

    await sleep(getRandomDelay(1000, 2000));

    // Check video
    const videoId = await checkVideo(tikTokUrl, cfToken);

    await sleep(getRandomDelay(800, 1500));
    const deviceId = generateUUID();

    // Order views
    const orderResult = await orderViews(videoId, quantity, cfToken, deviceId, service);

    return {
      status: true,
      videoId: videoId,
      orderId: orderResult.orderId,
      views: quantity,
      service: service,
      device: deviceId,
      nextAvailable: orderResult.nextAvailable,
      message: "Order berhasil dibuat ✓"
    };
  } catch (error) {
    return {
      status: false,
      error: error.message,
      message: error.message
    };
  }
}

// ===== ROUTE HANDLER EXPRESS =====
module.exports = async (req, res) => {
  const startTime = Date.now();

  // Ambil parameter dari query (GET) atau body (POST)
  const { url, apikey, quantity = 100, service = 229 } = req.method === 'GET' ? req.query : req.body;

  // Validasi
  if (!url) {
    return res.status(400).json({
      status: false,
      statusCode: 400,
      author: '@velz',
      error: 'Parameter "url" (link TikTok) wajib diisi.',
      responseTimeMs: Date.now() - startTime,
      timestamp: new Date().toISOString()
    });
  }

  if (!apikey) {
    return res.status(400).json({
      status: false,
      statusCode: 400,
      author: '@velz',
      error: 'Parameter "apikey" (dari fgsi.dpdns.org) wajib diisi.',
      responseTimeMs: Date.now() - startTime,
      timestamp: new Date().toISOString()
    });
  }

  // Batasi quantity maksimal 100 (gratis)
  const finalQuantity = Math.min(parseInt(quantity) || 100, 100);
  const finalService = parseInt(service) || 229;

  try {
    // Panggil fungsi zefame dengan quiet = true (tidak mencetak log)
    const result = await zefame(url, apikey, finalQuantity, finalService, true);

    // Format response
    const response = {
      status: result.status,
      statusCode: result.status ? 200 : 500,
      author: '@velz',
      result: result,
      responseTimeMs: Date.now() - startTime,
      timestamp: new Date().toISOString()
    };

    // Jika status false, kita tetap kirim 200 tapi dengan status false di body
    res.status(200).json(response);
  } catch (error) {
    // Error yang tidak terduga
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
