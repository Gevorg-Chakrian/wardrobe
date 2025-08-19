const path = require('path');
const os = require('os');
const fs = require('fs');
const axios = require('axios');
const { OpenAI } = require('openai');

require('dotenv').config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// tiny helper
function isHttpUrl(u) {
  try {
    const { protocol } = new URL(u);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

async function downloadToTemp(url) {
  const resp = await axios.get(url, { responseType: 'arraybuffer', timeout: 20000 });
  const ext =
    (resp.headers['content-type'] && resp.headers['content-type'].includes('png'))
      ? '.png'
      : '.jpg';
  const tmpFile = path.join(os.tmpdir(), `wardrobe_in_${Date.now()}${ext}`);
  fs.writeFileSync(tmpFile, resp.data);
  return tmpFile;
}

exports.extractClothingItem = async (req, res) => {
  const { imageUrl, itemType } = req.body || {};

  if (!imageUrl || !itemType) {
    return res.status(400).json({ message: 'Missing imageUrl or itemType' });
  }
  if (!isHttpUrl(imageUrl)) {
    return res.status(400).json({
      message: 'imageUrl must be a public http(s) URL (not a local path)',
      example: 'https://upload.wikimedia.org/wikipedia/commons/6/6e/Tshirtwhite.png',
    });
  }

  // Your detailed prompt (feel free to tweak wording)
  const prompt = `Extract only the ${itemType} from the provided image, completely removing the background, person, and any accessories. Place the ${itemType} on a clean, uniform white background without reflections. Ensure realistic studio lighting with soft, natural shadows. Center the ${itemType} and crop so it fills most of the frame without cutting edges. Make it look freshly ironed (neat, wrinkle-free). Preserve original colors, textures, patterns, and proportions. The final result should look like a high-quality studio product photo for an online wardrobe catalog.`;

  let tmpFile = null;
  try {
    // 1) Download the source image to a temp file
    tmpFile = await downloadToTemp(imageUrl);

    // 2) Send to OpenAI Images Edit endpoint
    //    (no mask provided—let the model do the background removal per prompt)
    const resp = await openai.images.edits({
      model: 'gpt-image-1',
      image: fs.createReadStream(tmpFile),
      prompt,
      size: '1024x1024',
      // You can also set: background: "transparent" — but many clients prefer white product shots
    });

    if (!resp?.data?.[0]?.b64_json) {
      console.error('OpenAI images.edits returned no b64_json:', resp);
      return res.status(502).json({ message: 'Image generation failed (no image returned)' });
    }

    // 3) Return a data URL (easy to display in RN <Image />)
    const b64 = resp.data[0].b64_json;
    const dataUrl = `data:image/png;base64,${b64}`;

    return res.status(200).json({
      message: 'Clothing item generated',
      imageUrl: dataUrl,
      meta: { source: 'openai:gpt-image-1', size: '1024x1024' },
    });
  } catch (err) {
    // Log as much as possible to Render logs
    const status = err?.response?.status;
    const text = err?.response?.statusText;
    const openaiErr = err?.response?.data;

    console.error('EXTRACT ERROR →', {
      message: err?.message,
      status,
      text,
      openaiErr,
      stack: err?.stack,
    });

    return res.status(500).json({
      message: 'Failed to extract clothing item',
      error: err?.message || 'unknown',
      status,
      details: openaiErr || null,
    });
  } finally {
    // Clean up temp file
    if (tmpFile) {
      fs.promises.unlink(tmpFile).catch(() => {});
    }
  }
};
