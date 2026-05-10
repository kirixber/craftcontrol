const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getDb, save } = require('../db/database');
const { resolveServer } = require('../utils/resolveServer');
const { canManageSMP } = require('../utils/permissions');

module.exports = {
  name: 'mods',
  aliases: ['plugins', 'modlist'],
  description: 'View or manage client-side mods for the server',
  data: new SlashCommandBuilder()
    .setName('mods')
    .setDescription('View or manage client-side mods for the server')
    .addSubcommand(sub =>
      sub.setName('list')
        .setDescription('View all client-side mods')
        .addStringOption(opt => opt.setName('server').setDescription('The server name')))
    .addSubcommand(sub =>
      sub.setName('add')
        .setDescription('Add a mod (admin)')
        .addStringOption(opt => opt.setName('name').setDescription('Mod name').setRequired(true))
        .addStringOption(opt => opt.setName('description').setDescription('Mod description'))
        .addStringOption(opt => opt.setName('url').setDescription('Download URL'))
        .addBooleanOption(opt => opt.setName('required').setDescription('Whether the mod is required'))
        .addStringOption(opt => opt.setName('server').setDescription('The server name')))
    .addSubcommand(sub =>
      sub.setName('remove')
        .setDescription('Remove a mod (admin)')
        .addStringOption(opt => opt.setName('name').setDescription('Mod name').setRequired(true))
        .addStringOption(opt => opt.setName('server').setDescription('The server name')))
    .addSubcommand(sub =>
      sub.setName('delete')
        .setDescription('Remove a mod (alias for remove)')
        .addStringOption(opt => opt.setName('name').setDescription('Mod name').setRequired(true))
        .addStringOption(opt => opt.setName('server').setDescription('The server name'))),

  async execute(context, args) {
    const isInteraction = !!context.isChatInputCommand?.();
    let sub;

    if (isInteraction) {
      sub = context.options.getSubcommand();
      await context.deferReply();
    } else {
      sub = args[0]?.toLowerCase();
    }

    if (!sub || sub === 'list') return listMods(context, isInteraction ? [] : args.slice(1));
    if (sub === 'add') return addMod(context, isInteraction ? [] : args.slice(1));
    if (sub === 'remove' || sub === 'delete') return removeMod(context, isInteraction ? [] : args.slice(1));

    const helpMsg = [
      '❓ Usage:',
      '`*mods list [server]` — View all client-side mods',
      '`*mods add <name> | <description> | <download_url> | [required/optional] [server]` — Add a mod *(admin)*',
      '`*mods remove <name> [server]` — Remove a mod *(admin)*',
    ].join('\n');

    if (isInteraction) return context.editReply(helpMsg);
    return context.reply(helpMsg);
  }
};

async function listMods(context, args) {
  const isInteraction = !!context.isChatInputCommand?.();
  const serverArg = isInteraction ? context.options.getString('server') : args[0];
  const server = await resolveServer(context, serverArg ? [serverArg] : [], 0);
  if (!server) return;

  const db = getDb();
  const rows = db.prepare(
    `SELECT * FROM mods WHERE guild_id = ? AND server_name = ? ORDER BY required DESC, mod_name ASC`
  ).all(context.guild.id, server.server_name);

  if (!rows.length) {
    const msg = `📭 No mods listed for **${server.server_name}** yet.\nAdmins can use \`*mods add\` to add one.`;
    return isInteraction ? context.editReply(msg) : context.reply(msg);
  }

  const required = rows.filter(r => r.required);
  const optional = rows.filter(r => !r.required);

  const embed = new EmbedBuilder()
    .setTitle(`🧩 ${server.server_name} — Client Mods`)
    .setColor(0x5865F2)
    .setDescription('These are mods you need (or can use) to play on this server.');

  if (required.length) {
    embed.addFields({
      name: '🔴 Required (must install to join)',
      value: required.map(m => {
        let line = `**${m.mod_name}**`;
        if (m.description) line += ` — ${m.description}`;
        if (m.download_url) line += `\n  [⬇️ Download](${m.download_url})`;
        return line;
      }).join('\n\n')
    });
  }

  if (optional.length) {
    embed.addFields({
      name: '🟡 Optional (recommended)',
      value: optional.map(m => {
        let line = `**${m.mod_name}**`;
        if (m.description) line += ` — ${m.description}`;
        if (m.download_url) line += `\n  [⬇️ Download](${m.download_url})`;
        return line;
      }).join('\n\n')
    });
  }

  embed.setFooter({ text: `${rows.length} mod(s) listed • Added by server admins` });
  
  if (isInteraction) {
    await context.editReply({ embeds: [embed] });
  } else {
    context.channel.send({ embeds: [embed] });
  }
}

