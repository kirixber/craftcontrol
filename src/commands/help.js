const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getServers } = require('../db/database');

module.exports = {
  name: 'help',
  aliases: ['h'],
  description: 'Shows all available commands',
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Shows all available commands'),

  async execute(context) {
    const isInteraction = !!context.isChatInputCommand?.();
    const servers = getServers(context.guild.id);
    const multiServer = servers.length > 1;
    const serverNote = multiServer
      ? `\n> 💡 **${servers.length} servers**: ${servers.map(s => `\`${s.server_name}\``).join(', ')} — append server name to commands to target a specific one.`
      : '';

    const embed = new EmbedBuilder()
      .setTitle('📖 SMP Bot — Commands')
      .setColor(0x5865F2)
      .setDescription(`Prefix: \`*\`  |  Slash Commands supported${serverNote}`)
      .addFields(
        {
          name: '⚙️ Setup',
          value: [
            '`/setup` — Add a new server *(admin only)*',
            '`/edit [server]` — Edit existing server config *(admin only)*',
            '`/remove <server>` — Remove a server *(admin only)*',
            '`/rconguide` — Step-by-step RCON setup for your hosting panel',
          ].join('\n')
        },
        {
          name: '🌐 Server Info',
          value: [
            '`/ip [server]` — Connection info',
            '`/status [server]` — Online status + ping + player count',
            '`/online [server]` — Who\'s currently online *(RCON)*',
            '`/plugins [server]` — List loaded plugins *(RCON)*',
            '`/ping [server]` — Detailed network stats',
          ].join('\n')
        },
        {
          name: '👤 Players',
          value: [
            '`/player <ign>` — Lookup skin, UUID, online status',
            '`/msg <player> <message> [server]` — DM a player in-game',
          ].join('\n')
        },
        {
          name: '📍 Coordinates',
          value: [
            '`/coords list [server]`',
            '`/coords add <n> <x> <y> <z> [dim] [server]`',
            '`/coords delete <n> [server]`',
          ].join('\n')
        },
        {
          name: '🧩 Mods',
          value: [
            '`/mods list [server]` — View client-side mods',
            '`/mods add` — Add a mod *(SMP Manager)*',
            '`/mods remove` — Remove a mod *(SMP Manager)*',
          ].join('\n')
        },
        {
          name: '📚 Minecraft Info',
          value: [
            '`/recipe <item>` — Crafting recipe + wiki info',
            '`/wiki <query>` — Search the Minecraft Wiki',
          ].join('\n')
        },
        {
          name: '🎵 Audio',
          value: [
            '`/play <sound>` — Play a MC sound in your VC',
            '`/loop [sound]` — Loop current or specified sound',
            '`/sounds` — List all available sounds',
            '`/stop` — Stop and disconnect',
          ].join('\n')
        },
        {
          name: '🎨 Fun',
          value: '`/pixelate <url or attach>` — Minecraft-style pixelate any image'
        },
        {
          name: '🛡️ Moderation *(admin only — needs RCON)*',
          value: [
            '`/whitelist <add|remove|list> [player] [server]`',
            '`/ban <player> [reason] [server]`',
            '`/unban <player> [server]`',
            '`/kick <player> [reason] [server]`',
          ].join('\n')
        },
        {
          name: '🎮 Server Commands *(admin only — needs RCON)*',
          value: [
            '`/gm <mode> <player> [server]`',
            '`/gr <rule> [value] [server]`',
            '`/tp <player> <x> <y> <z> [server]`',
            '`/give <player> <item> [amount] [server]`',
            '`/time <set|query> <value> [server]`',
            '`/weather <clear|rain|thunder> [server]`',
          ].join('\n')
        }
      )
      .setFooter({ text: 'Commands marked "needs RCON" require RCON setup • Use /rconguide for help' });

    if (isInteraction) {
      await context.reply({ embeds: [embed] });
    } else {
      context.channel.send({ embeds: [embed] });
    }
  }
};
