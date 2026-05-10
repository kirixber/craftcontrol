const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { rconCommand } = require('../../utils/rcon');
const { resolveServer } = require('../../utils/resolveServer');

module.exports = {
  name: 'plugins',
  aliases: ['pl', 'plugin'],
  description: 'List currently loaded server plugins via RCON',
  data: new SlashCommandBuilder()
    .setName('plugins')
    .setDescription('List currently loaded server plugins via RCON')
    .addStringOption(opt => opt.setName('server').setDescription('The server to list plugins for')),

  async execute(context, args) {
    const isInteraction = context.isChatInputCommand?.();
    if (isInteraction) await context.deferReply();

    const serverArg = isInteraction ? context.options.getString('server') : args[0];
    const server = await resolveServer(context, serverArg ? [serverArg] : [], 0);
    if (!server) return;

    if (!server.rcon_host || !server.rcon_password) {
      const msg = '❌ RCON is not configured for this server. Use `/rconguide` to set it up.';
      return isInteraction ? context.editReply(msg) : context.reply(msg);
    }

    const checkingMsg = `📦 Fetching plugins for **${server.server_name}**...`;
    let checking;
    if (!isInteraction) checking = await context.channel.send(checkingMsg);

    try {
      const response = await rconCommand(server, 'plugins');
      const pluginList = response.replace(/§./g, '').trim();
      
      // Typical responses: "Plugins (3): WorldEdit, Essentials, Vault" or "Plugins: ..."
      const listPart = pluginList.split(':').slice(1).join(':').trim() || pluginList;
      const plugins = listPart.split(',').map(p => p.trim()).filter(p => p);

      if (!isInteraction && checking) await checking.delete();

      if (!plugins || plugins.length === 0) {
        const msg = `📭 No plugins found on **${server.server_name}**.`;
        return isInteraction ? context.editReply(msg) : context.reply(msg);
      }

      const embed = new EmbedBuilder()
        .setTitle(`📦 ${server.server_name} — Plugins`)
        .setColor(0x5865F2)
        .setDescription(`Found **${plugins.length}** loaded plugin(s) via RCON`)
        .addFields({
          name: 'Loaded Plugins',
          value: plugins.map(p => `• \`${p}\``).join('\n').slice(0, 1024),
        })
        .setFooter({ text: 'RCON only shows plugins that are currently loaded and active.' });

      return isInteraction ? context.editReply({ embeds: [embed] }) : context.channel.send({ embeds: [embed] });
    } catch (error) {
      if (!isInteraction && checking) await checking.delete();
      console.error('List plugins error:', error);
      const msg = `⚠️ Could not fetch plugins via RCON. Is the server online?`;
      return isInteraction ? context.editReply(msg) : context.reply(msg);
    }
  }
};