async function addMod(context, args) {
  const isInteraction = !!context.isChatInputCommand?.();
  let modName, description, downloadUrl, required, serverName;

  if (isInteraction) {
    modName = context.options.getString('name');
    description = context.options.getString('description') || null;
    downloadUrl = context.options.getString('url') || null;
    required = context.options.getBoolean('required') ? 1 : 0;
    serverName = context.options.getString('server');
  } else {
    const fullInput = args.join(' ');
    const parts = fullInput.split('|').map(s => s.trim());

    if (parts.length < 1 || !parts[0]) {
      return context.reply([
        '❌ Usage: `*mods add <name> | <description> | <download_url> | [required/optional] [server]`',
        'Example: `*mods add Sodium | Performance mod | https://modrinth.com/mod/sodium | optional`',
        'Description, URL and required/optional are all optional fields.',
      ].join('\n'));
    }

    modName = parts[0];
    description = parts[1] || null;
    downloadUrl = parts[2] || null;
    const lastPart = parts[3]?.toLowerCase() || '';
    required = lastPart.includes('required') ? 1 : 0;

    serverName = (!lastPart || lastPart.includes('required') || lastPart.includes('optional'))
      ? parts[4] || null
      : parts[3] || null;
  }

  const server = await resolveServer(context, serverName ? [serverName] : [], 0);
  if (!server) return;

  const member = isInteraction ? context.member : context.member;
  if (!await canManageSMP(member, server.server_name)) {
    const msg = '❌ You need SMP Manager permissions to add mods.';
    return isInteraction ? context.editReply(msg) : context.reply(msg);
  }

  const db = getDb();
  const existing = db.prepare(
    `SELECT id FROM mods WHERE guild_id = ? AND server_name = ? AND LOWER(mod_name) = LOWER(?)`
  ).get(context.guild.id, server.server_name, modName);

  if (existing) {
    const msg = `❌ **${modName}** is already in the mod list for **${server.server_name}**.`;
    return isInteraction ? context.editReply(msg) : context.reply(msg);
  }

  const author = isInteraction ? context.user : context.author;

  db.prepare(
    `INSERT INTO mods (guild_id, server_name, mod_name, description, download_url, required, added_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(context.guild.id, server.server_name, modName, description, downloadUrl, required, author.username);
  save();

  const embed = new EmbedBuilder()
    .setColor(0x44ff88)
    .setDescription([
      `✅ Added **${modName}** to **${server.server_name}**`,
      description ? `📝 ${description}` : '',
      downloadUrl ? `🔗 [Download](${downloadUrl})` : '',
      `📌 ${required ? '🔴 Required' : '🟡 Optional'}`,
    ].filter(Boolean).join('\n'));

  if (isInteraction) {
    await context.editReply({ embeds: [embed] });
  } else {
    context.channel.send({ embeds: [embed] });
  }
}

async function removeMod(context, args) {
  const isInteraction = !!context.isChatInputCommand?.();
  let modName, serverName;

  if (isInteraction) {
    modName = context.options.getString('name');
    serverName = context.options.getString('server');
  } else {
    if (!args.length)
      return context.reply('❌ Usage: `*mods remove <mod name> [server]`');
    serverName = args[args.length - 1];
    modName = args.slice(0, -1).join(' ') || args[0];
  }

  const server = await resolveServer(context, serverName ? [serverName] : [], 0);
  if (!server) return;

  const member = isInteraction ? context.member : context.member;
  if (!await canManageSMP(member, server.server_name)) {
    const msg = '❌ You need SMP Manager permissions to remove mods.';
    return isInteraction ? context.editReply(msg) : context.reply(msg);
  }

  const db = getDb();
  const actualModName = isInteraction ? modName : (args.length > 1 ? args.slice(0, -1).join(' ') : args[0]);

  const existing = db.prepare(
    `SELECT id FROM mods WHERE guild_id = ? AND server_name = ? AND LOWER(mod_name) = LOWER(?)`
  ).get(context.guild.id, server.server_name, actualModName);

  if (!existing) {
    const msg = `❌ No mod named **${actualModName}** found in **${server.server_name}**.`;
    return isInteraction ? context.editReply(msg) : context.reply(msg);
  }

  db.prepare(
    `DELETE FROM mods WHERE guild_id = ? AND server_name = ? AND LOWER(mod_name) = LOWER(?)`
  ).run(context.guild.id, server.server_name, actualModName);
  save();

  const successMsg = `🗑️ Removed **${actualModName}** from **${server.server_name}**.`;
  return isInteraction ? context.editReply(successMsg) : context.reply(successMsg);
}
