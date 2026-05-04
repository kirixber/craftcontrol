const { rconCommand } = require('../../utils/rcon');
const { resolveServer } = require('../../utils/resolveServer');

module.exports = {
  name: 'msg',
  aliases: ['tell', 'dm'],
  description: 'Send a message to an online player in-game',

  async execute(message, args) {
    if (args.length < 2)
      return message.reply('❌ Usage: `*msg <player> <message> [server]`');

    const player = args[0];
    const serverName = args[args.length - 1];
    const server = await resolveServer(message, [serverName], 0);
    if (!server) return;
    if (!server.rcon_host) return message.reply('❌ RCON not configured for this server. Re-run `*setup`.');

    const text = args.slice(1, -1).join(' ') || args.slice(1).join(' ');
    const sender = message.author.username;

    try {
      await rconCommand(server, `tell ${player} [Discord] ${sender}: ${text}`);
      message.reply(`✅ Message sent to **${player}** in-game!`);
    } catch {
      message.reply('⚠️ Could not connect via RCON. Is the player online?');
    }
  }
};
