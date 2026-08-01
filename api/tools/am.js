// api/tools/amprem.js
const axios = require('axios');
const https = require('https');

// ===== KONFIGURASI =====
const API_KEY = "DEZZIFY-AMPREM";
const BASE_URL = 'https://am-prem.vxz.my.id/api';
const MAX_LIMIT = 20;
const DEBUG = true;
const SECMAIL_BASE = 'https://www.1secmail.com/api/v1'; // <-- gunakan www

// ===== AGENT HTTPS =====
const httpsAgent = new https.Agent({
    rejectUnauthorized: false // bypass SSL jika perlu
});

// ===== FUNGSI LOGGING =====
function log(message, data = null) {
    if (!DEBUG) return;
    if (data) {
        console.log(`[AM Prem] ${message}`, data);
    } else {
        console.log(`[AM Prem] ${message}`);
    }
}

// ===== GENERATE TEMP EMAIL =====
async function generateTempEmail() {
    try {
        log('Generating temp email via 1secmail...');
        const response = await axios.get(
            `${SECMAIL_BASE}/?action=genRandomMailbox&count=1`,
            { timeout: 15000, httpsAgent }
        );
        if (!response.data || !Array.isArray(response.data) || response.data.length === 0) {
            throw new Error('Failed to generate email');
        }
        const email = response.data[0];
        log(`Email generated: ${email}`);
        return { success: true, email, address: email };
    } catch (error) {
        log(`Generate email error: ${error.message}`);
        throw new Error(`Generate email error: ${error.message}`);
    }
}

// ===== SEND ACTIVATION =====
async function sendActivation(email) {
    try {
        log(`Sending activation to ${email}...`);
        const url = `${BASE_URL}/send?email=${encodeURIComponent(email)}&apikey=${API_KEY}`;
        const response = await axios.get(url, { timeout: 30000, httpsAgent });
        if (!response.data || response.data.success !== true) {
            throw new Error(`Send failed: ${JSON.stringify(response.data)}`);
        }
        log('Activation sent');
        return response.data;
    } catch (error) {
        if (error.response) {
            throw new Error(`Send error: ${error.response.status} - ${error.response.data?.error || error.response.statusText}`);
        }
        throw new Error(`Send error: ${error.message}`);
    }
}

