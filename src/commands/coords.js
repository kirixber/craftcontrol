const { getDb, save } = require('../db/database');
const { resolveServer } = require('../utils/resolveServer');
const { EmbedBuilder } = require('discord.js');

const DIMENSIONS = ['overworld', 'nether', 'end'];
const DIMENSION_EMOJI = { overworld: '🌿', nether: '🔥', end: '🌌' };

module.exports = {
  name: 'coords',
  aliases: ['c'],
  description: 'Manage shared SMP coordinates',

  async execute(message, args) {
    const sub = args[0]?.toLowerCase();
    if (!sub || sub === 'list') return listCoords(message, args.slice(1));
    if (sub === 'add') return addCoords(message, args.slice(1));
    if (sub === 'delete' || sub === 'remove') return deleteCoords(message, args.slice(1));

    message.reply(
      '❓ Usage:\n' +
      '`*coords list [server]`\n' +
      '`*coords add <n> <x> <y> <z> [dim] [server]`\n' +
      '`*coords delete <n> [server]`'
    );
  }
};

async function listCoords(message, args) {
  const server = await resolveServer(message, args, 0);
  if (!server) return;

  const db = await getDb();
  const result = db.exec(
    `SELECT * FROM coords WHERE guild_id = ? AND server_name = ? ORDER BY dimension, name`,
    [message.guild.id, server.server_name]
  );

  if (!result.length || !result[0].values.length)
    return message.reply(`📭 No coords saved for **${server.server_name}** yet. Use \`*coords add\` to add one!`);

  const cols = result[0].columns;
  const rows = result[0].values.map(v => Object.fromEntries(cols.map((c, i) => [c, v[i]])));

  const grouped = {};
  for (const row of rows) {
    if (!grouped[row.dimension]) grouped[row.dimension] = [];
    grouped[row.dimension].push(row);
  }

  const embed = new EmbedBuilder()
    .setTitle(`📍 ${server.server_name} — Coordinates`)
    .setColor(0xf0a500);

  for (const [dim, entries] of Object.entries(grouped)) {
    const emoji = DIMENSION_EMOJI[dim] || '📌';
    const lines = entries.map(e => `**${e.name}** — \`${e.x}, ${e.y}, ${e.z}\` *(by ${e.added_by})*`);
    embed.addFields({ name: `${emoji} ${dim.charAt(0).toUpperCase() + dim.slice(1)}`, value: lines.join('\n') });
  }

  message.channel.send({ embeds: [embed] });
}

async function addCoords(message, args) {
  // *coords add <n> <x> <y> <z> [dim] [server]
  if (args.length < 4)
    return message.reply('❌ Usage: `*coords add <n> <x> <y> <z> [overworld/nether/end] [server]`');

  const [name, rawX, rawY, rawZ] = args;
  const x = parseInt(rawX), y = parseInt(rawY), z = parseInt(rawZ);

  if (isNaN(x) || isNaN(y) || isNaN(z))
    return message.reply('❌ Coordinates must be numbers. Example: `*coords add Base 100 64 -200`');

  // 5th arg: dimension or server name
  // 6th arg: server name (if dim was provided)
  let dimension = 'overworld';
  let serverArg = null;

  if (args[4]) {
    if (DIMENSIONS.includes(args[4].toLowerCase())) {
      dimension = args[4].toLowerCase();
      serverArg = args[5] || null;
    } else {
      serverArg = args[4];
    }
  }

  const server = await resolveServer(message, serverArg ? [serverArg] : [], 0);
  if (!server) return;

  const db = await getDb();
  const existing = db.exec(
    `SELECT id FROM coords WHERE guild_id = ? AND server_name = ? AND LOWER(name) = LOWER(?)`,
    [message.guild.id, server.server_name, name]
  );
  if (existing.length && existing[0].values.length)
    return message.reply(`❌ A coord named **${name}** already exists on **${server.server_name}**.`);

  db.run(
    `INSERT INTO coords (guild_id, server_name, name, x, y, z, dimension, added_by, added_by_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [message.guild.id, server.server_name, name, x, y, z, dimension, message.author.username, message.author.id]
  );
  save();

  const emoji = DIMENSION_EMOJI[dimension];
  message.reply(`✅ Saved **${name}** at \`${x}, ${y}, ${z}\` in ${emoji} ${dimension} on **${server.server_name}**!`);
}

async function deleteCoords(message, args) {
  if (!args[0]) return message.reply('❌ Usage: `*coords delete <n> [server]`');

  const serverArg = args[args.length - 1];
  const server = await resolveServer(message, [serverArg], 0);
  if (!server) return;

  const name = args.slice(0, -1).join(' ') || args[0];
  const db = await getDb();

  const result = db.exec(
    `SELECT * FROM coords WHERE guild_id = ? AND server_name = ? AND LOWER(name) = LOWER(?)`,
    [message.guild.id, server.server_name, name]
  );

  if (!result.length || !result[0].values.length)
    return message.reply(`❌ No coord named **${name}** found on **${server.server_name}**.`);

  const cols = result[0].columns;
  const row = Object.fromEntries(cols.map((c, i) => [c, result[0].values[0][i]]));

  const isAdmin = message.member.permissions.has('Administrator');
  const isOwner = row.added_by_id === message.author.id;

  if (!isAdmin && !isOwner)
    return message.reply(`❌ You can only delete coords you added. **${name}** was added by ${row.added_by}.`);

  db.run(
    `DELETE FROM coords WHERE guild_id = ? AND server_name = ? AND LOWER(name) = LOWER(?)`,
    [message.guild.id, server.server_name, name]
  );
  save();

  message.reply(`🗑️ Deleted **${name}** from **${server.server_name}**.`);
}
