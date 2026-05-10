const { getServer, getServers } = require('../db/database');

// Resolves which server to use based on args and guild state.
// Returns server object on success, or sends an error reply and returns null.
async function resolveServer(context, args, argIndex = 0) {
  const guildId = context.guild.id;
  const serverName = args[argIndex] || null;
  const server = getServer(guildId, serverName);

  const reply = async (content) => {
    if (context.isChatInputCommand?.()) {
      if (context.deferred || context.replied) return context.followUp(content);
      return context.reply(content);
    }
    return context.reply(content);
  };

  if (server === null) {
    const servers = getServers(guildId);
    if (servers.length === 0) {
      await reply('❌ No servers configured yet. Run `*setup` to add one.');
    } else {
      await reply(`❌ Server \`${serverName}\` not found. Available servers: ${servers.map(s => `\`${s.server_name}\``).join(', ')}`);
    }
    return null;
  }

  if (server === 'multiple') {
    const servers = getServers(guildId);
    await reply(`❓ Multiple servers configured. Specify one:\n${servers.map(s => `• \`${s.server_name}\``).join('\n')}\n\nExample: \`*status ${servers[0].server_name}\``);
    return null;
  }

  return server;
}

module.exports = { resolveServer };

