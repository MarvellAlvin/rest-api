require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// ===== Middleware Dasar =====
app.set('json spaces', 2);
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ===== Middleware CORS Sederhana =====
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Origin, Content-Type, Accept');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
});

// ===== Fungsi Aman untuk Load Route =====
function safeLoadRoute(filePath, routePath) {
    try {
        const handler = require(filePath);
        if (typeof handler === 'function') {
            app.use(routePath, handler);
            console.log(`✅ Route registered: ${routePath}`);
        } else {
            console.warn(`⚠️  ${filePath} tidak mengekspor fungsi, dilewati.`);
        }
    } catch (error) {
        console.error(`❌ Gagal load ${filePath}:`, error.message);
    }
}

// ===== Load Route Secara Manual (Lebih Aman) =====
const apiDir = path.join(__dirname, 'api');

// Cek folder api ada
if (fs.existsSync(apiDir)) {
    // Baca semua subfolder dan file di dalam api/
    const items = fs.readdirSync(apiDir, { withFileTypes: true });
    for (const item of items) {
        if (item.isDirectory()) {
            const subDir = path.join(apiDir, item.name);
            const files = fs.readdirSync(subDir);
            for (const file of files) {
                if (file.endsWith('.js')) {
                    const routeName = path.basename(file, '.js');
                    const routePath = `/api/${item.name}/${routeName}`;
                    const filePath = path.join(subDir, file);
                    safeLoadRoute(filePath, routePath);
                }
            }
        } else if (item.isFile() && item.name.endsWith('.js')) {
            const routeName = path.basename(item.name, '.js');
            const routePath = `/api/${routeName}`;
            const filePath = path.join(apiDir, item.name);
            safeLoadRoute(filePath, routePath);
        }
    }
} else {
    console.warn('⚠️  Folder api/ tidak ditemukan.');
}

// ===== Halaman Statis =====
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'index.html'), (err) => {
        if (err) res.status(404).send('Halaman tidak ditemukan');
    });
});

app.get('/documentation', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'documentation.html'), (err) => {
        if (err) res.status(404).send('Halaman tidak ditemukan');
    });
});

app.get('/playground', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'playground.html'));
});
 
// ===== Endpoint 404 untuk Route yang Tidak Dikenal =====
app.use((req, res) => {
    res.status(404).json({
        status: false,
        statusCode: 404,
        author: '@velz',
        error: 'Endpoint tidak ditemukan',
        timestamp: new Date().toISOString()
    });
});

// ===== Error Handler Global =====
app.use((err, req, res, next) => {
    console.error('🔥 Global error:', err.message);
    res.status(500).json({
        status: false,
        statusCode: 500,
        author: '@velz',
        error: err.message || 'Internal server error',
        timestamp: new Date().toISOString()
    });
});

// ===== Ekspor untuk Vercel =====
module.exports = app;

// ===== Jalankan Lokal (jika di-run langsung) =====
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`🚀 Server running on http://localhost:${PORT}`);
        console.log('📁 Routes yang terdaftar:');
        app._router.stack.forEach((layer) => {
            if (layer.route) {
                const methods = Object.keys(layer.route.methods).join(',').toUpperCase();
                console.log(`   ${methods} ${layer.route.path}`);
            }
        });
    });
}
