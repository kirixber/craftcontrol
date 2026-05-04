const { EmbedBuilder } = require('discord.js');
const { getDb, save } = require('../db/database');
const { resolveServer } = require('../utils/resolveServer');

module.exports = {
  name: 'mods',
  aliases: ['plugins', 'modlist'],
  description: 'View or manage client-side mods for the server',

  async execute(message, args) {
    const sub = args[0]?.toLowerCase();

    if (!sub || sub === 'list') return listMods(message, args.slice(1));
    if (sub === 'add') return addMod(message, args.slice(1));
    if (sub === 'remove' || sub === 'delete') return removeMod(message, args.slice(1));

    message.reply([
      '❓ Usage:',
      '`*mods list [server]` — View all client-side mods',
      '`*mods add <name> | <description> | <download_url> | [required/optional] [server]` — Add a mod *(admin)*',
      '`*mods remove <name> [server]` — Remove a mod *(admin)*',
    ].join('\n'));
  }
};

async function listMods(message, args) {
  const server = await resolveServer(message, args, 0);
  if (!server) return;

  const db = await getDb();
  const result = db.exec(
    `SELECT * FROM mods WHERE guild_id = ? AND server_name = ? ORDER BY required DESC, mod_name ASC`,
    [message.guild.id, server.server_name]
  );

  if (!result.length || !result[0].values.length) {
    return message.reply(`📭 No mods listed for **${server.server_name}** yet.\nAdmins can use \`*mods add\` to add one.`);
  }

  const cols = result[0].columns;
  const rows = result[0].values.map(v => Object.fromEntries(cols.map((c, i) => [c, v[i]])));

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
  message.channel.send({ embeds: [embed] });
}

async function addMod(message, args) {
  if (!message.member.permissions.has('Administrator'))
    return message.reply('❌ You need Administrator permissions to add mods.');

  // Format: *mods add Name | Description | URL | required/optional [server]
  const fullInput = args.join(' ');
  const parts = fullInput.split('|').map(s => s.trim());

  if (parts.length < 1 || !parts[0]) {
    return message.reply([
      '❌ Usage: `*mods add <name> | <description> | <download_url> | [required/optional] [server]`',
      'Example: `*mods add Sodium | Performance mod | https://modrinth.com/mod/sodium | optional`',
      'Description, URL and required/optional are all optional fields.',
    ].join('\n'));
  }

  const modName = parts[0];
  const description = parts[1] || null;
  const downloadUrl = parts[2] || null;
  const lastPart = parts[3]?.toLowerCase() || '';
  const required = lastPart.includes('required') ? 1 : 0;

  // Server name might be last arg if not part of pipe format
  const serverArg = (!lastPart || lastPart.includes('required') || lastPart.includes('optional'))
    ? parts[4] || null
    : parts[3] || null;

  const server = await resolveServer(message, serverArg ? [serverArg] : [], 0);
  if (!server) return;

  const db = await getDb();

  // Check duplicate
  const existing = db.exec(
    `SELECT id FROM mods WHERE guild_id = ? AND server_name = ? AND LOWER(mod_name) = LOWER(?)`,
    [message.guild.id, server.server_name, modName]
  );
  if (existing.length && existing[0].values.length)
    return message.reply(`❌ **${modName}** is already in the mod list for **${server.server_name}**.`);

  db.run(
    `INSERT INTO mods (guild_id, server_name, mod_name, description, download_url, required, added_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [message.guild.id, server.server_name, modName, description, downloadUrl, required, message.author.username]
  );
  save();

  const embed = new EmbedBuilder()
    .setColor(0x44ff88)
    .setDescription([
      `✅ Added **${modName}** to **${server.server_name}**`,
      description ? `📝 ${description}` : '',
      downloadUrl ? `🔗 [Download](${downloadUrl})` : '',
      `📌 ${required ? '🔴 Required' : '🟡 Optional'}`,
    ].filter(Boolean).join('\n'));

  message.channel.send({ embeds: [embed] });
}

async function removeMod(message, args) {
  if (!message.member.permissions.has('Administrator'))
    return message.reply('❌ You need Administrator permissions to remove mods.');

  if (!args.length)
    return message.reply('❌ Usage: `*mods remove <mod name> [server]`');

  // Last arg might be server name
  const server = await resolveServer(message, args.slice(-1), 0);
  if (!server) return;

  const modName = args.slice(0, -1).join(' ') || args[0];
  const db = await getDb();

  const existing = db.exec(
    `SELECT id FROM mods WHERE guild_id = ? AND server_name = ? AND LOWER(mod_name) = LOWER(?)`,
    [message.guild.id, server.server_name, modName]
  );

  if (!existing.length || !existing[0].values.length)
    return message.reply(`❌ No mod named **${modName}** found in **${server.server_name}**.`);

  db.run(
    `DELETE FROM mods WHERE guild_id = ? AND server_name = ? AND LOWER(mod_name) = LOWER(?)`,
    [message.guild.id, server.server_name, modName]
  );
  save();

  message.reply(`🗑️ Removed **${modName}** from **${server.server_name}**.`);
}
