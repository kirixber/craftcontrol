const { getDb, save, getServers } = require('../db/database');
const { EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'setup',
  aliases: [],
  description: 'Add or update a server config (admin only)',

  async execute(message) {
    if (!message.member.permissions.has('Administrator'))
      return message.reply('❌ You need Administrator permissions to run setup.');

    const filter = m => m.author.id === message.author.id;
    const opts = { filter, max: 1, time: 30000 };

    const ask = async (prompt) => {
      await message.channel.send(prompt);
      try {
        const collected = await message.channel.awaitMessages(opts);
        const response = collected.first().content.trim();
        return response.toLowerCase() === 'skip' ? null : response;
      } catch {
        return null;
      }
    };

    const existing = await getServers(message.guild.id);
    if (existing.length > 0) {
      await message.channel.send(
        `ℹ️ You already have ${existing.length} server(s): ${existing.map(s => `\`${s.server_name}\``).join(', ')}\n` +
        `To edit an existing server use \`*edit <server name>\` instead.`
      );
    }

    await message.channel.send('🛠️ **SMP Bot Setup**\nType `skip` to leave any optional field empty.\n');

    const serverName = await ask('📛 **Server name?** (used in commands like `*status <n>`)');
    if (!serverName) return message.channel.send('❌ Setup cancelled — server name is required.');

    const javaIp = await ask('☕ **Java Edition IP?** (the public IP players use to connect, or `skip`)');
    let javaPort = '25565';
    if (javaIp) {
      const port = await ask('☕ **Java port?** (default `25565`, `skip` for default)');
      if (port) javaPort = port;
    }

    const bedrockIp = await ask('📱 **Bedrock Edition IP?** (or `skip`)');
    let bedrockPort = '19132';
    if (bedrockIp) {
      const port = await ask('📱 **Bedrock port?** (default `19132`, `skip` for default)');
      if (port) bedrockPort = port;
    }

    const version = await ask('🎮 **Minecraft version?** (e.g. `1.21.1`, or `skip`)');

    // RCON setup
    await message.channel.send('🔧 **RCON Setup** *(optional — enables live player list, in-game commands and more)*\nType `skip` to skip. Need help? Run `*rconguide` after setup.');

    const rconHostRaw = await ask(
      `🖥️ **RCON host?**\n` +
      `• If your server is **directly hosted** (not tunneled): type \`same\` to use the Java IP, or enter the IP\n` +
      `• If using a **tunnel** (playit.gg, ngrok, etc.): enter your server's **local/LAN IP** (e.g. \`192.168.1.10\`)\n` +
      `• Type \`skip\` to skip RCON`
    );

    let rconHost = null;
    if (rconHostRaw === 'same') {
      rconHost = javaIp;
    } else if (rconHostRaw) {
      rconHost = rconHostRaw;
    } else {
      rconHost = javaIp; // default to java IP if skipped and java IP exists
    }

    let rconPort = '25575';
    let rconPassword = null;
    if (rconHost) {
      const port = await ask('🔌 **RCON port?** (default `25575`, `skip` for default)');
      if (port) rconPort = port;
      rconPassword = await ask('🔑 **RCON password?** (from `server.properties`, or `skip` to disable RCON)');
    }

    const db = await getDb();
    db.run(
      `INSERT INTO servers (guild_id, server_name, java_ip, java_port, bedrock_ip, bedrock_port, version, rcon_host, rcon_port, rcon_password)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(guild_id, server_name) DO UPDATE SET
         java_ip=excluded.java_ip, java_port=excluded.java_port,
         bedrock_ip=excluded.bedrock_ip, bedrock_port=excluded.bedrock_port,
         version=excluded.version,
         rcon_host=excluded.rcon_host, rcon_port=excluded.rcon_port, rcon_password=excluded.rcon_password`,
      [message.guild.id, serverName, javaIp, javaPort, bedrockIp, bedrockPort, version, rconHost, rconPort, rconPassword]
    );
    save();

    const allServers = await getServers(message.guild.id);

    const embed = new EmbedBuilder()
      .setTitle(`✅ ${serverName} configured!`)
      .setColor(0x44ff88)
      .addFields(
        { name: '☕ Java', value: javaIp ? `${javaIp}:${javaPort}` : 'Not set', inline: true },
        { name: '📱 Bedrock', value: bedrockIp ? `${bedrockIp}:${bedrockPort}` : 'Not set', inline: true },
        { name: '🎮 Version', value: version || 'Not set', inline: true },
        {
          name: '🔧 RCON',
          value: rconHost && rconPassword
            ? `✅ ${rconHost}:${rconPort}`
            : '⚠️ Not set — use `*rconguide` for setup help',
          inline: true
        },
        { name: `📋 All servers (${allServers.length})`, value: allServers.map(s => `• \`${s.server_name}\``).join('\n') }
      )
      .setFooter({ text: allServers.length > 1 ? 'Use *ip <n>, *status <n> to target a specific server' : 'Only one server — no need to specify name in commands!' });

    message.channel.send({ embeds: [embed] });
  }
};
