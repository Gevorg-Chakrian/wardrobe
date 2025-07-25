const { OpenAI } = require('openai');
require('dotenv').config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

exports.extractClothingItem = async (req, res) => {
  const { imageUrl, itemType } = req.body;

  if (!imageUrl || !itemType) {
    return res.status(400).json({ message: 'Missing imageUrl or itemType' });
  }

  try {
    // Example DALL·E 3 prompt
    const prompt = `Extract only the ${itemType} from the image at this URL: ${imageUrl}. Show it on a white or transparent background.`;

    // DALL·E image generation (placeholder text-based, no image input supported directly here)
    const response = await openai.images.generate({
      prompt,
      n: 1,
      size: "512x512"
    });

    const resultUrl = response.data[0].url;
    res.status(200).json({ message: 'Clothing item generated', imageUrl: resultUrl });

  } catch (error) {
    console.error('OpenAI Error:', error.message);
    res.status(500).json({ message: 'Failed to extract clothing item', error: error.message });
  }
};
