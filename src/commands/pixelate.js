const { AttachmentBuilder } = require('discord.js');
const Jimp = require('jimp');

const BLOCK_SIZE = 4; // each "pixel" becomes a 16x16 block
const MAX_OUTPUT = 512; // max output dimension

module.exports = {
  name: 'pixelate',
  aliases: ['pix', 'pixel'],
  description: 'Convert any image to a Minecraft-style pixelated version',

  async execute(message, args) {
    // Get image — from attachment or URL arg
    let imageUrl = null;

    if (message.attachments.size > 0) {
      const attachment = message.attachments.first();
      if (!attachment.contentType?.startsWith('image/')) {
        return message.reply('❌ Please attach a valid image (JPG/PNG).');
      }
      imageUrl = attachment.url;
    } else if (args[0]) {
      imageUrl = args[0];
    } else {
      return message.reply('❌ Usage:\n`*pix <image url>` — pixelate from URL\nor attach an image with the command.');
    }

    const processing = await message.channel.send('🎨 Pixelating your image...');

    try {
      const img = await Jimp.read(imageUrl);

      // Figure out pixel grid size — we want roughly 32x32 "blocks"
      const PIXELS = 256;
      const w = img.getWidth();
      const h = img.getHeight();
      const aspect = w / h;

      let gridW, gridH;
      if (aspect >= 1) {
        gridW = PIXELS;
        gridH = Math.round(PIXELS / aspect);
      } else {
        gridH = PIXELS;
        gridW = Math.round(PIXELS * aspect);
      }

      // Step 1: Downscale to tiny pixel grid (creates pixelation)
      img.resize(gridW, gridH, Jimp.RESIZE_NEAREST_NEIGHBOR);

      // Step 2: Upscale back with nearest-neighbor (keeps blocky look)
      const outW = gridW * BLOCK_SIZE;
      const outH = gridH * BLOCK_SIZE;
      img.resize(outW, outH, Jimp.RESIZE_NEAREST_NEIGHBOR);

      // Optional: apply slight posterization for that MC color palette feel
      img.posterize(8);

      const buffer = await img.getBufferAsync(Jimp.MIME_PNG);
      const attachment = new AttachmentBuilder(buffer, { name: 'pixelated.png' });

      await processing.delete();
      message.reply({
        content: '⛏️ Here\'s your Minecraft-style pixelated image!',
        files: [attachment]
      });

    } catch (err) {
      try { await processing.delete(); } catch {}
      console.error('Pixelate error:', err);
      if (err.message?.includes('Could not find MIME')) {
        return message.reply('❌ Couldn\'t read that image. Make sure it\'s a valid JPG or PNG URL.');
      }
      message.reply('⚠️ Something went wrong processing the image. Try again with a different image.');
    }
  }
};
