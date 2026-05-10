const { SlashCommandBuilder } = require('discord.js');
const { rconCommand } = require('../../utils/rcon');
const { resolveServer } = require('../../utils/resolveServer');
const { canManageSMP } = require('../../utils/permissions');

module.exports = {
  name: 'weather',
  aliases: [],
  description: 'Set server weather (admin only)',
  data: new SlashCommandBuilder()
    .setName('weather')
    .setDescription('Set server weather (admin only)')
    .addStringOption(option => 
      option.setName('type')
        .setDescription('The type of weather')
        .setRequired(true)
        .addChoices(
          { name: 'Clear', value: 'clear' },
          { name: 'Rain', value: 'rain' },
          { name: 'Thunder', value: 'thunder' }
        ))
    .addStringOption(option => option.setName('server').setDescription('The server to run the command on')),

  async execute(context, args) {
    const isInteraction = context.isChatInputCommand?.();
    if (isInteraction) await context.deferReply();

    const type = isInteraction ? context.options.getString('type') : args[0]?.toLowerCase();
    const serverArg = isInteraction ? context.options.getString('server') : args.slice(-1)[0];

    const valid = ['clear', 'rain', 'thunder'];
    if (!isInteraction && (!type || !valid.includes(type)))
      return context.reply('❌ Usage: `*weather <clear|rain|thunder> [server]`');

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

    try {
      const res = await rconCommand(server, `weather ${type}`);
      const replyMsg = `✅ \`${res.replace(/§./g, '')}\``;
      return isInteraction ? context.editReply(replyMsg) : context.reply(replyMsg);
    } catch {
      const errorMsg = '⚠️ Could not connect to server via RCON.';
      return isInteraction ? context.editReply(errorMsg) : context.reply(errorMsg);
    }
  }
};
