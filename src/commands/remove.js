const { getDb, save, getServer, getServers } = require('../db/database');

module.exports = {
  name: 'remove',
  aliases: ['rem', 'del'],
  description: 'Remove a server and all its data (admin only)',

  async execute(message, args) {
    if (!message.member.permissions.has('Administrator'))
      return message.reply('❌ You need Administrator permissions.');

    const servers = await getServers(message.guild.id);
    if (!servers.length)
      return message.reply('❌ No servers configured. Nothing to remove.');

    let serverName = args[0];

    if (!serverName) {
      if (servers.length === 1) {
        serverName = servers[0].server_name;
      } else {
        return message.reply(
          `❓ Which server do you want to remove?\n${servers.map(s => `• \`${s.server_name}\``).join('\n')}\n\nUsage: \`*remove <server name>\``
        );
      }
    }

    const server = await getServer(message.guild.id, serverName);
    if (!server || server === 'multiple')
      return message.reply(`❌ Server \`${serverName}\` not found.`);

    // Confirm before deleting
    await message.channel.send(
      `⚠️ Are you sure you want to remove **${server.server_name}**? This will also delete all its saved coords.\nType \`yes\` to confirm or anything else to cancel.`
    );

    const filter = m => m.author.id === message.author.id;
    try {
      const collected = await message.channel.awaitMessages({ filter, max: 1, time: 15000 });
      const response = collected.first().content.trim().toLowerCase();

      if (response !== 'yes') {
        return message.channel.send('❌ Removal cancelled.');
      }
    } catch {
      return message.channel.send('⏱️ Timed out. Removal cancelled.');
    }

    const db = await getDb();
    db.run(`DELETE FROM servers WHERE guild_id = ? AND LOWER(server_name) = LOWER(?)`, [message.guild.id, serverName]);
    db.run(`DELETE FROM coords WHERE guild_id = ? AND LOWER(server_name) = LOWER(?)`, [message.guild.id, serverName]);
    save();

    const remaining = await getServers(message.guild.id);
    const remainingText = remaining.length
      ? `Remaining servers: ${remaining.map(s => `\`${s.server_name}\``).join(', ')}`
      : 'No servers remaining. Run `*setup` to add one.';

    message.channel.send(`✅ **${server.server_name}** and all its data have been removed.\n${remainingText}`);
  }
};
