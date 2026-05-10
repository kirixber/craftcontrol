const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { rconCommand } = require('../utils/rcon');
const { resolveServer } = require('../utils/resolveServer');

module.exports = {
  name: 'online',
  aliases: [],
  description: 'Shows who is currently online on the server',
  data: new SlashCommandBuilder()
    .setName('online')
    .setDescription('Shows who is currently online on the server')
    .addStringOption(option =>
      option.setName('server')
        .setDescription('The server name (optional)')
        .setRequired(false)),

  async execute(context, args) {
    const isInteraction = !!context.isChatInputCommand?.();
    const finalArgs = isInteraction ? [context.options.getString('server')] : args;

    if (isInteraction) await context.deferReply();

    const server = await resolveServer(context, finalArgs, 0);
    if (!server) return;

    if (!server.rcon_host || !server.rcon_password) {
      const msg = '❌ RCON is not configured for this server. Re-run `*setup` and provide RCON details.';
      return isInteraction ? context.editReply(msg) : context.reply(msg);
    }

    let checking;
    if (!isInteraction) {
      checking = await context.channel.send(`🔄 Fetching players on **${server.server_name}**...`);
    }

    try {
      const response = await rconCommand(server, 'list');
      const match = response.match(/There are (\d+) of a max of (\d+) players online[:\.]?\s*(.*)/i);

      if (!match) {
        const errorMsg = '⚠️ Couldn\'t parse server response: `' + response + '`';
        if (isInteraction) return context.editReply(errorMsg);
        if (checking) await checking.delete();
        return context.channel.send(errorMsg);
      }

      const [, online, max, playerList] = match;
      const players = playerList.trim() ? playerList.trim().split(', ') : [];

      const embed = new EmbedBuilder()
        .setTitle(`👥 ${server.server_name} — Online Players`)
        .setColor(parseInt(online) > 0 ? 0x44ff88 : 0x888888)
        .setDescription(players.length > 0 ? players.map(p => `• \`${p}\``).join('\n') : '*No players online right now*')
        .setFooter({ text: `${online}/${max} players online` })
        .setTimestamp();

      if (isInteraction) {
        await context.editReply({ content: null, embeds: [embed] });
      } else {
        if (checking) await checking.delete();
        context.channel.send({ embeds: [embed] });
      }
    } catch (err) {
      const errorMsg = '⚠️ Could not connect via RCON. Make sure the server is online and RCON is enabled.';
      if (isInteraction) {
        await context.editReply(errorMsg);
      } else {
        if (checking) await checking.delete();
        context.reply(errorMsg);
      }
    }
  }
};
