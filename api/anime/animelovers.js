const axios = require('axios');

// Header standar untuk request ke API AnimeLovers
const HEADERS = {
  "Content-Type": "application/json",
  "Accept": "application/json"
};

// Mapping durasi ke kode VIP internal
const DURASI_MAP = {
  '1bulan': 'Mzk3MjA4NDM3NjFfM18x',
  '3bulan': 'Mzk3MjA4NDM3NjFfM18z',
  '1tahun': 'Mzk3MjA4NDM3NjFfM18xMg=='
};

// Fungsi untuk format tanggal dari epoch
function vipDate(epoch) {
  if (!epoch || epoch === 0) return "-";
  return new Date(epoch * 1000).toLocaleString("id-ID");
}

// Fungsi login ke AnimeLovers, mengembalikan token
async function login(email) {
  const payload = {
    user: "wibu",
    email: email,
    profil: "https://lh3.googleusercontent.com/a/ACg8ocIk6mQVP02KEycB9_MYhhtyiN8eyDaz_N3dp3OwwIDN30ri0XYS=s288-c-no"
  };
  try {
    const response = await axios.post("https://apps.animekita.org/api/v1.1.6/model/login.php", payload, {
      headers: HEADERS
    });
    const json = response.data;
    if (!json.data || !json.data[0] || !json.data[0].token) {
      throw new Error("Login gagal atau token tidak ditemukan.");
    }
    return json.data[0].token;
  } catch (error) {
    throw new Error(`Login error: ${error.message}`);
  }
}

// Fungsi untuk mengambil data user berdasarkan token
async function getData(token) {
  try {
    const response = await axios.post("https://apps.animekita.org/api/v1.1.6/model/app-config.php", { token }, {
      headers: HEADERS
    });
    const json = response.data;
    if (!json.data || !json.data[0]) {
      throw new Error("Data user kosong");
    }
    return json.data[0];
  } catch (error) {
    throw new Error(`Get data error: ${error.message}`);
  }
}

// Fungsi untuk mengaktifkan VIP
async function setPremium(token, vipCode) {
  const params = new URLSearchParams();
  params.append('token', token);
  params.append('vip', vipCode);
  try {
    const response = await axios.post("https://apps.animekita.org/api/v1.1.6/model/vip.php", params.toString(), {
      headers: {
        ...HEADERS,
        "Content-Type": "application/x-www-form-urlencoded"
      }
    });
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
    // Ambil parameter dari query string (GET) atau body (POST)
    const { email, durasi = '1bulan' } = req.method === 'GET' ? req.query : req.body;

    // Validasi email
    if (!email) {
      return res.status(400).json({ 
        success: false, 
        error: 'Parameter "email" wajib diisi.' 
      });
    }

    // Validasi durasi
    const durasiKey = durasi.toLowerCase();
    if (!DURASI_MAP[durasiKey]) {
      return res.status(400).json({
        success: false,
        error: 'Durasi tidak valid. Pilihan: 1bulan, 3bulan, 1tahun'
      });
    }

    const vipCode = DURASI_MAP[durasiKey];

    // Proses aktivasi
    const token = await login(email);
    const before = await getData(token);
    await setPremium(token, vipCode);
    const after = await getData(token);

    // Format data sebelum & sesudah
    const formatData = (data) => ({
      level: data.level || '-',
      rank: data.rank || '-',
      vipLevel: data.vipLevel || '-',
      vipExp: data.vipExp ? vipDate(data.vipExp) : '-'
    });

    // Kirim response sukses
    res.json({
      success: true,
      email,
      durasi: durasiKey,
      before: formatData(before),
      after: formatData(after),
      message: `VIP berhasil diaktifkan untuk ${email} selama ${durasiKey}`
    });

  } catch (error) {
    // Tangani error
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
