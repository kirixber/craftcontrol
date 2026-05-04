const { EmbedBuilder } = require('discord.js');
const { CATEGORIES } = require('./play');

module.exports = {
  name: 'sounds',
  aliases: ['sl', 'soundlist'],
  description: 'List all available Minecraft sounds',

  async execute(message) {
    const embed = new EmbedBuilder()
      .setTitle('🎮 Available Minecraft Sounds')
      .setColor(0x5865F2)
      .setFooter({ text: 'Use *play <sound> to play • *p for short' });

    for (const [category, list] of Object.entries(CATEGORIES)) {
      embed.addFields({
        name: category,
        value: list.map(s => `\`${s}\``).join(', ')
      });
    }

    message.channel.send({ embeds: [embed] });
  }
};
