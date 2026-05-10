const { SlashCommandBuilder } = require('discord.js');
const { rconCommand } = require('../../utils/rcon');
const { resolveServer } = require('../../utils/resolveServer');
const { canManageSMP } = require('../../utils/permissions');

module.exports = {
  name: 'unban',
  aliases: ['pardon'],
  description: 'Unban a player (admin only)',
  data: new SlashCommandBuilder()
    .setName('unban')
    .setDescription('Unban a player (admin only)')
    .addStringOption(option => option.setName('player').setDescription('The player to unban').setRequired(true))
    .addStringOption(option => option.setName('server').setDescription('The server to run the command on')),

  async execute(context, args) {
    const isInteraction = context.isChatInputCommand?.();
    if (isInteraction) await context.deferReply();

    const player = isInteraction ? context.options.getString('player') : args[0];
    const serverArg = isInteraction ? context.options.getString('server') : args[1];

    if (!isInteraction && !player)
      return context.reply('❌ Usage: `*unban <player> [server]`');

    const server = await resolveServer(context, isInteraction ? (serverArg ? [serverArg] : []) : (args[1] ? [args[1]] : []), 0);
    if (!server) return;

    if (!await canManageSMP(context.member, server.server_name)) {
      const msg = '❌ You need SMP Manager permissions.';
      return isInteraction ? context.editReply(msg) : context.reply(msg);
    }

    if (!server.rcon_host) {
      const msg = '❌ RCON not configured for this server. Re-run `*setup`.';
      return isInteraction ? context.editReply(msg) : context.reply(msg);
    }

    try {
      const res = await rconCommand(server, `pardon ${player}`);
      const replyMsg = `✅ \`${res.replace(/§./g, '')}\``;
      return isInteraction ? context.editReply(replyMsg) : context.reply(replyMsg);
    } catch {
      const errorMsg = '⚠️ Could not connect to server via RCON.';
      return isInteraction ? context.editReply(errorMsg) : context.reply(errorMsg);
    }
  }
};