// ===== WAIT FOR INBOX =====
async function waitForInbox(email) {
    const maxWaitTime = 120000;
    const pollInterval = 3000;
    const startTime = Date.now();
    const [login, domain] = email.split('@');
    
    log('Waiting for verification link...');
    
    while (Date.now() - startTime < maxWaitTime) {
        try {
            const response = await axios.get(
                `${SECMAIL_BASE}/?action=getMessages&login=${login}&domain=${domain}`,
                { timeout: 10000, httpsAgent }
            );
            const messages = Array.isArray(response.data) ? response.data : [];
            for (const msg of messages) {
                const detail = await axios.get(
                    `${SECMAIL_BASE}/?action=readMessage&login=${login}&domain=${domain}&id=${msg.id}`,
                    { timeout: 10000, httpsAgent }
                );
                const text = detail.data.textBody || detail.data.htmlBody || JSON.stringify(detail.data);
                const match = text.match(/(https:\/\/alight-creative\.firebaseapp\.com\/__\/auth\/links\?link=[^\s"'>\\]+)/);
                if (match) {
                    log('Link found!');
                    return match[1];
                }
            }
            await new Promise(r => setTimeout(r, pollInterval));
        } catch (e) {
            log(`Polling error: ${e.message}, retrying...`);
            await new Promise(r => setTimeout(r, pollInterval));
        }
    }
    throw new Error('Timeout waiting for verification link (2 menit)');
}

// ===== VERIFY ACCOUNT =====
async function verifyAccount(email, link) {
    try {
        log(`Verifying ${email}...`);
        const url = `${BASE_URL}/verify?email=${encodeURIComponent(email)}&link=${encodeURIComponent(link)}&apply=true&apikey=${API_KEY}`;
        const response = await axios.get(url, { timeout: 30000, httpsAgent });
        if (!response.data || response.data.success !== true) {
            throw new Error(`Verification failed: ${JSON.stringify(response.data)}`);
        }
        log('Verified!');
        return response.data;
    } catch (error) {
        if (error.response) {
            throw new Error(`Verify error: ${error.response.status} - ${error.response.data?.error || error.response.statusText}`);
        }
        throw new Error(`Verify error: ${error.message}`);
    }
}

// ===== PROCESS SINGLE ACCOUNT =====
async function processSingleAccount() {
    try {
        log('======= STEP 1/5: Generate Email =======');
        const temp = await generateTempEmail();
        const email = temp.email;

        log('======= STEP 2/5: Send API =======');
        await sendActivation(email);

        log('======= STEP 3/5: Waiting Inbox =======');
        const link = await waitForInbox(email);

        log('======= STEP 4/5: Verify =======');
        await verifyAccount(email, link);

        log('======= STEP 5/5: Success =======');
        return {
            success: true,
            email,
            verificationLink: link,
            timestamp: new Date().toISOString()
        };
    } catch (error) {
        log(`❌ Error: ${error.message}`);
        return { success: false, error: error.message };
    }
}

// ===== PROCESS BATCH =====
async function processBatch(limit) {
    const results = [];
    let success = 0, failed = 0;
    for (let i = 0; i < limit; i += 5) {
        const batchSize = Math.min(5, limit - i);
        const batch = [];
        for (let j = 0; j < batchSize; j++) {
            batch.push(processSingleAccount());
        }
        const batchResults = await Promise.all(batch);
        for (const r of batchResults) {
            if (r.success) {
                success++;
                results.push({ email: r.email, status: 'success', timestamp: r.timestamp });
            } else {
                failed++;
                results.push({ status: 'failed', error: r.error });
            }
        }
        if (i + 5 < limit) {
            log('⏳ Waiting 60 seconds for rate limit...');
            await new Promise(r => setTimeout(r, 60000));
        }
    }
    return { success, failed, total: limit, results };
}

// ========== ENDPOINT ==========
module.exports = async (req, res) => {
    const startTime = Date.now();
    log('========== NEW REQUEST ==========');
    let { limit = 1 } = req.method === 'GET' ? req.query : req.body;
    limit = parseInt(limit) || 1;

    if (limit < 1 || limit > MAX_LIMIT) {
        return res.status(400).json({
            status: false,
            statusCode: 400,
            author: '@velz',
            error: limit < 1 ? 'Limit minimal 1.' : `Limit maksimal ${MAX_LIMIT}.`,
            responseTimeMs: Date.now() - startTime,
            timestamp: new Date().toISOString()
        });
    }

    try {
        let result;
        if (limit === 1) {
            const single = await processSingleAccount();
            if (!single.success) {
                return res.status(500).json({
                    status: false,
                    statusCode: 500,
                    author: '@velz',
                    error: single.error,
                    responseTimeMs: Date.now() - startTime,
                    timestamp: new Date().toISOString()
                });
            }
            result = {
                email: single.email,
                verificationLink: single.verificationLink,
                timestamp: single.timestamp,
                provider: 'Alight Motion Premium'
            };
        } else {
            const batch = await processBatch(limit);
            result = {
                total: batch.total,
                success: batch.success,
                failed: batch.failed,
                results: batch.results,
                provider: 'Alight Motion Premium'
            };
        }
        res.status(200).json({
            status: true,
            statusCode: 200,
            author: '@velz',
            result,
            responseTimeMs: Date.now() - startTime,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            status: false,
            statusCode: 500,
            author: '@velz',
            error: error.message,
            responseTimeMs: Date.now() - startTime,
            timestamp: new Date().toISOString()
        });
    }
};
