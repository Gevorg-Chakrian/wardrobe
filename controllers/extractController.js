const { OpenAI } = require('openai');
const fetch = require('node-fetch');

require('dotenv').config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * POST /api/extract
 * Body: { imageUrl: string, itemType: string }
 * Returns: { imageUrl: "data:image/png;base64,..." }
 *
 * Notes:
 * - We download the source image, send it to OpenAI "gpt-image-1" in EDIT mode with your detailed prompt.
 * - We return a data URL (PNG). This works in React Native <Image/> out of the box.
 * - If you prefer to get a CDN URL, upload the base64 to S3/Cloudinary and return that instead.
 */
exports.extractClothingItem = async (req, res) => {
  try {
    const { imageUrl, itemType } = req.body || {};
    if (!imageUrl || !itemType) {
      return res.status(400).json({ message: 'Missing imageUrl or itemType' });
    }

    // 1) Download the source image to a Buffer (Render/Node can’t pass remote URLs directly as files)
    const imgResp = await fetch(imageUrl);
    if (!imgResp.ok) {
      return res.status(400).json({ message: 'Could not fetch source image', status: imgResp.status });
    }
    const imgArrayBuffer = await imgResp.arrayBuffer();
    const imgBuffer = Buffer.from(imgArrayBuffer);

    // 2) Build your detailed prompt (your text, dynamically inserting the item type)
    const prompt = [
      `Extract only the ${itemType} from the provided image, completely removing the background, person, and any accessories.`,
      `Place the ${itemType} on a clean, uniform white background without harsh reflections.`,
      `Ensure realistic studio lighting with soft natural depth.`,
      `Center the ${itemType} in the frame; crop so it fills most of the image without cutting off details.`,
      `Make the ${itemType} look smooth and wrinkle-free (as if freshly ironed).`,
      `Preserve the original colors, textures, patterns, and proportions.`,
      `The final image should look like a high-quality studio photo for an online wardrobe catalog,`,
      `with clear edges and soft, subtle shadows. Output on a white background.`,
    ].join(' ');

    // 3) Call OpenAI Images EDIT API with the source image
    //    We request base64 to avoid hosting; React Native can render a data URI directly.
    const editResponse = await openai.images.edits({
      model: 'gpt-image-1',
      // Pass the image as a buffer; OpenAI SDK accepts a file-like object or raw buffer here
      image: [
        {
          // name helps the API infer file type; we'll call it "input.png"
          name: 'input.png',
          // supply the binary buffer
          // The SDK will upload it as multipart/form-data
          // eslint-disable-next-line no-undef
          data: imgBuffer,
        },
      ],
      prompt,
      size: '1024x1024',
      // We want a clean studio white background; no special flag is required beyond prompt.
      // If you prefer transparent background, change prompt & ensure PNG transparency is requested.
      response_format: 'b64_json',
    });

    const b64 = editResponse?.data?.[0]?.b64_json;
    if (!b64) {
      return res.status(502).json({ message: 'OpenAI did not return an image' });
    }

    // 4) Build a data URI (works directly in RN <Image/>)
    const dataUrl = `data:image/png;base64,${b64}`;

    return res.status(200).json({
      message: 'Clothing item extracted',
      imageUrl: dataUrl,
    });
  } catch (error) {
    console.error('OpenAI Extraction Error:', error?.response?.data || error?.message || error);
    return res.status(500).json({
      message: 'Failed to extract clothing item',
      error: error?.response?.data || error?.message || 'Unknown server error',
    });
  }
};
