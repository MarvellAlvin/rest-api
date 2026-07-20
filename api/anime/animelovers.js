const axios = require('axios');

// ===== HEADER YANG DISESUAIKAN DENGAN BOT =====
const HEADERS = {
  "Content-Type": "text/plain; charset=utf-8",  // <-- Diubah dari application/json
  "Accept": "application/json",
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
};

// Mapping durasi ke kode VIP internal
const DURASI_MAP = {
  '1bulan': 'Mzk3MjA4NDM3NjFfM18x',
  '3bulan': 'Mzk3MjA4NDM3NjFfM18z',
  '1tahun': 'Mzk3MjA4NDM3NjFfM18xMg=='
};

function vipDate(epoch) {
  if (!epoch || epoch === 0) return "-";
  return new Date(epoch * 1000).toLocaleString("id-ID");
}

// ===== LOGIN =====
async function login(email) {
  const payload = {
    user: "wibu",
    email: email,
    profil: "https://lh3.googleusercontent.com/a/ACg8ocIk6mQVP02KEycB9_MYhhtyiN8eyDaz_N3dp3OwwIDN30ri0XYS=s288-c-no"
  };
  try {
    const response = await axios.post(
      "https://apps.animekita.org/api/v1.1.6/model/login.php",
      JSON.stringify(payload),   // <-- Body tetap JSON string
      { headers: HEADERS }       // <-- Header sudah disesuaikan
    );
    const json = response.data;
    if (!json.data || !json.data[0] || !json.data[0].token) {
      throw new Error("Login gagal atau token tidak ditemukan.");
    }
    return json.data[0].token;
  } catch (error) {
    throw new Error(`Login error: ${error.message}`);
  }
}

// ===== GET DATA =====
async function getData(token) {
  try {
    const response = await axios.post(
      "https://apps.animekita.org/api/v1.1.6/model/app-config.php",
      JSON.stringify({ token }),  // <-- Body JSON string
      { headers: HEADERS }
    );
    const json = response.data;
    if (!json.data || !json.data[0]) {
      throw new Error("Data user kosong");
    }
    return json.data[0];
  } catch (error) {
    throw new Error(`Get data error: ${error.message}`);
  }
}

// ===== SET PREMIUM =====
async function setPremium(token, vipCode) {
  // Untuk endpoint ini, bot menggunakan x-www-form-urlencoded, bukan JSON
  const params = new URLSearchParams();
  params.append('token', token);
  params.append('vip', vipCode);

  // Header khusus untuk x-www-form-urlencoded
  const formHeaders = {
    ...HEADERS,
    "Content-Type": "application/x-www-form-urlencoded"
  };

  try {
    const response = await axios.post(
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
    throw new Error(`Set premium error: ${error.message}`);
  }
}

// ========== ENDPOINT UTAMA ==========
module.exports = async (req, res) => {
  try {
    const { email, durasi = '1bulan' } = req.method === 'GET' ? req.query : req.body;

    if (!email) {
      return res.status(400).json({ 
        success: false, 
        error: 'Parameter "email" wajib diisi.' 
      });
    }

    const durasiKey = durasi.toLowerCase();
    if (!DURASI_MAP[durasiKey]) {
      return res.status(400).json({
        success: false,
        error: 'Durasi tidak valid. Pilihan: 1bulan, 3bulan, 1tahun'
      });
    }

    const vipCode = DURASI_MAP[durasiKey];

    const token = await login(email);
    const before = await getData(token);
    await setPremium(token, vipCode);
    const after = await getData(token);

    const formatData = (data) => ({
      level: data.level || '-',
      rank: data.rank || '-',
      vipLevel: data.vipLevel || '-',
      vipExp: data.vipExp ? vipDate(data.vipExp) : '-'
    });

    res.json({
      success: true,
      email,
      durasi: durasiKey,
      before: formatData(before),
      after: formatData(after),
      message: `VIP berhasil diaktifkan untuk ${email} selama ${durasiKey}`
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
