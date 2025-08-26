// controllers/extractController.js
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const os = require('os');
const path = require('path');

require('dotenv').config();

const DEBUG = String(process.env.DEBUG_EXTRACT || '').toLowerCase() === '1';
function log(...args) { console.log('[extract]', ...args); }

//async function downloadToTemp(imageUrl) {
//  const tmpPath = path.join(os.tmpdir(), `in_${Date.now()}_${Math.random().toString(36).slice(2)}.bin`);
//  log('download:start', imageUrl);
//
//  try {
//    const resp = await axios.get(imageUrl, {
//      responseType: 'arraybuffer',
//      maxRedirects: 10,
//      headers: {
//        'User-Agent': 'WardrobeApp/1.0',
//        Accept: 'image/*,*/*;q=0.8',
//      },
//      validateStatus: s => s >= 200 && s < 400,
//    });
//
//    fs.writeFileSync(tmpPath, resp.data);
//    log('download:ok', tmpPath, `(bytes=${resp.data?.length || 0})`);
//    return tmpPath;
//  } catch (err) {
//    const status = err?.response?.status;
//    const data = err?.response?.data;
//    const text = Buffer.isBuffer(data) ? data.toString('utf8').slice(0, 600) : String(data || '');
//    const e = new Error(`Download failed (${status || 'no status'})`);
//    e.status = status;
//    e.text = text;
//    log('download:fail', e.message, imageUrl, text);
//    throw e;
//  }
//}

//exports.extractClothingItem = async (req, res) => {
//  const { imageUrl, itemType } = req.body || {};
//  const phase = { step: 'validate' };
//
//  try {
//    if (!imageUrl || !itemType) {
//      return res.status(400).json({ message: 'Missing imageUrl or itemType' });
//    }
//    if (!process.env.OPENAI_API_KEY) {
//      return res.status(500).json({ message: 'OPENAI_API_KEY is not set on the server' });
//    }
//
//    // 1) Download
//    phase.step = 'download';
//    const inputPath = await downloadToTemp(imageUrl);
//
//    // 2) Build prompt
//    phase.step = 'prompt';
//    const prompt = `
//Extract only the ${itemType} from the provided image, completely removing the background, person, and any accessories.
//Place the ${itemType} on a clean, uniform white background with realistic studio lighting and soft shadows.
//Center it so it occupies most of the frame without cutting off edges. Smooth wrinkles; preserve original colors, textures, patterns, and proportions.
//Output a high-quality catalog-style photo.
//`.trim();
//
//    // 3) Call OpenAI Images Edits (REST)
//    phase.step = 'openai';
//    log('openai:images/edits', { model: 'gpt-image-1', size: '1024x1024' });
//
//    const form = new FormData();
//    form.append('model', 'gpt-image-1');
//    form.append('prompt', prompt);
//    form.append('image', fs.createReadStream(inputPath)); // the uploaded image
//    form.append('size', '1024x1024');                     // optional: 256x256, 512x512, 1024x1024
//    // form.append('background', 'white'); // (not officially documented for gpt-image-1—prompt handles it)
//
//    const resp = await axios.post('https://api.openai.com/v1/images/edits', form, {
//      headers: {
//        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
//        ...form.getHeaders(),
//      },
//      timeout: 120000,
//      validateStatus: s => s >= 200 && s < 500, // let us read 4xx/5xx bodies
//    });
//
//    if (resp.status < 200 || resp.status >= 300) {
//      const text = JSON.stringify(resp.data).slice(0, 1000);
//      const e = new Error(`OpenAI error (${resp.status})`);
//      e.status = resp.status;
//      e.text = text;
//      log('openai:error', e.message, text);
//      throw e;
//    }
//
//    const out = resp.data?.data?.[0];
//    if (!out?.url && !out?.b64_json) {
//      log('openai:bad-response', resp.data);
//      throw new Error('OpenAI response missing image (url/b64_json)');
//    }
//
//    // Prefer URL (CDN). If only b64 is returned, you could upload to your storage and return that URL.
//    const resultUrl = out.url || null;
//    if (resultUrl) {
//      log('openai:ok:url', resultUrl);
//      return res.status(200).json({ imageUrl: resultUrl, model: 'gpt-image-1' });
//    }
//
//    // Fallback: return base64 (client would need to handle data URL)
//    log('openai:ok:b64');
//    return res.status(200).json({ imageB64: out.b64_json, model: 'gpt-image-1' });
//
//  } catch (error) {
//    const payload = {
//      message: error?.message || 'Failed to extract clothing item',
//      step: phase.step,
//      status: error?.status,
//      text: error?.text,
//    };
//    console.error('EXTRACT ERROR →', payload);
//    return res.status(500).json(DEBUG ? payload : { message: 'Failed to extract clothing item' });
//  }
//};


exports.extractClothingItem = async (req, res) => {
  try {
    const { imageUrl, itemType } = req.body || {};
    if (!imageUrl || !itemType) {
      return res.status(400).json({ message: 'Missing imageUrl or itemType' });
    }

    // Echo back the original image for now.
    // (When you’re ready to re-enable GPT, replace this with the real logic again.)
    return res.status(200).json({
      imageUrl,
      ok: true,
      stub: true,
      note: 'GPT disabled; returning original image',
    });
  } catch (e) {
    console.error('EXTRACT STUB ERROR →', e?.message || e);
    return res.status(500).json({ message: 'Failed to extract clothing item' });
  }
};
