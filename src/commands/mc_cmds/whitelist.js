const { rconCommand } = require('../../utils/rcon');
const { resolveServer } = require('../../utils/resolveServer');

module.exports = {
  name: 'whitelist',
  aliases: ['wl'],
  description: 'Manage the server whitelist (admin only)',

  async execute(message, args) {
    if (!message.member.permissions.has('Administrator'))
      return message.reply('❌ You need Administrator permissions.');

    const sub = args[0]?.toLowerCase();
    if (!sub || !['add','remove','list'].includes(sub))
      return message.reply('❌ Usage:\n`*wl add <player> [server]`\n`*wl remove <player> [server]`\n`*wl list [server]`');

    const player = args[1];
    const serverName = args[2] || null;

    if ((sub === 'add' || sub === 'remove') && !player)
      return message.reply(`❌ Usage: \`*wl ${sub} <player>\``);

    const server = await resolveServer(message, serverName ? [serverName] : [], 0);
    if (!server) return;
    if (!server.rcon_host) return message.reply('❌ RCON not configured for this server. Re-run `*setup`.');

    try {
      const command = sub === 'list' ? 'whitelist list' : `whitelist ${sub} ${player}`;
      const res = await rconCommand(server, command);
      message.reply(`✅ \`${res.replace(/§./g, '')}\``);
    } catch {
      message.reply('⚠️ Could not connect to server via RCON.');
    }
  }
};
