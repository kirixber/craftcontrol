const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { CATEGORIES } = require('./play');

module.exports = {
  name: 'sounds',
  aliases: ['sl', 'soundlist'],
  description: 'List all available Minecraft sounds',
  data: new SlashCommandBuilder()
    .setName('sounds')
    .setDescription('List all available Minecraft sounds'),

  async execute(context) {
    const isInteraction = context.isChatInputCommand?.();
    if (isInteraction) await context.deferReply();

    const embed = new EmbedBuilder()
      .setTitle('🎮 Available Minecraft Sounds')
      .setColor(0x5865F2)
      .setFooter({ text: 'Use *play <sound> or /play to play' });

    for (const [category, list] of Object.entries(CATEGORIES)) {
      embed.addFields({
        name: category,
        value: list.map(s => `\`${s}\``).join(', ')
      });
    }

    if (isInteraction) {
      return context.editReply({ embeds: [embed] });
    } else {
      return context.channel.send({ embeds: [embed] });
    }
  }
};
