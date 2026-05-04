const { getVoiceConnection } = require('@discordjs/voice');

module.exports = {
  name: 'stop',
  aliases: ['leave', 'dc'],
  description: 'Stop playing and disconnect from voice channel',

  async execute(message) {
    const connection = getVoiceConnection(message.guild.id);
    if (!connection)
      return message.reply('❌ I\'m not in a voice channel.');

    // Clear loop state if looping
    try {
      const { loopState } = require('./loop');
      if (loopState.has(message.guild.id)) {
        loopState.get(message.guild.id).player.stop();
        loopState.delete(message.guild.id);
      }
    } catch { /* loop.js not loaded yet, fine */ }

    try { connection.destroy(); } catch { }
    message.reply('👋 Stopped and left the voice channel.');
  }
};
