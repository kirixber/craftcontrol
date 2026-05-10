const { SlashCommandBuilder } = require('discord.js');
const { getVoiceConnection } = require('@discordjs/voice');

module.exports = {
  name: 'stop',
  aliases: ['leave', 'dc'],
  description: 'Stop playing and disconnect from voice channel',
  data: new SlashCommandBuilder()
    .setName('stop')
    .setDescription('Stop playing and disconnect from voice channel'),

  async execute(context) {
    const isInteraction = context.isChatInputCommand?.();
    if (isInteraction) await context.deferReply();

    const connection = getVoiceConnection(context.guild.id);
    if (!connection) {
      const msg = '❌ I\'m not in a voice channel.';
      return isInteraction ? context.editReply(msg) : context.reply(msg);
    }

    // Clear loop state if looping
    try {
      const { loopState } = require('./loop');
      if (loopState.has(context.guild.id)) {
        loopState.get(context.guild.id).player.stop();
        loopState.delete(context.guild.id);
      }
    } catch { /* loop.js not loaded yet, fine */ }

    try { connection.destroy(); } catch { }
    
    const msg = '👋 Stopped and left the voice channel.';
    return isInteraction ? context.editReply(msg) : context.reply(msg);
  }
};
