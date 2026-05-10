const { SlashCommandBuilder } = require('discord.js');
const { rconCommand } = require('../../utils/rcon');
const { resolveServer } = require('../../utils/resolveServer');
const { canManageSMP } = require('../../utils/permissions');

module.exports = {
  name: 'tp',
  aliases: ['teleport'],
  description: 'Teleport a player (admin only)',
  data: new SlashCommandBuilder()
    .setName('tp')
    .setDescription('Teleport a player (admin only)')
    .addStringOption(option => option.setName('target').setDescription('The player to teleport').setRequired(true))
    .addStringOption(option => option.setName('destination').setDescription('The destination (player name or X coordinate)').setRequired(true))
    .addStringOption(option => option.setName('y').setDescription('Y coordinate (optional)'))
    .addStringOption(option => option.setName('z').setDescription('Z coordinate (optional)'))
    .addStringOption(option => option.setName('server').setDescription('The server to run the command on')),

  async execute(context, args) {
    const isInteraction = context.isChatInputCommand?.();
    if (isInteraction) await context.deferReply();

    const target = isInteraction ? context.options.getString('target') : args[0];
    const destination = isInteraction ? context.options.getString('destination') : args[1];
    const y = isInteraction ? context.options.getString('y') : args[2];
    const z = isInteraction ? context.options.getString('z') : args[3];
    const serverArg = isInteraction ? context.options.getString('server') : args.slice(-1)[0];

    if (!isInteraction && args.length < 2) {
      return context.reply('❌ Usage:\n`*tp <player> <x> <y> <z> [server]`\n`*tp <player1> <player2> [server]`');
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

    let command;
    if (isInteraction) {
      if (y && z) {
        command = `tp ${target} ${destination} ${y} ${z}`;
      } else {
        command = `tp ${target} ${destination}`;
      }
    } else {
      command = `tp ${args.join(' ')}`;
    }

    try {
      const res = await rconCommand(server, command);
      const replyMsg = `✅ \`${res.replace(/§./g, '')}\``;
      return isInteraction ? context.editReply(replyMsg) : context.reply(replyMsg);
    } catch {
      const errorMsg = '⚠️ Could not connect to server via RCON.';
      return isInteraction ? context.editReply(errorMsg) : context.reply(errorMsg);
    }
  }
};
