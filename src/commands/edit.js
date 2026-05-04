const { getDb, save, getServer, getServers } = require('../db/database');
const { EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'edit',
  aliases: [],
  description: 'Edit an existing server config (admin only)',

  async execute(message, args) {
    if (!message.member.permissions.has('Administrator'))
      return message.reply('❌ You need Administrator permissions.');

    // If no server name given and multiple servers exist, list them
    const servers = await getServers(message.guild.id);
    if (!servers.length)
      return message.reply('❌ No servers configured yet. Run `*setup` first.');

    let serverName = args[0];
    if (!serverName) {
      if (servers.length === 1) {
        serverName = servers[0].server_name;
      } else {
        return message.reply(
          `❓ Which server do you want to edit?\n${servers.map(s => `• \`${s.server_name}\``).join('\n')}\n\nUsage: \`*edit <server name>\``
        );
      }
    }

    const existing = await getServer(message.guild.id, serverName);
    if (!existing || existing === 'multiple')
      return message.reply(`❌ Server \`${serverName}\` not found. Use \`*edit\` to see available servers.`);

    const filter = m => m.author.id === message.author.id;
    const opts = { filter, max: 1, time: 30000 };

    const ask = async (prompt, currentValue) => {
      const display = currentValue ? ` (current: \`${currentValue}\`)` : ' (not set)';
      await message.channel.send(`${prompt}${display}\nType a new value, or \`skip\` to keep current.`);
      try {
        const collected = await message.channel.awaitMessages(opts);
        const response = collected.first().content.trim();
        return response.toLowerCase() === 'skip' ? currentValue : response;
      } catch {
        return currentValue; // timeout = keep current
      }
    };

    await message.channel.send(`✏️ **Editing: ${existing.server_name}**\nPress \`skip\` or wait 30s on any step to keep the current value.\n`);

    const javaIp = await ask('☕ **Java Edition IP?**', existing.java_ip);
    const javaPort = await ask('☕ **Java port?**', existing.java_port || '25565');

    const bedrockIp = await ask('📱 **Bedrock Edition IP?**', existing.bedrock_ip);
    const bedrockPort = await ask('📱 **Bedrock port?**', existing.bedrock_port || '19132');

    const version = await ask('🎮 **Minecraft version?**', existing.version);

    await message.channel.send('🔧 **RCON Settings**');
    const rconHost = await ask('🖥️ **RCON host?** (type `same` to use Java IP)', existing.rcon_host);
    const resolvedRconHost = rconHost === 'same' ? javaIp : rconHost;
    const rconPort = await ask('🔌 **RCON port?**', existing.rcon_port || '25575');
    const rconPassword = await ask('🔑 **RCON password?**', existing.rcon_password ? '••••••••' : null);
    // Don't overwrite password if they just see the masked version
    const finalRconPassword = rconPassword === '••••••••' ? existing.rcon_password : rconPassword;

    await message.channel.send('📁 **File Access Settings** *(for plugin management)*');
    const sshHost = await ask('🖥️ **SSH host?**', existing.ssh_host);
    const sshPort = await ask('🔌 **SSH port?**', existing.ssh_port || '22');
    const sshUsername = await ask('👤 **SSH username?**', existing.ssh_username);
    const sshPassword = await ask('🔐 **SSH password?**', existing.ssh_password ? '••••••••' : null);
    const finalSshPassword = sshPassword === '••••••••' ? existing.ssh_password : sshPassword;
    const sshKeyPath = await ask('📄 **SSH key path?**', existing.ssh_key_path);

    const ftpHost = await ask('🖥️ **FTP host?**', existing.ftp_host);
    const ftpPort = await ask('🔌 **FTP port?**', existing.ftp_port || '21');
    const ftpUsername = await ask('👤 **FTP username?**', existing.ftp_username);
    const ftpPassword = await ask('🔐 **FTP password?**', existing.ftp_password ? '••••••••' : null);
    const finalFtpPassword = ftpPassword === '••••••••' ? existing.ftp_password : ftpPassword;
    const ftpPath = await ask('📁 **FTP plugins path?**', existing.ftp_path || '/plugins');

    const pterodactylUrl = await ask('🌐 **Pterodactyl URL?**', existing.pterodactyl_url);
    const pterodactylApiKey = await ask('🔑 **Pterodactyl API key?**', existing.pterodactyl_api_key ? '••••••••' : null);
    const finalPterodactylApiKey = pterodactylApiKey === '••••••••' ? existing.pterodactyl_api_key : pterodactylApiKey;
    const pterodactylServerId = await ask('🆔 **Pterodactyl server ID?**', existing.pterodactyl_server_id);

    const db = await getDb();
    db.run(
      `UPDATE servers SET
        java_ip=?, java_port=?, bedrock_ip=?, bedrock_port=?,
        version=?, rcon_host=?, rcon_port=?, rcon_password=?,
        ssh_host=?, ssh_port=?, ssh_username=?, ssh_password=?, ssh_key_path=?,
        ftp_host=?, ftp_port=?, ftp_username=?, ftp_password=?, ftp_path=?,
        pterodactyl_url=?, pterodactyl_api_key=?, pterodactyl_server_id=?
       WHERE guild_id=? AND LOWER(server_name)=LOWER(?)`,
      [javaIp, javaPort, bedrockIp, bedrockPort, version, resolvedRconHost, rconPort, finalRconPassword,
       sshHost, sshPort, sshUsername, finalSshPassword, sshKeyPath,
       ftpHost, ftpPort, ftpUsername, finalFtpPassword, ftpPath,
       pterodactylUrl, finalPterodactylApiKey, pterodactylServerId,
       message.guild.id, serverName]
    );
    save();

    const embed = new EmbedBuilder()
      .setTitle(`✅ ${existing.server_name} updated!`)
      .setColor(0x44ff88)
      .addFields(
        { name: '☕ Java', value: javaIp ? `${javaIp}:${javaPort}` : 'Not set', inline: true },
        { name: '📱 Bedrock', value: bedrockIp ? `${bedrockIp}:${bedrockPort}` : 'Not set', inline: true },
        { name: '🎮 Version', value: version || 'Not set', inline: true },
        { name: '🔧 RCON', value: resolvedRconHost ? `✅ ${resolvedRconHost}:${rconPort}` : '⚠️ Not set', inline: true },
        { name: '📁 File Access', value: (sshHost || ftpHost || pterodactylUrl) ? '✅ Configured' : '⚠️ Not set', inline: true }
      );

    message.channel.send({ embeds: [embed] });
  }
};
