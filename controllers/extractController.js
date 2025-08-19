// controllers/extractController.js
const { OpenAI } = require('openai');
const axios = require('axios');
const fs = require('fs');
const os = require('os');
const path = require('path');

require('dotenv').config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const DEBUG = String(process.env.DEBUG_EXTRACT || '').toLowerCase() === '1';

function log(...args) {
  // Always log to Render logs
  console.log('[extract]', ...args);
}

async function downloadToTemp(imageUrl) {
  const tmpPath = path.join(
    os.tmpdir(),
    `in_${Date.now()}_${Math.random().toString(36).slice(2)}.bin`
  );
  log('download:start', imageUrl);

  try {
    const resp = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      maxRedirects: 10,
      headers: {
        'User-Agent': 'WardrobeApp/1.0 (+https://example.com)',
        'Accept': 'image/*,*/*;q=0.8',
      },
      validateStatus: (s) => s >= 200 && s < 400, // allow 3xx redirects
    });

    fs.writeFileSync(tmpPath, resp.data);
    log('download:ok', tmpPath, `(bytes=${resp.data?.length || 0})`);
    return tmpPath;
  } catch (err) {
    const status = err?.response?.status;
    const data = err?.response?.data;
    const text = Buffer.isBuffer(data) ? data.toString('utf8').slice(0, 600) : String(data || '');
    const message = `Download failed (${status || 'no status'})`;
    log('download:fail', message, imageUrl, text);
    const e = new Error(message);
    e.status = status;
    e.text = text;
    throw e;
  }
}

exports.extractClothingItem = async (req, res) => {
  const { imageUrl, itemType } = req.body || {};
  const phase = { step: 'validate' };

  try {
    if (!imageUrl || !itemType) {
      return res.status(400).json({ message: 'Missing imageUrl or itemType' });
    }
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ message: 'OPENAI_API_KEY is not set on the server' });
    }

    phase.step = 'download';
    const inputPath = await downloadToTemp(imageUrl);

    phase.step = 'prompt';
    const prompt = `
Extract only the ${itemType} from the provided image, removing background, person, and accessories.
Place it on a clean white background with soft, realistic studio shadows.
Center and crop so it fills most of the frame (no cut-offs). Smooth wrinkles; preserve original colors, textures, and proportions.
Output a high-quality catalog-style photo.
`.trim();

    phase.step = 'openai';
    log('openai:edits call', { model: 'gpt-image-1', size: '1024x1024' });

    const result = await openai.images.edits({
      model: 'gpt-image-1',
      prompt,
      image: fs.createReadStream(inputPath),
      size: '1024x1024',
    });

    const out = result?.data?.[0];
    if (!out?.url) {
      log('openai:bad-response', result);
      throw new Error('OpenAI response missing image URL');
    }

    phase.step = 'done';
    log('openai:ok', out.url);
    return res.status(200).json({ imageUrl: out.url, model: 'gpt-image-1' });

  } catch (error) {
    const payload = {
      message: error?.message || 'Failed to extract clothing item',
      step: phase.step,
      status: error?.status,
      text: error?.text,
    };
    // Always log
    console.error('EXTRACT ERROR →', payload);

    // Echo details only if DEBUG_EXTRACT=1 (for your testing)
    return res.status(500).json(
      DEBUG ? payload : { message: 'Failed to extract clothing item' }
    );
  }
};
