const { rconCommand } = require('../../utils/rcon');
const { resolveServer } = require('../../utils/resolveServer');

module.exports = {
  name: 'unban',
  aliases: ['pardon'],
  description: 'Unban a player (admin only)',

  async execute(message, args) {
    if (!message.member.permissions.has('Administrator'))
      return message.reply('❌ You need Administrator permissions.');

    if (!args[0])
      return message.reply('❌ Usage: `*unban <player> [server]`');

    const serverName = args[1] || null;
    const server = await resolveServer(message, serverName ? [serverName] : [], 0);
    if (!server) return;
    if (!server.rcon_host) return message.reply('❌ RCON not configured for this server. Re-run `*setup`.');

    try {
      const res = await rconCommand(server, `pardon ${args[0]}`);
      message.reply(`✅ \`${res.replace(/§./g, '')}\``);
    } catch {
      message.reply('⚠️ Could not connect to server via RCON.');
    }
  }
};
