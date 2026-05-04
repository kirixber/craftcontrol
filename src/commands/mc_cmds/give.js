const { rconCommand } = require('../../utils/rcon');
const { resolveServer } = require('../../utils/resolveServer');

module.exports = {
  name: 'give',
  aliases: [],
  description: 'Give a player an item (admin only)',

  async execute(message, args) {
    if (!message.member.permissions.has('Administrator'))
      return message.reply('❌ You need Administrator permissions.');

    if (args.length < 2)
      return message.reply('❌ Usage: `*give <player> <item> [amount] [server]`');

    const server = await resolveServer(message, args.slice(-1), 0);
    if (!server) return;
    if (!server.rcon_host) return message.reply('❌ RCON not configured for this server. Re-run `*setup`.');

    try {
      const res = await rconCommand(server, `give ${args.join(' ')}`);
      message.reply(`✅ \`${res.replace(/§./g, '')}\``);
    } catch {
      message.reply('⚠️ Could not connect to server via RCON.');
    }
  }
};
