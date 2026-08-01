// api/tools/amprem.js
const axios = require('axios');
const https = require('https');

// ===== KONFIGURASI =====
const API_KEY = "DEZZIFY-AMPREM";
const BASE_URL = 'https://am-prem.vxz.my.id/api';
const MAX_LIMIT = 20;
const DEBUG = true;

// ===== AGENT HTTPS (abaikan SSL) =====
const httpsAgent = new https.Agent({
    rejectUnauthorized: false
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

// ===== GENERATE TEMP EMAIL (1secmail) =====
async function generateTempEmail() {
    try {
        log('Generating temp email via 1secmail...');
        
        // Gunakan domain utama 1secmail.com (bukan api.1secmail.com)
        const response = await axios.get(
            'https://1secmail.com/api/v1/?action=genRandomMailbox&count=1',
            { 
                timeout: 10000,
                httpsAgent: httpsAgent // bypass SSL
            }
        );
        
        if (!response.data || !Array.isArray(response.data) || response.data.length === 0) {
            throw new Error('Failed to generate email from 1secmail');
        }
        
        const email = response.data[0];
        log(`Email generated: ${email}`);
        
        return {
            success: true,
            email: email,
            address: email
        };
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
        const response = await axios.get(url, {
            timeout: 30000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            httpsAgent: httpsAgent
        });
        
        if (!response.data || response.data.success !== true) {
            throw new Error(`Send activation failed: ${JSON.stringify(response.data)}`);
        }
        
        log('Activation sent successfully');
        return response.data;
    } catch (error) {
        if (error.response) {
            throw new Error(`Send activation error: ${error.response.status} - ${error.response.data?.error || error.response.statusText}`);
        }
        throw new Error(`Send activation error: ${error.message}`);
    }
}

// ===== WAIT FOR INBOX (1secmail) =====
async function waitForInbox(email) {
    const maxWaitTime = 120000; // 2 menit
    const pollInterval = 3000; // 3 detik
    const startTime = Date.now();
    
    log('Waiting for verification link in inbox via 1secmail...');
    
    const [login, domain] = email.split('@');
    
    while (Date.now() - startTime < maxWaitTime) {
        try {
            // Cek inbox menggunakan domain utama
            const response = await axios.get(
                `https://1secmail.com/api/v1/?action=getMessages&login=${login}&domain=${domain}`,
                { 
                    timeout: 10000,
                    httpsAgent: httpsAgent
                }
            );
            
            const messages = Array.isArray(response.data) ? response.data : [];
            
            for (const msg of messages) {
                // Ambil detail pesan
                const detailResponse = await axios.get(
                    `https://1secmail.com/api/v1/?action=readMessage&login=${login}&domain=${domain}&id=${msg.id}`,
                    { 
                        timeout: 10000,
                        httpsAgent: httpsAgent
                    }
                );
                
                const detail = detailResponse.data;
                let textToSearch = '';
                
                if (detail.textBody) {
                    textToSearch = detail.textBody;
                } else if (detail.htmlBody) {
                    textToSearch = detail.htmlBody;
                } else {
                    textToSearch = JSON.stringify(detail);
                }
                
                textToSearch = textToSearch.replace(/&amp;/g, '&');
                
                const match = textToSearch.match(/(https:\/\/alight-creative\.firebaseapp\.com\/__\/auth\/links\?link=[^\s"'>\\]+)/);
                if (match) {
                    log('Verification link found!');
                    return match[1];
                }
            }
            
            await new Promise(resolve => setTimeout(resolve, pollInterval));
            
        } catch (error) {
            log(`Polling error: ${error.message}, retrying...`);
            await new Promise(resolve => setTimeout(resolve, pollInterval));
        }
    }
    
    throw new Error('Timeout waiting for verification link (2 menit)');
}

// ===== VERIFY ACCOUNT =====
async function verifyAccount(email, link) {
    try {
        log(`Verifying account ${email}...`);
        
        const url = `${BASE_URL}/verify?email=${encodeURIComponent(email)}&link=${encodeURIComponent(link)}&apply=true&apikey=${API_KEY}`;
        const response = await axios.get(url, {
            timeout: 30000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            httpsAgent: httpsAgent
        });
        
        if (!response.data || response.data.success !== true) {
            throw new Error(`Verification failed: ${JSON.stringify(response.data)}`);
        }
        
        log('Account verified successfully!');
        return response.data;
    } catch (error) {
        if (error.response) {
            throw new Error(`Verification error: ${error.response.status} - ${error.response.data?.error || error.response.statusText}`);
        }
        throw new Error(`Verification error: ${error.message}`);
    }
}

// ===== PROCESS SINGLE ACCOUNT =====
async function processSingleAccount() {
    try {
        log('======= STEP 1/5: Generate Email =======');
        const tempResult = await generateTempEmail();
        if (!tempResult || !tempResult.email) {
            throw new Error('Failed to generate temp email');
        }
        const email = tempResult.email;

        log('======= STEP 2/5: Send API =======');
        const sendResult = await sendActivation(email);

        log('======= STEP 3/5: Waiting Inbox =======');
        const link = await waitForInbox(email);

        log('======= STEP 4/5: Verify =======');
        const verifyResult = await verifyAccount(email, link);

        log('======= STEP 5/5: Success =======');
        log(`Account created: ${email}`);

        return {
            success: true,
            email: email,
            verificationLink: link,
            sendResult: sendResult,
            verifyResult: verifyResult,
            timestamp: new Date().toISOString()
        };

    } catch (error) {
        log(`❌ Error: ${error.message}`);
        return {
            success: false,
            error: error.message
        };
    }
}

// ===== PROCESS BATCH ACCOUNTS =====
async function processBatch(limit) {
    const results = [];
    let success = 0;
    let failed = 0;
    
    log(`Processing ${limit} accounts...`);
    
    for (let i = 0; i < limit; i += 5) {
        const batchSize = Math.min(5, limit - i);
        const batchPromises = [];
        
        log(`📦 Processing batch ${Math.floor(i/5) + 1} (${batchSize} accounts)...`);
        
        for (let j = 0; j < batchSize; j++) {
            const accountNumber = i + j + 1;
            log(`🔄 Account ${accountNumber}/${limit}`);
            batchPromises.push(processSingleAccount());
        }
        
        const batchResults = await Promise.all(batchPromises);
        
        for (const result of batchResults) {
            if (result.success) {
                success++;
                results.push({
                    email: result.email,
                    status: 'success',
                    timestamp: result.timestamp
                });
            } else {
                failed++;
                results.push({
                    status: 'failed',
                    error: result.error
                });
            }
        }
        
        if (i + 5 < limit) {
            log('⏳ Waiting 60 seconds for rate limit...');
            await new Promise(resolve => setTimeout(resolve, 60000));
        }
    }
    
    log(`✅ Complete: ${success} success, ${failed} failed`);
    
    return {
        success,
        failed,
        total: limit,
        results
    };
}

// ========== ENDPOINT UTAMA ==========
module.exports = async (req, res) => {
    const startTime = Date.now();

    log('========== NEW REQUEST ==========');

    let { limit = 1 } = req.method === 'GET' ? req.query : req.body;
    limit = parseInt(limit) || 1;

    log(`Method: ${req.method}, Limit: ${limit}`);

    if (limit < 1) {
        return res.status(400).json({
            status: false,
            statusCode: 400,
            author: '@velz',
            error: 'Limit minimal adalah 1.',
            responseTimeMs: Date.now() - startTime,
            timestamp: new Date().toISOString()
        });
    }

    if (limit > MAX_LIMIT) {
        return res.status(400).json({
            status: false,
            statusCode: 400,
            author: '@velz',
            error: `Limit maksimal adalah ${MAX_LIMIT}.`,
            responseTimeMs: Date.now() - startTime,
            timestamp: new Date().toISOString()
        });
    }

    try {
        let result;

        if (limit === 1) {
            const singleResult = await processSingleAccount();
            
            if (!singleResult.success) {
                return res.status(500).json({
                    status: false,
                    statusCode: 500,
                    author: '@velz',
                    error: singleResult.error || 'Gagal membuat akun Alight Motion premium.',
                    responseTimeMs: Date.now() - startTime,
                    timestamp: new Date().toISOString()
                });
            }

            result = {
                email: singleResult.email,
                verificationLink: singleResult.verificationLink,
                timestamp: singleResult.timestamp,
                provider: 'Alight Motion Premium'
            };
        } else {
            const batchResult = await processBatch(limit);
            
            result = {
                total: batchResult.total,
                success: batchResult.success,
                failed: batchResult.failed,
                results: batchResult.results,
                provider: 'Alight Motion Premium'
            };
        }

        log('✅ Response sent successfully');
        res.status(200).json({
            status: true,
            statusCode: 200,
            author: '@velz',
            result: result,
            responseTimeMs: Date.now() - startTime,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        log(`❌ Error: ${error.message}`);

        let statusCode = 500;
        let errorMessage = error.message || 'Terjadi kesalahan pada server.';

        if (error.message.includes('timeout') || error.message.includes('Timeout')) {
            statusCode = 408;
            errorMessage = 'Request timeout. Silakan coba lagi.';
        } else if (error.message.includes('rate limit')) {
            statusCode = 429;
            errorMessage = 'Rate limit exceeded. Silakan coba lagi nanti.';
        }

        res.status(statusCode).json({
            status: false,
            statusCode: statusCode,
            author: '@velz',
            error: errorMessage,
            responseTimeMs: Date.now() - startTime,
            timestamp: new Date().toISOString()
        });
    }
};
