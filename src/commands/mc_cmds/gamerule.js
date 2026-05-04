const { rconCommand } = require('../../utils/rcon');
const { resolveServer } = require('../../utils/resolveServer');

const COMMON_RULES = ['keepInventory','doFireTick','mobGriefing','doDaylightCycle','doWeatherCycle','doMobSpawning','announceAdvancements','naturalRegeneration','doImmediateRespawn','pvp'];

module.exports = {
  name: 'gamerule',
  aliases: ['gr'],
  description: 'Get or set a gamerule (admin only)',

  async execute(message, args) {
    if (!message.member.permissions.has('Administrator'))
      return message.reply('❌ You need Administrator permissions.');

    if (!args[0])
      return message.reply('❌ Usage: `*gr <rule> [value] [server]`\n**Common rules:** `' + COMMON_RULES.join('`, `') + '`');

    // last arg might be server name if 3 args given and 3rd doesn't look like true/false/number
    const serverArg = args[2] && isNaN(args[2]) && !['true','false'].includes(args[2].toLowerCase()) ? args[2] : null;
    const server = await resolveServer(message, serverArg ? [serverArg] : [], 0);
    if (!server) return;
    if (!server.rcon_host) return message.reply('❌ RCON not configured for this server. Re-run `*setup`.');

    const command = args.length === 1 ? `gamerule ${args[0]}` : `gamerule ${args[0]} ${args[1]}`;

    try {
      const res = await rconCommand(server, command);
      message.reply(`✅ \`${res.replace(/§./g, '')}\``);
    } catch {
      message.reply('⚠️ Could not connect to server via RCON.');
    }
  }
};
