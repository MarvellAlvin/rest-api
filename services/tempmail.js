// services/tempmail.js
const https = require('https');

const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
];

class TempmailV3 {
    _generateRandomIP() {
        const ranges = [
            [1,1], [2,2], [5,5], [23,23], [27,27], [31,31], [36,36], [37,37], [39,39], [42,42],
            [46,46], [49,49], [50,50], [60,60], [114,114], [117,117], [118,118], [119,119], [120,120],
            [121,121], [122,122], [123,123], [124,124], [125,125], [126,126], [180,180], [182,182], [183,183]
        ];
        const range = ranges[Math.floor(Math.random() * ranges.length)];
        return [
            range[0],
            Math.floor(Math.random() * 256),
            Math.floor(Math.random() * 256),
            Math.floor(Math.random() * 256)
        ].join('.');
    }

    /**
     * Generate alamat email sementara
     * @param {number} expire - Durasi berlaku dalam menit (misal 10)
     * @returns {Promise<{ email: string, visitorId: string, userAgent: string, spoofedIp: string }>}
     */
    generate(expire) {
        return new Promise((resolve, reject) => {
            if (typeof expire !== 'number' || expire <= 0) {
                return reject(new Error('Parameter "expire" harus angka positif (menit).'));
            }

            const spoofedIp = this._generateRandomIP();
            const userAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];

            const options = {
                hostname: 'temp-mail.app',
                path: `/api/mail/address?refresh=true&expire=${expire}&part=main`,
                method: 'GET',
                headers: {
                    'User-Agent': userAgent,
                    'Accept': 'application/json',
                    'X-Forwarded-For': spoofedIp,
                    'X-Real-IP': spoofedIp,
                    'Client-IP': spoofedIp,
                    'True-Client-IP': spoofedIp,
                    'X-Originating-IP': spoofedIp,
                    'X-Cluster-Client-IP': spoofedIp,
                    'Forwarded': `for=${spoofedIp}`
                },
                rejectUnauthorized: false
            };

            const req = https.request(options, (res) => {
                let raw = '';
                let visitorId = null;

                // Ambil visitorId dari cookie
                const setCookie = res.headers['set-cookie'];
                if (setCookie) {
                    for (const cookie of setCookie) {
                        const match = cookie.match(/visitorId=([^;]+)/);
                        if (match && match[1]) visitorId = match[1];
                    }
                }

                res.on('data', chunk => raw += chunk);
                res.on('end', () => {
                    try {
                        const parsed = JSON.parse(raw);
                        if (!parsed.email) {
                            return reject(new Error('Gagal mendapatkan email dari server.'));
                        }
                        resolve({
                            email: parsed.email,
                            visitorId: visitorId || null,
                            userAgent: userAgent,
                            spoofedIp: spoofedIp,
                            raw: parsed
                        });
                    } catch (e) {
                        reject(new Error(`Gagal parse response: ${e.message}`));
                    }
                });
            });

            req.on('error', reject);
            req.end();
        });
    }

    /**
     * Ambil daftar pesan masuk menggunakan visitorId
     * @param {string} visitorId - ID pengunjung dari hasil generate
     * @param {string} userAgent - User-Agent (opsional, bisa pakai default)
     * @param {string} spoofedIp - IP palsu (opsional)
     * @returns {Promise<Array>}
     */
    inbox(visitorId, userAgent = null, spoofedIp = null) {
        return new Promise((resolve, reject) => {
            if (!visitorId) {
                return reject(new Error('Parameter "visitorId" wajib diisi.'));
            }

            const ua = userAgent || USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
            const ip = spoofedIp || this._generateRandomIP();

            const options = {
                hostname: 'temp-mail.app',
                path: `/api/mail/list?part=main`,
                method: 'GET',
                headers: {
                    'User-Agent': ua,
                    'Accept': 'application/json',
                    'Cookie': `visitorId=${visitorId}`,
                    'X-Forwarded-For': ip,
                    'X-Real-IP': ip,
                    'Client-IP': ip,
                    'True-Client-IP': ip,
                    'X-Originating-IP': ip,
                    'X-Cluster-Client-IP': ip,
                    'Forwarded': `for=${ip}`
                },
                rejectUnauthorized: false
            };

            const req = https.request(options, (res) => {
                let raw = '';
                res.on('data', chunk => raw += chunk);
                res.on('end', () => {
                    try {
                        const parsed = JSON.parse(raw);
                        resolve(parsed);
                    } catch (e) {
                        reject(new Error(`Gagal parse inbox: ${e.message}`));
                    }
                });
            });

            req.on('error', reject);
            req.end();
        });
    }
}

module.exports = TempmailV3;
