const { SlashCommandBuilder } = require('discord.js');
const { rconCommand } = require('../../utils/rcon');
const { resolveServer } = require('../../utils/resolveServer');
const { canManageSMP } = require('../../utils/permissions');

module.exports = {
  name: 'kick',
  aliases: [],
  description: 'Kick a player (admin only)',
  data: new SlashCommandBuilder()
    .setName('kick')
    .setDescription('Kick a player (admin only)')
    .addStringOption(option => option.setName('player').setDescription('The player to kick').setRequired(true))
    .addStringOption(option => option.setName('reason').setDescription('The reason for the kick'))
    .addStringOption(option => option.setName('server').setDescription('The server to run the command on')),

  async execute(context, args) {
    const isInteraction = context.isChatInputCommand?.();
    if (isInteraction) await context.deferReply();

    const player = isInteraction ? context.options.getString('player') : args[0];
    const serverArg = isInteraction ? context.options.getString('server') : args.slice(-1)[0];
    
    if (!isInteraction && !player) {
      return context.reply('❌ Usage: `*kick <player> [reason] [server]`');
    }

    const server = await resolveServer(context, isInteraction ? (serverArg ? [serverArg] : []) : args.slice(-1), 0);
    if (!server) return;

    if (!await canManageSMP(context.member, server.server_name)) {
      const msg = '❌ You need SMP Manager permissions.';
      return isInteraction ? context.editReply(msg) : context.reply(msg);
    }

    if (!server.rcon_host) {
      const msg = '❌ RCON not configured for this server. Re-run `*setup`.';
      return isInteraction ? context.editReply(msg) : context.reply(msg);
    }

    let reason;
    if (isInteraction) {
      reason = context.options.getString('reason') || 'Kicked by admin';
    } else {
      reason = args.slice(1, -1).join(' ') || 'Kicked by admin';
    }

    try {
      const res = await rconCommand(server, `kick ${player} ${reason}`);
      const replyMsg = `✅ \`${res.replace(/§./g, '')}\``;
      return isInteraction ? context.editReply(replyMsg) : context.reply(replyMsg);
    } catch {
      const errorMsg = '⚠️ Could not connect to server via RCON.';
      return isInteraction ? context.editReply(errorMsg) : context.reply(errorMsg);
    }
  }
};
