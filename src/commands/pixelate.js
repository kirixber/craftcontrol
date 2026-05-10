const { AttachmentBuilder, SlashCommandBuilder } = require('discord.js');
const Jimp = require('jimp');

const BLOCK_SIZE = 4; // each "pixel" becomes a 16x16 block
const MAX_OUTPUT = 512; // max output dimension

module.exports = {
  name: 'pixelate',
  aliases: ['pix', 'pixel'],
  description: 'Convert any image to a Minecraft-style pixelated version',
  data: new SlashCommandBuilder()
    .setName('pixelate')
    .setDescription('Convert any image to a Minecraft-style pixelated version')
    .addAttachmentOption(option =>
      option.setName('image')
        .setDescription('The image to pixelate')
        .setRequired(false))
    .addStringOption(option =>
      option.setName('url')
        .setDescription('The URL of the image to pixelate')
        .setRequired(false)),

  async execute(context, args) {
    const isInteraction = !!context.isChatInputCommand?.();
    let imageUrl = null;

    if (isInteraction) {
      const attachment = context.options.getAttachment('image');
      const url = context.options.getString('url');

      if (attachment) {
        if (!attachment.contentType?.startsWith('image/')) {
          return context.reply({ content: '❌ Please attach a valid image (JPG/PNG).', ephemeral: true });
        }
        imageUrl = attachment.url;
      } else if (url) {
        imageUrl = url;
      } else {
        return context.reply({ content: '❌ Please provide an image attachment or a URL.', ephemeral: true });
      }
      await context.deferReply();
    } else {
      // Get image — from attachment or URL arg
      if (context.attachments.size > 0) {
        const attachment = context.attachments.first();
        if (!attachment.contentType?.startsWith('image/')) {
          return context.reply('❌ Please attach a valid image (JPG/PNG).');
        }
        imageUrl = attachment.url;
      } else if (args[0]) {
        imageUrl = args[0];
      } else {
        return context.reply('❌ Usage:\n`*pix <image url>` — pixelate from URL\nor attach an image with the command.');
      }
    }

    let processing;
    if (!isInteraction) {
      processing = await context.channel.send('🎨 Pixelating your image...');
    }

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
      const outAttachment = new AttachmentBuilder(buffer, { name: 'pixelated.png' });

      if (isInteraction) {
        await context.editReply({
          content: '⛏️ Here\'s your Minecraft-style pixelated image!',
          files: [outAttachment]
        });
      } else {
        await processing.delete();
        context.reply({
          content: '⛏️ Here\'s your Minecraft-style pixelated image!',
          files: [outAttachment]
        });
      }

    } catch (err) {
      if (!isInteraction && processing) {
        try { await processing.delete(); } catch {}
      }
      console.error('Pixelate error:', err);
      const errorMsg = err.message?.includes('Could not find MIME') 
        ? '❌ Couldn\'t read that image. Make sure it\'s a valid JPG or PNG URL.'
        : '⚠️ Something went wrong processing the image. Try again with a different image.';
      
      if (isInteraction) {
        if (context.deferred) await context.editReply(errorMsg);
        else await context.reply({ content: errorMsg, ephemeral: true });
      } else {
        context.reply(errorMsg);
      }
    }
  }
};
