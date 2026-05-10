const { getDb, save, getServer, getServers } = require('../db/database');
const { canManageSMP } = require('../utils/permissions');
const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  name: 'remove',
  aliases: ['rem', 'del'],
  description: 'Remove a server and all its data (admin only)',
  data: new SlashCommandBuilder()
    .setName('remove')
    .setDescription('Remove a server and all its data (admin only)')
    .addStringOption(option =>
      option.setName('server')
        .setDescription('The server name to remove')
        .setRequired(false)),

  async execute(context, args) {
    const isInteraction = !!context.isChatInputCommand?.();
    const member = context.member;

    if (!await canManageSMP(member)) {
      const msg = '❌ You need SMP Manager permissions.';
      return isInteraction ? context.reply({ content: msg, ephemeral: true }) : context.reply(msg);
    }

    const servers = getServers(context.guild.id);
    if (!servers.length) {
      const msg = '❌ No servers configured. Nothing to remove.';
      return isInteraction ? context.reply({ content: msg, ephemeral: true }) : context.reply(msg);
    }

    let serverName = isInteraction ? context.options.getString('server') : args[0];

    if (!serverName) {
      if (servers.length === 1) {
        serverName = servers[0].server_name;
      } else {
        const msg = `❓ Which server do you want to remove?\n${servers.map(s => `• \`${s.server_name}\``).join('\n')}\n\nUsage: \`${isInteraction ? '/remove server:<name>' : '*remove <server name>'}\``;
        return isInteraction ? context.reply({ content: msg, ephemeral: true }) : context.reply(msg);
      }
    }

    const server = getServer(context.guild.id, serverName);
    if (!server || server === 'multiple') {
      const msg = `❌ Server \`${serverName}\` not found.`;
      return isInteraction ? context.reply({ content: msg, ephemeral: true }) : context.reply(msg);
    }

    if (isInteraction) await context.deferReply();

    // Confirm before deleting
    const confirmMsg = `⚠️ Are you sure you want to remove **${server.server_name}**? This will also delete all its saved coords.\nType \`yes\` to confirm or anything else to cancel.`;
    if (isInteraction) {
      await context.editReply(confirmMsg);
    } else {
      await context.channel.send(confirmMsg);
    }

    const filter = m => m.author.id === (isInteraction ? context.user.id : context.author.id);
    try {
      const collected = await context.channel.awaitMessages({ filter, max: 1, time: 15000, errors: ['time'] });
      const response = collected.first().content.trim().toLowerCase();

      if (response !== 'yes') {
        const cancelMsg = '❌ Removal cancelled.';
        return isInteraction ? context.followUp(cancelMsg) : context.channel.send(cancelMsg);
      }
    } catch {
      const timeoutMsg = '⏱️ Timed out. Removal cancelled.';
      return isInteraction ? context.followUp(timeoutMsg) : context.channel.send(timeoutMsg);
    }

    const db = getDb();
    db.prepare(`DELETE FROM servers WHERE guild_id = ? AND LOWER(server_name) = LOWER(?)`).run(context.guild.id, serverName);
    db.prepare(`DELETE FROM coords WHERE guild_id = ? AND LOWER(server_name) = LOWER(?)`).run(context.guild.id, serverName);
    save();

    const remaining = getServers(context.guild.id);
    const remainingText = remaining.length
      ? `Remaining servers: ${remaining.map(s => `\`${s.server_name}\``).join(', ')}`
      : 'No servers remaining. Run `*setup` to add one.';

    const successMsg = `✅ **${server.server_name}** and all its data have been removed.\n${remainingText}`;
    if (isInteraction) {
      await context.followUp(successMsg);
    } else {
      context.channel.send(successMsg);
    }
  }
};

