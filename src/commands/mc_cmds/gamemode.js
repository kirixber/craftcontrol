const { SlashCommandBuilder } = require('discord.js');
const { rconCommand } = require('../../utils/rcon');
const { resolveServer } = require('../../utils/resolveServer');
const { canManageSMP } = require('../../utils/permissions');

const ALL_MODES = ['survival', 'creative', 'adventure', 'spectator', 's', 'c', 'a', 'sp'];

module.exports = {
  name: 'gamemode',
  aliases: ['gm'],
  description: 'Change a player\'s gamemode (admin only)',
  data: new SlashCommandBuilder()
    .setName('gamemode')
    .setDescription('Change a player\'s gamemode (admin only)')
    .addStringOption(option => 
        option.setName('mode')
            .setDescription('The gamemode to set')
            .setRequired(true)
            .addChoices(
                { name: 'survival', value: 'survival' },
                { name: 'creative', value: 'creative' },
                { name: 'adventure', value: 'adventure' },
                { name: 'spectator', value: 'spectator' },
            ))
    .addStringOption(option => option.setName('player').setDescription('The player to change gamemode for').setRequired(true))
    .addStringOption(option => option.setName('server').setDescription('The server to run the command on')),

  async execute(context, args) {
    const isInteraction = context.isChatInputCommand?.();
    if (isInteraction) await context.deferReply();

    const mode = isInteraction ? context.options.getString('mode') : args[0];
    const player = isInteraction ? context.options.getString('player') : args[1];
    const serverArg = isInteraction ? context.options.getString('server') : args[2];

    if (!isInteraction && (!mode || !player)) {
      return context.reply('❌ Usage: `*gm <mode> <player> [server]`\nModes: `survival` `creative` `adventure` `spectator`');
    }

    if (!ALL_MODES.includes(mode?.toLowerCase())) {
      const msg = '❌ Invalid gamemode. Use: `survival` `creative` `adventure` `spectator`';
      return isInteraction ? context.editReply(msg) : context.reply(msg);
    }

    const server = await resolveServer(context, isInteraction ? (serverArg ? [serverArg] : []) : (serverArg ? [serverArg] : []), 0);
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
      const res = await rconCommand(server, `gamemode ${mode} ${player}`);
      const replyMsg = `✅ \`${res.replace(/§./g, '')}\``;
      return isInteraction ? context.editReply(replyMsg) : context.reply(replyMsg);
    } catch {
      const errorMsg = '⚠️ Could not connect to server via RCON.';
      return isInteraction ? context.editReply(errorMsg) : context.reply(errorMsg);
    }
  }
};
