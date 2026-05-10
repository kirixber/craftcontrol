const { SlashCommandBuilder } = require('discord.js');
const { rconCommand } = require('../../utils/rcon');
const { resolveServer } = require('../../utils/resolveServer');

module.exports = {
  name: 'msg',
  aliases: ['tell', 'dm'],
  description: 'Send a message to an online player in-game',
  data: new SlashCommandBuilder()
    .setName('msg')
    .setDescription('Send a message to an online player in-game')
    .addStringOption(option => option.setName('player').setDescription('The player to message').setRequired(true))
    .addStringOption(option => option.setName('message').setDescription('The message to send').setRequired(true))
    .addStringOption(option => option.setName('server').setDescription('The server to run the command on')),

  async execute(context, args) {
    const isInteraction = context.isChatInputCommand?.();
    if (isInteraction) await context.deferReply();

    const player = isInteraction ? context.options.getString('player') : args[0];
    const messageText = isInteraction ? context.options.getString('message') : (args.length > 2 ? args.slice(1, -1).join(' ') : args.slice(1).join(' '));
    const serverArg = isInteraction ? context.options.getString('server') : args.slice(-1)[0];
    
    if (!isInteraction && args.length < 2) {
      return context.reply('❌ Usage: `*msg <player> <message> [server]`');
    }

    const server = await resolveServer(context, isInteraction ? (serverArg ? [serverArg] : []) : args.slice(-1), 0);
    if (!server) return;

    if (!server.rcon_host) {
      const msg = '❌ RCON not configured for this server. Re-run `*setup`.';
      return isInteraction ? context.editReply(msg) : context.reply(msg);
    }

    const sender = isInteraction ? context.user.username : context.author.username;

    try {
      await rconCommand(server, `tell ${player} [Discord] ${sender}: ${messageText}`);
      const replyMsg = `✅ Message sent to **${player}** in-game!`;
      return isInteraction ? context.editReply(replyMsg) : context.reply(replyMsg);
    } catch {
      const errorMsg = '⚠️ Could not connect via RCON. Is the player online?';
      return isInteraction ? context.editReply(errorMsg) : context.reply(errorMsg);
    }
  }
};
