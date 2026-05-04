const { EmbedBuilder } = require('discord.js');
const { getServers } = require('../db/database');

module.exports = {
  name: 'help',
  aliases: ['h'],
  description: 'Shows all available commands',

  async execute(message) {
    const servers = await getServers(message.guild.id);
    const multiServer = servers.length > 1;
    const serverNote = multiServer
      ? `\n> 💡 **${servers.length} servers**: ${servers.map(s => `\`${s.server_name}\``).join(', ')} — append server name to commands to target a specific one.`
      : '';

    const embed = new EmbedBuilder()
      .setTitle('📖 SMP Bot — Commands')
      .setColor(0x5865F2)
      .setDescription(`Prefix: \`*\`  |  Aliases in brackets${serverNote}`)
      .addFields(
        {
          name: '⚙️ Setup',
          value: [
            '`*setup` — Add a new server *(admin only)*',
            '`*edit [server]` — Edit existing server config *(admin only)*',
            '`*remove <server>` [`*rem` `*del`] — Remove a server *(admin only)*',
            '`*rconguide` [`*rcon`] — Step-by-step RCON setup for your hosting panel',
          ].join('\n')
        },
        {
          name: '🌐 Server Info',
          value: [
            '`*ip [server]` — Connection info',
            '`*status [server]` — Online status + ping + player count',
            '`*online [server]` — Who\'s currently online *(RCON)*',
            '`*ping [server]` [`*network` `*latency`] — Detailed network stats',
          ].join('\n')
        },
        {
          name: '👤 Players',
          value: [
            '`*player <ign>` — Lookup skin, UUID, online status',
            '`*msg <player> <message> [server]` [`*tell` `*dm`] — DM a player in-game',
          ].join('\n')
        },
        {
          name: '📍 Coordinates',
          value: [
            '`*coords list [server]` [`*c`]',
            '`*coords add <n> <x> <y> <z> [dim] [server]`',
            '`*coords delete <n> [server]`',
          ].join('\n')
        },
        {
          name: '🧩 Mods',
          value: [
            '`*mods list [server]` [`*plugins` `*modlist`] — View client-side mods',
            '`*mods add <n> | <desc> | <url> | [required/optional] [server]` — Add a mod *(admin)*',
            '`*mods remove <n> [server]` — Remove a mod *(admin)*',
          ].join('\n')
        },
        {
          name: '📚 Minecraft Info',
          value: [
            '`*recipe <item>` [`*craft` `*r`] — Crafting recipe + wiki info',
            '`*wiki <query>` [`*w`] — Search the Minecraft Wiki',
          ].join('\n')
        },
        {
          name: '🎵 Audio',
          value: [
            '`*play <sound>` [`*p`] — Play a MC sound in your VC',
            '`*loop [sound]` [`*lp`] — Loop current or specified sound',
            '`*sounds` [`*sl`] — List all available sounds',
            '`*stop` [`*leave` `*dc`] — Stop and disconnect',
          ].join('\n')
        },
        {
          name: '🎨 Fun',
          value: '`*pixelate <url or attach>` [`*pix`] — Minecraft-style pixelate any image'
        },
        {
          name: '🛡️ Moderation *(admin only — needs RCON)*',
          value: [
            '`*whitelist <add|remove|list> [player] [server]` [`*wl`]',
            '`*ban <player> [reason] [server]`',
            '`*unban <player> [server]` [`*pardon`]',
            '`*kick <player> [reason] [server]`',
          ].join('\n')
        },
        {
          name: '🎮 Server Commands *(admin only — needs RCON)*',
          value: [
            '`*gm <mode> <player> [server]` [`*gamemode`]',
            '`*gr <rule> [value] [server]` [`*gamerule`]',
            '`*tp <player> <x> <y> <z> [server]` [`*teleport`]',
            '`*give <player> <item> [amount] [server]`',
            '`*time <set|query> <value> [server]`',
            '`*weather <clear|rain|thunder> [server]`',
          ].join('\n')
        }
      )
      .setFooter({ text: 'Commands marked "needs RCON" require RCON setup • Use *rconguide for help' });

    message.channel.send({ embeds: [embed] });
  }
};
