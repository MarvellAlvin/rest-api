const axios = require('axios');
const { wrapper } = require('axios-cookiejar-support');
const { CookieJar } = require('tough-cookie');

// ===== KONFIGURASI =====
const AUTHOR = "@MarvellAlvin";

// Buat Cookie Jar untuk menyimpan session seperti browser
const jar = new CookieJar();
const client = wrapper(axios.create({
  jar,
  withCredentials: true,
  timeout: 15000 // 15 detik timeout
}));

// ===== HEADER LENGKAP SEPERTI BROWSER =====
const HEADERS = {
  "Content-Type": "text/plain; charset=utf-8",
  "Accept": "application/json, text/plain, */*",
  "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
  "Accept-Encoding": "gzip, deflate, br",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Origin": "https://apps.animekita.org",
  "Referer": "https://apps.animekita.org/",
  "Connection": "keep-alive",
  "Sec-Fetch-Dest": "empty",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Site": "same-origin",
  "Pragma": "no-cache",
  "Cache-Control": "no-cache"
};

// ===== MAPPING DURASI =====
const DURASI_MAP = {
  '1bulan': 'Mzk3MjA4NDM3NjFfM18x',
  '3bulan': 'Mzk3MjA4NDM3NjFfM18z',
  '1tahun': 'Mzk3MjA4NDM3NjFfM18xMg=='
};

// ===== FUNGSI BANTU =====
function vipDate(epoch) {
  if (!epoch || epoch === 0) return "-";
  return new Date(epoch * 1000).toLocaleString("id-ID");
}

function getResponseTime(startTime) {
  return Date.now() - startTime;
}

// ===== FUNGSI LOGIN =====
async function login(email) {
  try {
    const payload = {
      user: "wibu",
      email: email,
      profil: "https://lh3.googleusercontent.com/a/ACg8ocIk6mQVP02KEycB9_MYhhtyiN8eyDaz_N3dp3OwwIDN30ri0XYS=s288-c-no"
    };

    console.log(`[AnimeLovers] Login attempt for: ${email}`);

    const response = await client.post(
      "https://apps.animekita.org/api/v1.1.6/model/login.php",
      JSON.stringify(payload),
      { headers: HEADERS }
    );

    const json = response.data;
    
    if (!json.data || !json.data[0] || !json.data[0].token) {
      throw new Error("Login gagal atau token tidak ditemukan.");
    }

    console.log(`[AnimeLovers] Login success for: ${email}`);
    return json.data[0].token;
  } catch (error) {
    console.error(`[AnimeLovers] Login error:`, error.message);
    throw new Error(`Login error: ${error.message}`);
  }
}

// ===== FUNGSI GET DATA USER =====
async function getData(token) {
  try {
    const response = await client.post(
      "https://apps.animekita.org/api/v1.1.6/model/app-config.php",
      JSON.stringify({ token }),
      { headers: HEADERS }
    );

    const json = response.data;
    
    if (!json.data || !json.data[0]) {
      throw new Error("Data user kosong");
    }

    return json.data[0];
  } catch (error) {
    console.error(`[AnimeLovers] GetData error:`, error.message);
    throw new Error(`Get data error: ${error.message}`);
  }
}

// ===== FUNGSI AKTIVASI VIP =====
async function setPremium(token, vipCode) {
  try {
    const params = new URLSearchParams();
    params.append('token', token);
    params.append('vip', vipCode);

    // Header khusus untuk form-urlencoded
    const formHeaders = {
      ...HEADERS,
      "Content-Type": "application/x-www-form-urlencoded"
    };

    const response = await client.post(
      "https://apps.animekita.org/api/v1.1.6/model/vip.php",
      params.toString(),
      { headers: formHeaders }
    );

    const json = response.data;
    
    if (json.status !== "success" && json.status !== 1) {
      throw new Error("Gagal aktivasi VIP.");
    }

    return json;
  } catch (error) {
    console.error(`[AnimeLovers] SetPremium error:`, error.message);
    throw new Error(`Set premium error: ${error.message}`);
  }
}

// ============================================================
// ========== ENDPOINT UTAMA ==========
// ============================================================
module.exports = async (req, res) => {
  const startTime = Date.now();

  try {
    // Ambil parameter dari GET atau POST
    const { email, durasi = '1bulan' } = req.method === 'GET' ? req.query : req.body;

    // ===== VALIDASI =====
    if (!email) {
      return res.status(400).json({
        status: false,
        statusCode: 400,
        author: AUTHOR,
        result: null,
        error: 'Parameter "email" wajib diisi.',
        responseTimeMs: getResponseTime(startTime),
        timestamp: new Date().toISOString()
      });
    }

    // Validasi format email sederhana
    if (!email.includes('@') || !email.includes('.')) {
      return res.status(400).json({
        status: false,
        statusCode: 400,
        author: AUTHOR,
        result: null,
        error: 'Format email tidak valid.',
        responseTimeMs: getResponseTime(startTime),
        timestamp: new Date().toISOString()
      });
    }

    const durasiKey = durasi.toLowerCase();
    if (!DURASI_MAP[durasiKey]) {
      return res.status(400).json({
        status: false,
        statusCode: 400,
        author: AUTHOR,
        result: null,
        error: 'Durasi tidak valid. Pilihan: 1bulan, 3bulan, 1tahun',
        responseTimeMs: getResponseTime(startTime),
        timestamp: new Date().toISOString()
      });
    }

    const vipCode = DURASI_MAP[durasiKey];

    // ===== PROSES AKTIVASI =====
    console.log(`[AnimeLovers] Starting activation for ${email} with duration ${durasiKey}`);

    // 1. Login dapat token
    const token = await login(email);
    
    // 2. Get data sebelum aktivasi
    const before = await getData(token);
    
    // 3. Aktivasi VIP
    await setPremium(token, vipCode);
    
    // 4. Get data setelah aktivasi
    const after = await getData(token);

    // ===== FORMAT DATA =====
    const formatData = (data) => ({
      level: data.level || '-',
      rank: data.rank || '-',
      vipLevel: data.vipLevel || '-',
      vipExp: data.vipExp ? vipDate(data.vipExp) : '-',
      username: data.username || '-',
      email: data.email || email
    });

    // ===== RESPON SUKSES =====
    console.log(`[AnimeLovers] Activation success for ${email}`);

    res.status(200).json({
      status: true,
      statusCode: 200,
      author: AUTHOR,
      result: {
        email: email,
        durasi: durasiKey,
        before: formatData(before),
        after: formatData(after),
        message: `✅ VIP berhasil diaktifkan untuk ${email} selama ${durasiKey}`
      },
      responseTimeMs: getResponseTime(startTime),
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    // ===== RESPON ERROR =====
    console.error(`[AnimeLovers] Error:`, error.message);

    res.status(500).json({
      status: false,
      statusCode: 500,
      author: AUTHOR,
      result: null,
      error: error.message || 'Terjadi kesalahan pada server.',
      responseTimeMs: getResponseTime(startTime),
      timestamp: new Date().toISOString()
    });
  }
};
