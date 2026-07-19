// services/web2apk.js
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const os = require('os');

class Web2ApkService {
    constructor({ apiUrl = 'https://webappcreator.amethystlab.org/api/build-apk', baseUrl = 'https://webappcreator.amethystlab.org' } = {}) {
        this.apiUrl = apiUrl;
        this.baseUrl = baseUrl;
    }

    isValidUrl(url) {
        return /^https?:\/\//i.test(url);
    }

    buildPackageName(appName) {
        const cleaned = appName.toLowerCase().replace(/[^a-z0-9]/g, '');
        return `com.${cleaned || 'app'}.web2apk`;
    }

    saveIconBuffer(buffer) {
        const tempDir = path.join(os.tmpdir(), 'web2apk');
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
        const iconPath = path.join(tempDir, `icon_${Date.now()}.png`);
        fs.writeFileSync(iconPath, buffer);
        return iconPath;
    }

    async build({ url, appName, iconBuffer, versionName = '1.0.0', versionCode = 1 }) {
        if (!this.isValidUrl(url)) throw new Error('URL harus diawali dengan http:// atau https://');
        if (!appName) throw new Error('Nama aplikasi tidak boleh kosong.');
        if (!iconBuffer) throw new Error('Icon aplikasi wajib disertakan.');

        const packageName = this.buildPackageName(appName);
        const iconPath = this.saveIconBuffer(iconBuffer);

        try {
            const form = new FormData();
            form.append('websiteUrl', url);
            form.append('appName', appName);
            form.append('icon', fs.createReadStream(iconPath));
            form.append('packageName', packageName);
            form.append('versionName', versionName);
            form.append('versionCode', versionCode);

            const response = await axios.post(this.apiUrl, form, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
                    'Accept': 'application/json, text/plain, */*',
                    'Origin': this.baseUrl,
                    'Referer': `${this.baseUrl}/`,
                    ...form.getHeaders()
                },
                maxContentLength: Infinity,
                maxBodyLength: Infinity,
                timeout: 120000
            });

            const data = response.data;
            if (!data.success) throw new Error(data.message || 'Gagal mem-build APK dari server.');

            return {
                success: true,
                appName,
                packageName,
                downloadUrl: `${this.baseUrl}${data.downloadUrl}`
            };
        } finally {
            if (fs.existsSync(iconPath)) fs.unlinkSync(iconPath);
        }
    }
}

module.exports = Web2ApkService;
