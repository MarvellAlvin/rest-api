// api/tools/wink-hd.js
const axios = require('axios');
const FormData = require('form-data');
const crypto = require('crypto');
const { CookieJar } = require('tough-cookie');
const { wrapper } = require('axios-cookiejar-support');
const { URL } = require('url');

const BASE_URL = 'https://wink.ai';
const STRATEGY_URL = 'https://strategy.app.meitudata.com';

const CLIENT_ID = '1189857605';
const VERSION = '5.1.2';
const COUNTRY_CODE = 'ID';
const CLIENT_LANGUAGE = 'en_US';
const CLIENT_TIMEZONE = 'Asia/Jakarta';

const TASK_TYPE = '12';
const CONTENT_TYPE = '1';
const EXT_VALUE = '2';

const UA =
  'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Mobile Safari/537.36';

function generateGNUM() {
  return crypto.randomUUID();
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function extToMime(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  if (['jpg', 'jpeg'].includes(ext)) return 'image/jpeg';
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  return 'application/octet-stream';
}

function fileSuffix(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  if (ext === 'jpeg') return '.jpg';
  if (ext) return `.${ext}`;
  return '.jpg';
}

function makeTrace() {
  return `${crypto.randomBytes(16).toString('hex')}-${crypto.randomBytes(8).toString('hex')}-1`;
}

function traceHeaders(transaction = 'GET%20%2F%5Blocale%5D%2Fimage-enhancer%2Fupload') {
  const trace = makeTrace();
  return {
    'sentry-trace': trace,
    baggage: [
      'sentry-environment=release',
      'sentry-release=5.1.2%20(b60d25c477f43c6dfac4107810f26d442320f4f1)',
      'sentry-public_key=e1bf914f3448d9bc8a10c7e499d17d54',
      `sentry-trace_id=${trace.split('-')[0]}`,
      `sentry-transaction=${transaction}`,
      'sentry-sampled=true',
      'sentry-sample_rate=0.75'
    ].join(',')
  };
}

function baseParams(extra = {}) {
  return new URLSearchParams({
    client_id: CLIENT_ID,
    version: VERSION,
    country_code: COUNTRY_CODE,
    gnum: globalThis._gnum || generateGNUM(),
    client_language: CLIENT_LANGUAGE,
    client_channel_id: '',
    client_timezone: CLIENT_TIMEZONE,
    ...extra
  });
}

/**
 * Buat instance axios dengan cookie jar
 */
function createApiInstance(gnum) {
  const jar = new CookieJar();
  jar.setCookieSync(`_sm=${gnum}; Path=/; Domain=wink.ai`, BASE_URL);
  jar.setCookieSync(
    `meitustat=${encodeURIComponent(JSON.stringify({ wgid: gnum }))}; Path=/; Domain=wink.ai`,
    BASE_URL
  );

  const instance = wrapper(
    axios.create({
      baseURL: BASE_URL,
      jar,
      withCredentials: true,
      validateStatus: () => true,
      headers: {
        accept: '*/*',
        origin: BASE_URL,
        referer: `${BASE_URL}/image-enhancer/upload`,
        'user-agent': UA,
        'sec-ch-ua': '"Google Chrome";v="147", "Not.A/Brand";v="8", "Chromium";v="147"',
        'sec-ch-ua-mobile': '?1',
        'sec-ch-ua-platform': '"Android"',
        ab_info: JSON.stringify({
          ab_codes: [],
          version: '1.4.4'
        })
      }
    })
  );

  return instance;
}

async function enhanceImage(imageUrl) {
  // Generate unique ID untuk session
  const gnum = generateGNUM();
  globalThis._gnum = gnum;
  const api = createApiInstance(gnum);

  // 1. Download gambar dari URL
  const imageResponse = await axios.get(imageUrl, {
    responseType: 'arraybuffer',
    headers: {
      'User-Agent': UA
    }
  });
  const imageBuffer = Buffer.from(imageResponse.data);

  // Ekstrak nama file dari URL
  const urlObj = new URL(imageUrl);
  let filename = path.basename(urlObj.pathname);
  if (!filename || !filename.includes('.')) {
    const contentType = imageResponse.headers['content-type'];
    const ext = contentType.split('/')[1] || 'jpg';
    filename = `image.${ext}`;
  }
  if (!filename.includes('.')) {
    filename += '.jpg';
  }

  // 2. Dapatkan sign
  const signRes = await api.get(
    `/api/file/get_maat_sign.json?${baseParams({
      suffix: fileSuffix(filename),
      type: 'temp',
      count: '1'
    }).toString()}`,
    { headers: traceHeaders() }
  );
  if (signRes.status >= 400 || signRes.data?.code !== 0) {
    throw new Error(`get_maat_sign gagal: ${JSON.stringify(signRes.data)}`);
  }
  const sign = signRes.data.data;

  // 3. Dapatkan upload policy
  const policyParams = new URLSearchParams({
    app: sign.app,
    count: String(sign.count),
    sig: sign.sig,
    sigTime: sign.sig_time,
    sigVersion: sign.sig_version,
    suffix: sign.suffix,
    type: sign.type
  });
  const policyRes = await axios.get(
    `${STRATEGY_URL}/upload/policy?${policyParams.toString()}`,
    {
      headers: {
        accept: '*/*',
        origin: BASE_URL,
        referer: `${BASE_URL}/`,
        'user-agent': UA,
        'sec-ch-ua': '"Google Chrome";v="147", "Not.A/Brand";v="8", "Chromium";v="147"',
        'sec-ch-ua-mobile': '?1',
        'sec-ch-ua-platform': '"Android"'
      },
      validateStatus: () => true
    }
  );
  if (
    policyRes.status >= 400 ||
    !Array.isArray(policyRes.data) ||
    !policyRes.data[0]?.qiniu
  ) {
    throw new Error(`upload policy gagal: ${JSON.stringify(policyRes.data)}`);
  }
  const policy = policyRes.data[0].qiniu;

  // 4. Upload ke Qiniu (dari buffer)
  const form = new FormData();
  form.append('file', imageBuffer, {
    filename: filename,
    contentType: extToMime(filename)
  });
  form.append('token', policy.token);
  form.append('key', policy.key);
  form.append('fname', filename);

  const uploadRes = await axios.post(policy.url, form, {
    headers: form.getHeaders({
      origin: BASE_URL,
      referer: `${BASE_URL}/`,
      'user-agent': UA,
      accept: '*/*'
    }),
    maxBodyLength: Infinity,
    maxContentLength: Infinity,
    validateStatus: () => true
  });
  if (uploadRes.status >= 400) {
    throw new Error(
      `upload qiniu gagal HTTP ${uploadRes.status}: ${typeof uploadRes.data === 'string' ? uploadRes.data : JSON.stringify(uploadRes.data)}`
    );
  }
  if (!uploadRes.data?.url && !uploadRes.data?.data) {
    throw new Error(`upload qiniu response tidak valid: ${JSON.stringify(uploadRes.data)}`);
  }
  const fileKey = policy.key;
  const sourceUrl = uploadRes.data.url || uploadRes.data.data || policy.data;

  // 5. Meta info
  const metaRes = await api.post(
    `/api/file/meta_info.json`,
    baseParams({ file_key: fileKey }).toString(),
    {
      headers: {
        ...traceHeaders(),
        'content-type': 'application/x-www-form-urlencoded;charset=UTF-8'
      }
    }
  );
  if (metaRes.status >= 400 || metaRes.data?.code !== 0) {
    throw new Error(`meta info gagal: ${JSON.stringify(metaRes.data)}`);
  }

  // 6. Calc beans
  const typeParams = JSON.stringify({
    is_mirror: 0,
    orientation_tag: 1,
    j_420_trans: '1',
    return_ext: '2'
  });
  const rightDetail = JSON.stringify({
    source: '1',
    touch_type: '4',
    function_id: '630',
    material_id: '63011',
    url: 'https://wink.ai/image-enhancer/upload'
  });
  const itemList = JSON.stringify([
    {
      type: Number(TASK_TYPE),
      ext_value: EXT_VALUE,
      content_type: Number(CONTENT_TYPE),
      duration: 0,
      type_params: typeParams,
      right_detail: rightDetail
    }
  ]);
  const calcRes = await api.post(
    `/api/subscribe/batch_calc_need_beans.json`,
    baseParams({ item_list: itemList }).toString(),
    {
      headers: {
        ...traceHeaders(),
        'content-type': 'application/x-www-form-urlencoded;charset=UTF-8'
      }
    }
  );
  if (calcRes.status >= 400 || calcRes.data?.code !== 0) {
    throw new Error(`calc beans gagal: ${JSON.stringify(calcRes.data)}`);
  }

  // 7. Delivery
  const taskName = `Enhancer-Ultra HD-${filename}`;
  const deliveryBody = baseParams({
    type: TASK_TYPE,
    content_type: CONTENT_TYPE,
    source_url: sourceUrl,
    type_params: typeParams,
    right_detail: rightDetail,
    ext_params: JSON.stringify({
      task_name: taskName,
      records: TASK_TYPE
    }),
    with_prepare: '1'
  });
  const deliveryRes = await api.post(
    `/api/meitu_ai/delivery.json`,
    deliveryBody.toString(),
    {
      headers: {
        ...traceHeaders(),
        'content-type': 'application/x-www-form-urlencoded;charset=UTF-8'
      }
    }
  );
  if (deliveryRes.status >= 400 || deliveryRes.data?.code !== 0) {
    throw new Error(`delivery gagal: ${JSON.stringify(deliveryRes.data)}`);
  }
  const taskData = deliveryRes.data.data || {};
  const firstMsgId = taskData.msg_id || taskData.prepare_msg_id;
  if (!firstMsgId) {
    throw new Error(`delivery tidak mengembalikan msg_id: ${JSON.stringify(taskData)}`);
  }

  // 8. Polling hasil
  let msgId = firstMsgId;
  let lastData = null;
  const maxTry = 80;
  const delayMs = 3000;

  for (let i = 1; i <= maxTry; i++) {
    const queryParams = baseParams({ msg_ids: msgId });
    const queryRes = await api.get(
      `/api/meitu_ai/query_batch.json?${queryParams.toString()}`,
      {
        headers: {
          ...traceHeaders('%2F%3Alocale%2Feditor%2Frecent-task'),
          referer: `${BASE_URL}/image-enhancer/upload`
        }
      }
    );
    if (queryRes.status >= 400 || queryRes.data?.code !== 0) {
      throw new Error(`query batch gagal: ${JSON.stringify(queryRes.data)}`);
    }
    const data = queryRes.data.data;
    lastData = data;

    // Cari next msg id
    const item = data?.item_list?.[0];
    const resultValue = item?.result?.result || '';
    const realMsgId = item?.result?.msg_id || item?.msg_id || '';
    let nextMsgId = '';
    if (
      resultValue &&
      resultValue !== msgId &&
      !resultValue.startsWith('http') &&
      !resultValue.startsWith('https')
    ) {
      nextMsgId = resultValue;
    } else if (
      realMsgId &&
      realMsgId !== msgId &&
      !realMsgId.startsWith('wpr_')
    ) {
      nextMsgId = realMsgId;
    }

    if (nextMsgId) {
      msgId = nextMsgId;
      await sleep(1000);
      continue;
    }

    // Cek hasil URL
    const media = item?.result?.media_info_list?.[0];
    const resultUrl = media?.media_data || '';
    const errorCode = item?.result?.error_code;
    const errorMsg = item?.result?.error_msg;

    if (resultUrl && resultUrl.startsWith('http') && errorCode === 0) {
      return resultUrl;
    }

    if (errorCode && errorCode !== 29901 && errorCode !== 0) {
      throw new Error(`task gagal: ${errorCode} ${errorMsg || ''}`);
    }

    await sleep(delayMs);
  }

  throw new Error(`result belum selesai: ${JSON.stringify(lastData)}`);
}

// ===== ROUTE HANDLER EXPRESS =====
module.exports = async (req, res) => {
  const startTime = Date.now();

  const { url } = req.method === 'GET' ? req.query : req.body;

  if (!url) {
    return res.status(400).json({
      status: false,
      statusCode: 400,
      author: '@velz',
      error: 'Parameter "url" (URL gambar) wajib diisi.',
      responseTimeMs: Date.now() - startTime,
      timestamp: new Date().toISOString()
    });
  }

  try {
    // Validasi URL
    new URL(url); // cek valid

    // Proses enhance
    const resultUrl = await enhanceImage(url);

    const response = {
      status: true,
      statusCode: 200,
      author: '@velz',
      result: {
        originalUrl: url,
        enhancedUrl: resultUrl
      },
      responseTimeMs: Date.now() - startTime,
      timestamp: new Date().toISOString()
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('[Wink-HD] Error:', error.message);
    res.status(500).json({
      status: false,
      statusCode: 500,
      author: '@velz',
      error: error.message || 'Gagal meningkatkan kualitas gambar.',
      responseTimeMs: Date.now() - startTime,
      timestamp: new Date().toISOString()
    });
  }
};
