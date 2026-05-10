const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { resolveServer } = require('../utils/resolveServer');

module.exports = {
  name: 'ip',
  aliases: [],
  description: 'Show server connection info',
  data: new SlashCommandBuilder()
    .setName('ip')
    .setDescription('Show server connection info')
    .addStringOption(option =>
      option.setName('server')
        .setDescription('The server name (optional)')
        .setRequired(false)),

  async execute(context, args) {
    const isInteraction = !!context.isChatInputCommand?.();
    const finalArgs = isInteraction ? [context.options.getString('server')] : args;

    const server = await resolveServer(context, finalArgs, 0);
    if (!server) return;

    const embed = new EmbedBuilder()
      .setTitle(`🌍 ${server.server_name}`)
      .setColor(0x5865F2)
      .setDescription('Copy the IP and connect!');

    if (server.java_ip) {
      embed.addFields({ name: '☕ Java Edition', value: `\`\`\`${server.java_ip}:${server.java_port}\`\`\``, inline: false });
    }
    if (server.bedrock_ip) {
      embed.addFields({ name: '📱 Bedrock Edition', value: `IP: \`${server.bedrock_ip}\`\nPort: \`${server.bedrock_port}\``, inline: false });
    }
    if (server.version) {
      embed.addFields({ name: '🎮 Version', value: server.version, inline: true });
    }

    embed.setFooter({ text: 'Use /status to check if the server is online' });

    if (isInteraction) {
      await context.reply({ embeds: [embed] });
    } else {
      context.channel.send({ embeds: [embed] });
    }
  }
};
