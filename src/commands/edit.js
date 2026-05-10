const { getDb, save, getServer, getServers } = require('../db/database');
const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');
const { canManageSMP } = require('../utils/permissions');

module.exports = {
  name: 'edit',
  aliases: [],
  description: 'Edit an existing server config (admin only)',
  data: new SlashCommandBuilder()
    .setName('edit')
    .setDescription('Edit an existing server config (admin only)')
    .addStringOption(option =>
      option.setName('server')
        .setDescription('The server name to edit')
        .setRequired(false)),

  async execute(context, args) {
    const isInteraction = !!context.isChatInputCommand?.();
    const member = context.member;

    if (!await canManageSMP(member)) {
      const msg = '❌ You need SMP Manager permissions to run edit.';
      return isInteraction ? context.reply({ content: msg, ephemeral: true }) : context.reply(msg);
    }

    // If no server name given and multiple servers exist, list them
    const servers = getServers(context.guild.id);
    if (!servers.length) {
      const msg = '❌ No servers configured yet. Run `*setup` first.';
      return isInteraction ? context.reply({ content: msg, ephemeral: true }) : context.reply(msg);
    }

    let serverName = isInteraction ? context.options.getString('server') : args[0];
    if (!serverName) {
      if (servers.length === 1) {
        serverName = servers[0].server_name;
      } else {
        const msg = `❓ Which server do you want to edit?\n${servers.map(s => `• \`${s.server_name}\``).join('\n')}\n\nUsage: \`${isInteraction ? '/edit server:<name>' : '*edit <server name>'}\``;
        return isInteraction ? context.reply({ content: msg, ephemeral: true }) : context.reply(msg);
      }
    }

    const existing = getServer(context.guild.id, serverName);
    if (!existing || existing === 'multiple') {
      const msg = `❌ Server \`${serverName}\` not found. Use \`${isInteraction ? '/edit' : '*edit'}\` to see available servers.`;
      return isInteraction ? context.reply({ content: msg, ephemeral: true }) : context.reply(msg);
    }

    if (isInteraction) await context.deferReply();

    const filter = m => m.author.id === (isInteraction ? context.user.id : context.author.id);
    const opts = { filter, max: 1, time: 30000 };

    const ask = async (prompt, currentValue) => {
      const display = currentValue ? ` (current: \`${currentValue}\`)` : ' (not set)';
      const fullPrompt = `${prompt}${display}\nType a new value, or \`skip\` to keep current.`;
      if (isInteraction) {
        await context.followUp(fullPrompt);
      } else {
        await context.channel.send(fullPrompt);
      }
      try {
        const collected = await context.channel.awaitMessages(opts);
        const response = collected.first().content.trim();
        return response.toLowerCase() === 'skip' ? currentValue : response;
      } catch {
        return currentValue; // timeout = keep current
      }
    };

    const startMsg = `✏️ **Editing: ${existing.server_name}**\nPress \`skip\` or wait 30s on any step to keep the current value.\n`;
    if (isInteraction) await context.editReply(startMsg);
    else await context.channel.send(startMsg);

    const javaIp = await ask('☕ **Java Edition IP?**', existing.java_ip);
    const javaPort = await ask('☕ **Java port?**', existing.java_port || '25565');

    const bedrockIp = await ask('📱 **Bedrock Edition IP?**', existing.bedrock_ip);
    const bedrockPort = await ask('📱 **Bedrock port?**', existing.bedrock_port || '19132');

    const version = await ask('🎮 **Minecraft version?**', existing.version);

    if (isInteraction) await context.followUp('🔧 **RCON Settings**');
    else await context.channel.send('🔧 **RCON Settings**');
    
    const rconHost = await ask('🖥️ **RCON host?** (type `same` to use Java IP)', existing.rcon_host);
    const resolvedRconHost = rconHost === 'same' ? javaIp : rconHost;
    const rconPort = await ask('🔌 **RCON port?**', existing.rcon_port || '25575');
    const rconPassword = await ask('🔑 **RCON password?**', existing.rcon_password ? '••••••••' : null);
    // Don't overwrite password if they just see the masked version
    const finalRconPassword = rconPassword === '••••••••' ? existing.rcon_password : rconPassword;

    const managerRoleId = await ask('🛡️ **SMP Manager Role ID?**', existing.manager_role_id);

    const db = getDb();
    db.prepare(
      `UPDATE servers SET
        java_ip=?, java_port=?, bedrock_ip=?, bedrock_port=?,
        version=?, rcon_host=?, rcon_port=?, rcon_password=?,
        manager_role_id=?
       WHERE guild_id=? AND LOWER(server_name)=LOWER(?)`
    ).run(javaIp, javaPort, bedrockIp, bedrockPort, version, resolvedRconHost, rconPort, finalRconPassword,
       managerRoleId,
       context.guild.id, serverName);
    save();

    const embed = new EmbedBuilder()
      .setTitle(`✅ ${existing.server_name} updated!`)
      .setColor(0x44ff88)
      .addFields(
        { name: '☕ Java', value: javaIp ? `${javaIp}:${javaPort}` : 'Not set', inline: true },
        { name: '📱 Bedrock', value: bedrockIp ? `${bedrockIp}:${bedrockPort}` : 'Not set', inline: true },
        { name: '🎮 Version', value: version || 'Not set', inline: true },
        { name: '🔧 RCON', value: resolvedRconHost ? `✅ ${resolvedRconHost}:${rconPort}` : '⚠️ Not set', inline: true }
      );

    if (isInteraction) {
      await context.followUp({ embeds: [embed] });
    } else {
      context.channel.send({ embeds: [embed] });
    }
  }
};
