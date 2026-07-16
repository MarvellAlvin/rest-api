require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Fungsi untuk memuat semua route dari folder api/ secara rekursif
function loadRoutes(dir, basePath = '') {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      // Rekursif ke subfolder
      loadRoutes(fullPath, path.join(basePath, file));
    } else if (file.endsWith('.js')) {
      // Ambil nama file tanpa ekstensi
      const routeName = path.basename(file, '.js');
      // Gabungkan basePath dan routeName, contoh: downloader/tiktok
      const routePath = path.join(basePath, routeName);
      // Register route
      const handler = require(fullPath);
      app.use(`/api/${routePath}`, handler);
      console.log(`Route registered: /api/${routePath}`);
    }
  }
}

// Muat semua route dari folder api/
const apiPath = path.join(__dirname, 'api');
if (fs.existsSync(apiPath)) {
  loadRoutes(apiPath);
} else {
  console.warn('Folder api/ tidak ditemukan, tidak ada route yang dimuat.');
}

// Halaman statis
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'index.html'));
});

app.get('/documentation', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'documentation.html'));
});

app.get('/api', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'api.json'));
});

// Ekspor untuk Vercel
module.exports = app;

// Jalankan lokal jika diperlukan
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}