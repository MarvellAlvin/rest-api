// services/cctv.js
const axios = require('axios');
const cheerio = require('cheerio');

const BASE_URL = 'https://cctv.badilag.net';
const TIMEOUT = 15000;

class BadilagCctv {
    constructor() {
        this.baseUrl = BASE_URL;
        this.client = axios.create({
            baseURL: BASE_URL,
            timeout: TIMEOUT,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Cache-Control': 'no-cache'
            }
        });
        this.csrfToken = null;
        this.cookies = '';
        this.satkerList = [];
        this.isInitialized = false;
    }

    /**
     * Inisialisasi: ambil home page, cookie, csrf token, daftar satker
     */
    async _initialize() {
        if (this.isInitialized) return;

        try {
            const res = await this.client.get('/');

            // Ambil cookie
            if (res.headers['set-cookie']) {
                this.cookies = res.headers['set-cookie']
                    .map(c => c.split(';')[0])
                    .join('; ');
            }

            const $ = cheerio.load(res.data);

            // Ambil CSRF token
            const csrfMeta = $('meta[name="csrf-token"]');
            if (csrfMeta.length === 0) {
                throw new Error('CSRF token tidak ditemukan di halaman');
            }
            this.csrfToken = csrfMeta.attr('content');

            // Ambil daftar satker
            this.satkerList = [];
            $('#pilih_satker option').each((_, el) => {
                const id = $(el).attr('value');
                const name = $(el).text().trim();
                if (id && !name.includes('--Pilih')) {
                    this.satkerList.push({ id, name });
                }
            });

            if (this.satkerList.length === 0) {
                throw new Error('Tidak ada satker ditemukan');
            }

            this.isInitialized = true;

        } catch (error) {
            throw new Error(`Gagal inisialisasi: ${error.message}`);
        }
    }

    /**
     * Ambil daftar semua satker
     */
    async getSatkerList() {
        await this._initialize();
        return this.satkerList;
    }

    /**
     * Cari satker berdasarkan kata kunci
     */
    async searchSatker(query) {
        if (!query || typeof query !== 'string') {
            throw new Error('Parameter query wajib diisi');
        }
        await this._initialize();
        const lowerQuery = query.toLowerCase();
        return this.satkerList.filter(s => 
            s.name.toLowerCase().includes(lowerQuery)
        );
    }

    /**
     * Ambil daftar CCTV untuk satker tertentu
     */
    async getCCTV(id) {
        if (!id || typeof id !== 'string') {
            throw new Error('Parameter id wajib diisi');
        }

        await this._initialize();

        // Cari nama satker untuk response
        const satker = this.satkerList.find(s => s.id === id);
        const satkerName = satker ? satker.name : 'Unknown';

        try {
            const params = new URLSearchParams();
            params.append('id_satker', id);
            params.append('csrf_token', this.csrfToken);

            const res = await this.client.post(
                '/display/get_cctv_satker',
                params.toString(),
                {
                    headers: {
                        'Cookie': this.cookies,
                        'X-Requested-With': 'XMLHttpRequest',
                        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                        'Accept': 'application/json, text/javascript, */*; q=0.01',
                        'Referer': `${this.baseUrl}/`
                    },
                    timeout: TIMEOUT
                }
            );

            // Update CSRF token jika ada di header
            if (res.headers['x-csrf-token']) {
                this.csrfToken = res.headers['x-csrf-token'];
            }

            // Cek response status
            if (!res.data || res.data.status !== true) {
                throw new Error('Response dari server tidak valid');
            }

            // Parse HTML konten
            const konten = res.data.konten;
            if (!konten || typeof konten !== 'string') {
                throw new Error('Konten CCTV kosong');
            }

            const $ = cheerio.load(konten);
            const cctvs = [];

            $('.card').each((_, el) => {
                const title = $(el).find('h6').text().replace(' PTSP', 'PTSP').trim();
                const iframe = $(el).find('iframe');
                const iframeSrc = iframe.attr('src');

                if (iframeSrc) {
                    const m3u8 = this._extractM3u8(iframeSrc);
                    cctvs.push({
                        title: title || 'CCTV',
                        iframe: iframeSrc,
                        m3u8: m3u8 // sudah diekstrak otomatis
                    });
                }
            });

            return {
                id,
                satker: satkerName,
                cctvs
            };

        } catch (error) {
            // Jika error karena CSRF, coba re-inisialisasi dan retry sekali
            if (error.response && error.response.status === 403) {
                this.isInitialized = false;
                await this._initialize();
                // Retry dengan token baru
                return this.getCCTV(id);
            }
            throw new Error(`Gagal mengambil CCTV: ${error.message}`);
        }
    }

    /**
     * Ekstrak link m3u8 dari URL iframe
     */
    _extractM3u8(iframeUrl) {
        if (!iframeUrl) return null;

        try {
            const parsedUrl = new URL(iframeUrl);
            const streamId = parsedUrl.searchParams.get('name') || 
                            parsedUrl.searchParams.get('id');

            if (streamId) {
                const baseUrl = iframeUrl.split('/play.html')[0];
                return `${baseUrl}/streams/${streamId}.m3u8`;
            }
            return null;
        } catch (_) {
            return null;
        }
    }
}

module.exports = BadilagCctv;
