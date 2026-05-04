const { rconCommand } = require('../../utils/rcon');
const { resolveServer } = require('../../utils/resolveServer');

module.exports = {
  name: 'kick',
  aliases: [],
  description: 'Kick a player (admin only)',

  async execute(message, args) {
    if (!message.member.permissions.has('Administrator'))
      return message.reply('❌ You need Administrator permissions.');

    if (!args[0])
      return message.reply('❌ Usage: `*kick <player> [reason] [server]`');

    const serverName = args[args.length - 1];
    const server = await resolveServer(message, [serverName], 0);
    if (!server) return;
    if (!server.rcon_host) return message.reply('❌ RCON not configured for this server. Re-run `*setup`.');

    const player = args[0];
    const reason = args.slice(1, -1).join(' ') || 'Kicked by admin';

    try {
      const res = await rconCommand(server, `kick ${player} ${reason}`);
      message.reply(`✅ \`${res.replace(/§./g, '')}\``);
    } catch {
      message.reply('⚠️ Could not connect to server via RCON.');
    }
  }
};
