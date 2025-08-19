// controllers/extractController.js
const { OpenAI } = require('openai');
const axios = require('axios');
const fs = require('fs');
const os = require('os');
const path = require('path');

require('dotenv').config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/** Robust HTTP download to a temp file */
async function downloadToTemp(imageUrl) {
  const tmp = path.join(os.tmpdir(), `in_${Date.now()}_${Math.random().toString(36).slice(2)}.bin`);
  const resp = await axios.get(imageUrl, {
    responseType: 'arraybuffer',
    maxRedirects: 10,
    // Some hosts (e.g. Wikimedia) require a UA
    headers: {
      'User-Agent': 'WardrobeApp/1.0 (+https://example.com)',
      'Accept': 'image/*,*/*;q=0.8',
    },
    validateStatus: (s) => s >= 200 && s < 400, // allow redirects
  }).catch((err) => {
    // Surface more detail
    const data = err?.response?.data;
    const text = Buffer.isBuffer(data) ? data.toString('utf8').slice(0, 500) : String(data || '');
    throw Object.assign(new Error(`Download failed (${err?.response?.status || 'no status'}) from ${imageUrl}`), {
      status: err?.response?.status,
      text,
    });
  });

  fs.writeFileSync(tmp, resp.data);
  return tmp;
}

exports.extractClothingItem = async (req, res) => {
  const { imageUrl, itemType } = req.body;

  if (!imageUrl || !itemType) {
    return res.status(400).json({ message: 'Missing imageUrl or itemType' });
  }

  try {
    // 1) Download input (with robust headers/redirects)
    const inputPath = await downloadToTemp(imageUrl);

    // 2) Build your prompt (you can tweak this copy)
    const prompt = `
Extract only the ${itemType} from the provided image, removing background, person, and accessories.
Place it on a clean white background with soft, realistic studio shadows.
Center and crop so it fills most of the frame (no cut-offs). Smooth wrinkles; preserve original colors, textures, and proportions.
Output a high-quality catalog-style photo.
`.trim();

    // 3) Call OpenAI Images API (edits with image input)
    //    NOTE: This expects you’ve enabled the Images API in your OpenAI account.
    const result = await openai.images.edits({
      // Use a capable image model here (e.g., "gpt-image-1")
      model: 'gpt-image-1',
      prompt,
      // send the downloaded file
      image: fs.createReadStream(inputPath),
      size: '1024x1024',
      // You can request PNG for clean background; JPG also OK
      // background: "white" // optional if supported in your tier
    });

    // 4) Return the generated image URL
    const out = result?.data?.[0];
    if (!out?.url) {
      throw new Error('OpenAI response missing image URL');
    }
    return res.status(200).json({ imageUrl: out.url });

  } catch (error) {
    console.error('EXTRACT ERROR →', {
      message: error?.message,
      status: error?.status,
      text: error?.text,
      stack: error?.stack,
    });
    return res.status(500).json({ message: 'Failed to extract clothing item', error: error?.message, status: error?.status, text: error?.text });
  }
};
