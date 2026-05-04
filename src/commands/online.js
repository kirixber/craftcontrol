const { EmbedBuilder } = require('discord.js');
const { rconCommand } = require('../utils/rcon');
const { resolveServer } = require('../utils/resolveServer');

module.exports = {
  name: 'online',
  aliases: [],
  description: 'Shows who is currently online on the server',

  async execute(message, args) {
    const server = await resolveServer(message, args, 0);
    if (!server) return;

    if (!server.rcon_host || !server.rcon_password)
      return message.reply('❌ RCON is not configured for this server. Re-run `*setup` and provide RCON details.');

    const checking = await message.channel.send(`🔄 Fetching players on **${server.server_name}**...`);

    try {
      const response = await rconCommand(server, 'list');
      const match = response.match(/There are (\d+) of a max of (\d+) players online[:\.]?\s*(.*)/i);

      await checking.delete();

      if (!match) return message.channel.send('⚠️ Couldn\'t parse server response: `' + response + '`');

      const [, online, max, playerList] = match;
      const players = playerList.trim() ? playerList.trim().split(', ') : [];

      const embed = new EmbedBuilder()
        .setTitle(`👥 ${server.server_name} — Online Players`)
        .setColor(parseInt(online) > 0 ? 0x44ff88 : 0x888888)
        .setDescription(players.length > 0 ? players.map(p => `• \`${p}\``).join('\n') : '*No players online right now*')
        .setFooter({ text: `${online}/${max} players online` })
        .setTimestamp();

      message.channel.send({ embeds: [embed] });
    } catch (err) {
      await checking.delete();
      message.reply('⚠️ Could not connect via RCON. Make sure the server is online and RCON is enabled.');
    }
  }
};
