const https = require('https');
const { URL } = require('url');

const USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
];

class Tempmail {
    constructor() {
        this.uaIndex = Math.floor(Math.random() * USER_AGENTS.length);
    }

    _generateRandomIP() {
        const ranges = [
            [1, 1], [2, 2], [5, 5], [23, 23], [27, 27], [31, 31], [36, 36], [37, 37], [39, 39], [42, 42],
            [46, 46], [49, 49], [50, 50], [60, 60], [114, 114], [117, 117], [118, 118], [119, 119], [120, 120],
            [121, 121], [122, 122], [123, 123], [124, 124], [125, 125], [126, 126], [180, 180], [182, 182], [183, 183]
        ];
        const range = ranges[Math.floor(Math.random() * ranges.length)];
        return [
            range[0],
            Math.floor(Math.random() * 256),
            Math.floor(Math.random() * 256),
            Math.floor(Math.random() * 256)
        ].join('.');
    }

    async _getCorsHeader(spoofedIp) {
        const fetchOptions = {
            method: 'GET',
            headers: {
                'User-Agent': USER_AGENTS[this.uaIndex],
                'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'X-Forwarded-For': spoofedIp,
                'X-Real-IP': spoofedIp,
                'Client-IP': spoofedIp,
                'True-Client-IP': spoofedIp,
                'X-Originating-IP': spoofedIp,
                'X-Cluster-Client-IP': spoofedIp,
                'Forwarded': `for=${spoofedIp}`
            }
        };

        const extractValue = (text) => {
            const keyword = 'mobileTestingHeader';
            const idx = text.indexOf(keyword);
            if (idx === -1) return null;
            
            const sub = text.substring(idx + keyword.length, idx + keyword.length + 100);
            const match = sub.match(/['"]([^'"]+)['"]/);
            if (match && match[1]) {
                return match[1];
            }
            return null;
        };

        const res = await fetch('https://temp-mail.io/', fetchOptions);
        const html = await res.text();
        
        let header = extractValue(html);
        if (header) return header;

        const scriptUrls = [];
        const scriptRegex = /<script[^>]+src=["']([^"']+)["']/gi;
        let match;
        while ((match = scriptRegex.exec(html)) !== null) {
            let src = match[1];
            if (src.startsWith('/')) {
                src = 'https://temp-mail.io' + src;
            } else if (!src.startsWith('http')) {
                src = 'https://temp-mail.io/' + src;
            }
            scriptUrls.push(src);
        }

        for (const url of scriptUrls) {
            try {
                const scriptRes = await fetch(url, fetchOptions);
                const scriptText = await scriptRes.text();
                header = extractValue(scriptText);
                if (header) return header;
            } catch (e) {
                // Ignore fetch errors for individual scripts
            }
        }

        throw new Error("CORS header (mobileTestingHeader) not found anywhere on the website");
    }

    async generate(length) {
        if (typeof length !== 'number' || length <= 0) {
            throw new Error("Parameter 'length' is required and must be a positive number.");
        }

        const spoofedIp = this._generateRandomIP();
        const corsHeader = await this._getCorsHeader(spoofedIp);
        const body = JSON.stringify({ min_name_length: length, max_name_length: length });

        return new Promise((resolve, reject) => {
            const options = {
                hostname: 'api.internal.temp-mail.io',
                path: '/api/v3/email/new',
                method: 'POST',
                headers: {
                    'User-Agent': USER_AGENTS[this.uaIndex],
                    'Content-Type': 'application/json',
                    'Application-Name': 'web',
                    'Application-Version': '4.0.0',
                    'X-CORS-Header': corsHeader,
                    'Content-Length': Buffer.byteLength(body),
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
                res.on('data', (chunk) => { raw += chunk; });
                res.on('end', () => {
                    try {
                        resolve(JSON.parse(raw));
                    } catch (e) {
                        reject(new Error(`Failed to parse generate response: ${e.message}`));
                    }
                });
            });

            req.on('error', reject);
            req.write(body);
            req.end();
        });
    }

    async inbox(email) {
        if (!email || typeof email !== 'string') {
            throw new Error("Parameter 'email' is required and must be a string.");
        }

        const spoofedIp = this._generateRandomIP();
        const corsHeader = await this._getCorsHeader(spoofedIp);

        return new Promise((resolve, reject) => {
            const options = {
                hostname: 'api.internal.temp-mail.io',
                path: `/api/v3/email/${encodeURIComponent(email)}/messages`,
                method: 'GET',
                headers: {
                    'User-Agent': USER_AGENTS[this.uaIndex],
                    'Content-Type': 'application/json',
                    'Application-Name': 'web',
                    'Application-Version': '4.0.0',
                    'X-CORS-Header': corsHeader,
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
                res.on('data', (chunk) => { raw += chunk; });
                res.on('end', () => {
                    try {
                        resolve(JSON.parse(raw));
                    } catch (e) {
                        reject(new Error(`Failed to parse inbox response: ${e.message}`));
                    }
                });
            });

            req.on('error', reject);
            req.end();
        });
    }
}

const toolDefinition = {
    name: 'tempmail_tools',
    description: 'Internal Tempmail tool for generating temp emails and checking inbox from temp-mail.io.',
    inputSchema: {
        type: 'object',
        properties: {
            action: {
                type: 'string',
                enum: ['generate', 'inbox'],
                description: 'The action to perform: generate or inbox',
            },
            length: {
                type: 'number',
                description: 'Required for generate action: length of the generated email prefix (e.g. 10).',
            },
            email: {
                type: 'string',
                description: 'Required for inbox action: the full email address to check',
            }
        },
        required: ['action'],
    },
};

async function handler(args) {
    const { action, length, email } = args;
    const tempmail = new Tempmail();
    try {
        let result;
        if (action === 'generate') {
            if (length === undefined || length === null) {
                throw new Error("Parameter 'length' is required for action 'generate'.");
            }
            result = await tempmail.generate(length);
        } else if (action === 'inbox') {
            if (!email) {
                throw new Error("Parameter 'email' is required for action 'inbox'.");
            }
            result = await tempmail.inbox(email);
        } else {
            throw new Error(`Unknown action: ${action}`);
        }
        
        return {
            content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
    } catch (error) {
        return {
            content: [{ type: 'text', text: JSON.stringify({ error: error.message, isError: true }, null, 2) }],
            isError: false,
        };
    }
}

module.exports = { Tempmail, toolDefinition, handler };
