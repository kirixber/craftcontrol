const { SlashCommandBuilder } = require('discord.js');
const { rconCommand } = require('../../utils/rcon');
const { resolveServer } = require('../../utils/resolveServer');
const { canManageSMP } = require('../../utils/permissions');

module.exports = {
  name: 'give',
  aliases: [],
  description: 'Give a player an item (admin only)',
  data: new SlashCommandBuilder()
    .setName('give')
    .setDescription('Give a player an item (admin only)')
    .addStringOption(option => option.setName('player').setDescription('The player to give the item to').setRequired(true))
    .addStringOption(option => option.setName('item').setDescription('The item to give').setRequired(true))
    .addIntegerOption(option => option.setName('amount').setDescription('The amount of the item to give'))
    .addStringOption(option => option.setName('server').setDescription('The server to run the command on')),

  async execute(context, args) {
    const isInteraction = context.isChatInputCommand?.();
    if (isInteraction) await context.deferReply();

    const player = isInteraction ? context.options.getString('player') : args[0];
    const item = isInteraction ? context.options.getString('item') : args[1];
    const amount = isInteraction ? context.options.getInteger('amount') : args[2];
    const serverArg = isInteraction ? context.options.getString('server') : args.slice(-1)[0];

    if (!isInteraction && (!player || !item)) {
      return context.reply('❌ Usage: `*give <player> <item> [amount] [server]`');
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
      command = `give ${player} ${item} ${amount || 1}`;
    } else {
      command = `give ${args.join(' ')}`;
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
