const { SlashCommandBuilder } = require('discord.js');
const { rconCommand } = require('../../utils/rcon');
const { resolveServer } = require('../../utils/resolveServer');
const { canManageSMP } = require('../../utils/permissions');

module.exports = {
  name: 'whitelist',
  aliases: ['wl'],
  description: 'Manage the server whitelist (admin only)',
  data: new SlashCommandBuilder()
    .setName('whitelist')
    .setDescription('Manage the server whitelist (admin only)')
    .addSubcommand(subcommand =>
      subcommand
        .setName('add')
        .setDescription('Add a player to the whitelist')
        .addStringOption(option => option.setName('player').setDescription('The player to add').setRequired(true))
        .addStringOption(option => option.setName('server').setDescription('The server to run the command on')))
    .addSubcommand(subcommand =>
      subcommand
        .setName('remove')
        .setDescription('Remove a player from the whitelist')
        .addStringOption(option => option.setName('player').setDescription('The player to remove').setRequired(true))
        .addStringOption(option => option.setName('server').setDescription('The server to run the command on')))
    .addSubcommand(subcommand =>
      subcommand
        .setName('list')
        .setDescription('List whitelisted players')
        .addStringOption(option => option.setName('server').setDescription('The server to run the command on'))),

  async execute(context, args) {
    const isInteraction = context.isChatInputCommand?.();
    if (isInteraction) await context.deferReply();

    const sub = isInteraction ? context.options.getSubcommand() : args[0]?.toLowerCase();
    const player = isInteraction ? context.options.getString('player') : args[1];
    const serverArg = isInteraction ? context.options.getString('server') : args[2];

    if (!isInteraction && (!sub || !['add', 'remove', 'list'].includes(sub)))
      return context.reply('❌ Usage:\n`*wl add <player> [server]`\n`*wl remove <player> [server]`\n`*wl list [server]`');

    if (!isInteraction && (sub === 'add' || sub === 'remove') && !player)
      return context.reply(`❌ Usage: \`*wl ${sub} <player>\``);

    const server = await resolveServer(context, isInteraction ? (serverArg ? [serverArg] : []) : (args[2] ? [args[2]] : []), 0);
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
      const command = sub === 'list' ? 'whitelist list' : `whitelist ${sub} ${player}`;
      const res = await rconCommand(server, command);
      const replyMsg = `✅ \`${res.replace(/§./g, '')}\``;
      return isInteraction ? context.editReply(replyMsg) : context.reply(replyMsg);
    } catch {
      const errorMsg = '⚠️ Could not connect to server via RCON.';
      return isInteraction ? context.editReply(errorMsg) : context.reply(errorMsg);
    }
  }
};
