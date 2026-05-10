const { SlashCommandBuilder } = require('discord.js');
const { rconCommand } = require('../../utils/rcon');
const { resolveServer } = require('../../utils/resolveServer');
const { canManageSMP } = require('../../utils/permissions');

module.exports = {
  name: 'gamerule',
  aliases: ['gr'],
  description: 'Get or set a gamerule (admin only)',
  data: new SlashCommandBuilder()
    .setName('gamerule')
    .setDescription('Get or set a gamerule (admin only)')
    .addStringOption(option => option.setName('rule').setDescription('The gamerule to get or set').setRequired(true))
    .addStringOption(option => option.setName('value').setDescription('The value to set (optional)'))
    .addStringOption(option => option.setName('server').setDescription('The server to run the command on')),

  async execute(context, args) {
    const isInteraction = context.isChatInputCommand?.();
    if (isInteraction) await context.deferReply();

    const rule = isInteraction ? context.options.getString('rule') : args[0];
    const value = isInteraction ? context.options.getString('value') : args[1];
    
    if (!isInteraction && !rule) {
      const COMMON_RULES = ['keepInventory','doFireTick','mobGriefing','doDaylightCycle','doWeatherCycle','doMobSpawning','announceAdvancements','naturalRegeneration','doImmediateRespawn','pvp'];
      return context.reply('❌ Usage: `*gr <rule> [value] [server]`\n**Common rules:** `' + COMMON_RULES.join('`, `') + '`');
    }

    let serverArg;
    if (isInteraction) {
      serverArg = context.options.getString('server');
    } else {
      serverArg = args[2] && isNaN(args[2]) && !['true','false'].includes(args[2].toLowerCase()) ? args[2] : null;
    }

    const server = await resolveServer(context, serverArg ? [serverArg] : [], 0);
    if (!server) return;

    if (!await canManageSMP(context.member, server.server_name)) {
      const msg = '❌ You need SMP Manager permissions.';
      return isInteraction ? context.editReply(msg) : context.reply(msg);
    }

    if (!server.rcon_host) {
      const msg = '❌ RCON not configured for this server. Re-run `*setup`.';
      return isInteraction ? context.editReply(msg) : context.reply(msg);
    }

    const command = value ? `gamerule ${rule} ${value}` : `gamerule ${rule}`;

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
