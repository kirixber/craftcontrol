const { rconCommand } = require('../../utils/rcon');
const { resolveServer } = require('../../utils/resolveServer');

const MODES = ['survival', 'creative', 'adventure', 'spectator', 's', 'c', 'a', 'sp'];

module.exports = {
  name: 'gamemode',
  aliases: ['gm'],
  description: 'Change a player\'s gamemode (admin only)',

  async execute(message, args) {
    if (!message.member.permissions.has('Administrator'))
      return message.reply('❌ You need Administrator permissions.');

    // *gm <mode> <player> [server]
    if (args.length < 2)
      return message.reply('❌ Usage: `*gm <mode> <player> [server]`\nModes: `survival` `creative` `adventure` `spectator`');

    const [mode, player] = args;
    const serverName = args[2] || null;

    if (!MODES.includes(mode.toLowerCase()))
      return message.reply('❌ Invalid gamemode. Use: `survival` `creative` `adventure` `spectator`');

    const server = await resolveServer(message, serverName ? [serverName] : [], 0);
    if (!server) return;
    if (!server.rcon_host) return message.reply('❌ RCON not configured for this server. Re-run `*setup`.');

    try {
      const res = await rconCommand(server, `gamemode ${mode} ${player}`);
      message.reply(`✅ \`${res.replace(/§./g, '')}\``);
    } catch {
      message.reply('⚠️ Could not connect to server via RCON.');
    }
  }
};
