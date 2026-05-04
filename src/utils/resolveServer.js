const { getServer, getServers } = require('../db/database');

// Resolves which server to use based on args and guild state.
// Returns { server } on success, or sends an error reply and returns null.
async function resolveServer(message, args, argIndex = 0) {
  const serverName = args[argIndex] || null;
  const server = await getServer(message.guild.id, serverName);

  if (server === null) {
    const servers = await getServers(message.guild.id);
    if (servers.length === 0) {
      message.reply('❌ No servers configured yet. Run `*setup` to add one.');
    } else {
      message.reply(`❌ Server \`${serverName}\` not found. Available servers: ${servers.map(s => `\`${s.server_name}\``).join(', ')}`);
    }
    return null;
  }

  if (server === 'multiple') {
    const servers = await getServers(message.guild.id);
    message.reply(`❓ Multiple servers configured. Specify one:\n${servers.map(s => `• \`${s.server_name}\``).join('\n')}\n\nExample: \`*status ${servers[0].server_name}\``);
    return null;
  }

  return server;
}

module.exports = { resolveServer };
