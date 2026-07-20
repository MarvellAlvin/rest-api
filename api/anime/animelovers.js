const axios = require('axios');

// ===== KONFIGURASI =====
const AUTHOR = "@MarvellAlvin";  // Ganti dengan username GitHub-mu
const HEADERS = {
  "Content-Type": "text/plain; charset=utf-8",
  "Accept": "application/json",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
};

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

// ===== FUNGSI API ANIMELOVERS =====
async function login(email) {
  const payload = {
    user: "wibu",
    email: email,
    profil: "https://lh3.googleusercontent.com/a/ACg8ocIk6mQVP02KEycB9_MYhhtyiN8eyDaz_N3dp3OwwIDN30ri0XYS=s288-c-no"
  };
  const response = await axios.post(
    "https://apps.animekita.org/api/v1.1.6/model/login.php",
    JSON.stringify(payload),
    { headers: HEADERS, timeout: 10000 }
  );
  const json = response.data;
  if (!json.data || !json.data[0] || !json.data[0].token) {
    throw new Error("Login gagal atau token tidak ditemukan.");
  }
  return json.data[0].token;
}

async function getData(token) {
  const response = await axios.post(
    "https://apps.animekita.org/api/v1.1.6/model/app-config.php",
    JSON.stringify({ token }),
    { headers: HEADERS, timeout: 10000 }
  );
  const json = response.data;
  if (!json.data || !json.data[0]) {
    throw new Error("Data user kosong");
  }
  return json.data[0];
}

async function setPremium(token, vipCode) {
  const params = new URLSearchParams();
  params.append('token', token);
  params.append('vip', vipCode);

  const formHeaders = {
    ...HEADERS,
    "Content-Type": "application/x-www-form-urlencoded"
  };

  const response = await axios.post(
    "https://apps.animekita.org/api/v1.1.6/model/vip.php",
    params.toString(),
    { headers: formHeaders, timeout: 10000 }
  );
  const json = response.data;
  if (json.status !== "success" && json.status !== 1) {
    throw new Error("Gagal aktivasi VIP.");
  }
  return json;
}

// ========== ENDPOINT UTAMA ==========
module.exports = async (req, res) => {
  const startTime = Date.now();

  try {
    const { email, durasi = '1bulan' } = req.method === 'GET' ? req.query : req.body;

    // Validasi email
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

    // Validasi durasi
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

    // Proses aktivasi
    const token = await login(email);
    const before = await getData(token);
    await setPremium(token, vipCode);
    const after = await getData(token);

    // Format data hasil
    const formatData = (data) => ({
      level: data.level || '-',
      rank: data.rank || '-',
      vipLevel: data.vipLevel || '-',
      vipExp: data.vipExp ? vipDate(data.vipExp) : '-'
    });

    // ===== RESPON SUKSES DENGAN FORMAT BARU =====
    res.status(200).json({
      status: true,
      statusCode: 200,
      author: AUTHOR,
      result: {
        email: email,
        durasi: durasiKey,
        before: formatData(before),
        after: formatData(after),
        message: `VIP berhasil diaktifkan untuk ${email} selama ${durasiKey}`
      },
      responseTimeMs: getResponseTime(startTime),
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    // ===== RESPON ERROR =====
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
