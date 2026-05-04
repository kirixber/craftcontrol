const { rconCommand } = require('../../utils/rcon');
const { resolveServer } = require('../../utils/resolveServer');

module.exports = {
  name: 'weather',
  aliases: [],
  description: 'Set server weather (admin only)',

  async execute(message, args) {
    if (!message.member.permissions.has('Administrator'))
      return message.reply('❌ You need Administrator permissions.');

    const valid = ['clear', 'rain', 'thunder'];
    if (!args[0] || !valid.includes(args[0].toLowerCase()))
      return message.reply('❌ Usage: `*weather <clear|rain|thunder> [server]`');

    const server = await resolveServer(message, args.slice(-1), 0);
    if (!server) return;
    if (!server.rcon_host) return message.reply('❌ RCON not configured for this server. Re-run `*setup`.');

    try {
      const res = await rconCommand(server, `weather ${args[0]}`);
      message.reply(`✅ \`${res.replace(/§./g, '')}\``);
    } catch {
      message.reply('⚠️ Could not connect to server via RCON.');
    }
  }
};
