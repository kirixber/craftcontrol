const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { getDb, save } = require('../db/database');
const { resolveServer } = require('../utils/resolveServer');
const { canManageSMP } = require('../utils/permissions');

const DIMENSIONS = ['overworld', 'nether', 'end'];
const DIMENSION_EMOJI = { overworld: '🌿', nether: '🔥', end: '🌌' };

module.exports = {
  name: 'coords',
  aliases: ['c'],
  description: 'Manage shared SMP coordinates',
  data: new SlashCommandBuilder()
    .setName('coords')
    .setDescription('Manage shared SMP coordinates')
    .addSubcommand(sub =>
      sub.setName('list')
        .setDescription('List all saved coordinates')
        .addStringOption(opt => opt.setName('server').setDescription('The server name')))
    .addSubcommand(sub =>
      sub.setName('add')
        .setDescription('Add a new coordinate')
        .addStringOption(opt => opt.setName('name').setDescription('Name of the location').setRequired(true))
        .addIntegerOption(opt => opt.setName('x').setDescription('X coordinate').setRequired(true))
        .addIntegerOption(opt => opt.setName('y').setDescription('Y coordinate').setRequired(true))
        .addIntegerOption(opt => opt.setName('z').setDescription('Z coordinate').setRequired(true))
        .addStringOption(opt => opt.setName('dimension').setDescription('The dimension').addChoices(
          { name: 'Overworld', value: 'overworld' },
          { name: 'Nether', value: 'nether' },
          { name: 'End', value: 'end' }
        ))
        .addStringOption(opt => opt.setName('server').setDescription('The server name')))
    .addSubcommand(sub =>
      sub.setName('delete')
        .setDescription('Delete a saved coordinate')
        .addStringOption(opt => opt.setName('name').setDescription('Name of the location').setRequired(true))
        .addStringOption(opt => opt.setName('server').setDescription('The server name')))
    .addSubcommand(sub =>
      sub.setName('remove')
        .setDescription('Delete a saved coordinate (alias for delete)')
        .addStringOption(opt => opt.setName('name').setDescription('Name of the location').setRequired(true))
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

    if (!sub || sub === 'list') return listCoords(context, isInteraction ? [] : args.slice(1));
    if (sub === 'add') return addCoords(context, isInteraction ? [] : args.slice(1));
    if (sub === 'delete' || sub === 'remove') return deleteCoords(context, isInteraction ? [] : args.slice(1));

    const helpMsg = '❓ Usage:\n' +
      '`*coords list [server]`\n' +
      '`*coords add <n> <x> <y> <z> [dim] [server]`\n' +
      '`*coords delete <n> [server]`';
    
    if (isInteraction) return context.editReply(helpMsg);
    return context.reply(helpMsg);
  }
};

async function listCoords(context, args) {
  const isInteraction = !!context.isChatInputCommand?.();
  const serverArg = isInteraction ? context.options.getString('server') : args[0];
  const server = await resolveServer(context, serverArg ? [serverArg] : [], 0);
  if (!server) return;

  const db = getDb();
  const rows = db.prepare(
    `SELECT * FROM coords WHERE guild_id = ? AND server_name = ? ORDER BY dimension, name`
  ).all(context.guild.id, server.server_name);

  if (!rows.length) {
    const msg = `📭 No coords saved for **${server.server_name}** yet. Use \`*coords add\` to add one!`;
    return isInteraction ? context.editReply(msg) : context.reply(msg);
  }

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

  if (isInteraction) {
    await context.editReply({ embeds: [embed] });
  } else {
    context.channel.send({ embeds: [embed] });
  }
}

async function addCoords(context, args) {
  const isInteraction = !!context.isChatInputCommand?.();
  let name, x, y, z, dimension, serverName;

  if (isInteraction) {
    name = context.options.getString('name');
    x = context.options.getInteger('x');
    y = context.options.getInteger('y');
    z = context.options.getInteger('z');
    dimension = context.options.getString('dimension') || 'overworld';
    serverName = context.options.getString('server');
  } else {
    if (args.length < 4)
      return context.reply('❌ Usage: `*coords add <n> <x> <y> <z> [overworld/nether/end] [server]`');

    [name, x, y, z] = args;
    x = parseInt(x);
    y = parseInt(y);
    z = parseInt(z);

    if (isNaN(x) || isNaN(y) || isNaN(z))
      return context.reply('❌ Coordinates must be numbers. Example: `*coords add Base 100 64 -200`');

    dimension = 'overworld';
    let serverPart = null;

    if (args[4]) {
      if (DIMENSIONS.includes(args[4].toLowerCase())) {
        dimension = args[4].toLowerCase();
        serverPart = args[5] || null;
      } else {
        serverPart = args[4];
      }
    }
    serverName = serverPart;
  }

  const server = await resolveServer(context, serverName ? [serverName] : [], 0);
  if (!server) return;

  const db = getDb();
  const existing = db.prepare(
    `SELECT id FROM coords WHERE guild_id = ? AND server_name = ? AND LOWER(name) = LOWER(?)`
  ).get(context.guild.id, server.server_name, name);

  if (existing) {
    const msg = `❌ A coord named **${name}** already exists on **${server.server_name}**.`;
    return isInteraction ? context.editReply(msg) : context.reply(msg);
  }

  const author = isInteraction ? context.user : context.author;

  db.prepare(
    `INSERT INTO coords (guild_id, server_name, name, x, y, z, dimension, added_by, added_by_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(context.guild.id, server.server_name, name, x, y, z, dimension, author.username, author.id);
  save();

  const emoji = DIMENSION_EMOJI[dimension];
  const successMsg = `✅ Saved **${name}** at \`${x}, ${y}, ${z}\` in ${emoji} ${dimension} on **${server.server_name}**!`;
  return isInteraction ? context.editReply(successMsg) : context.reply(successMsg);
}

async function deleteCoords(context, args) {
  const isInteraction = !!context.isChatInputCommand?.();
  let name, serverName;

  if (isInteraction) {
    name = context.options.getString('name');
    serverName = context.options.getString('server');
  } else {
    if (!args[0]) return context.reply('❌ Usage: `*coords delete <n> [server]`');
    const serverArg = args[args.length - 1];
    // Need to check if serverArg is actually a server name or part of the name
    // Original code: const server = await resolveServer(message, [serverArg], 0);
    // This implies it tries to resolve it from the last arg.
    serverName = serverArg;
    name = args.slice(0, -1).join(' ') || args[0];
  }

  const server = await resolveServer(context, serverName ? [serverName] : [], 0);
  if (!server) return;

  // If not interaction, we might have mis-identified name and server if server wasn't provided
  // But resolveServer handles the case where it might be null.
  // Wait, if server wasn't provided, serverArg would be the name.
  // Original code: const name = args.slice(0, -1).join(' ') || args[0];
  // If args.length is 1, name = args[0]. serverArg = args[0].
  // If resolveServer(message, [args[0]], 0) finds a server, then name is ""? 
  // No, `args.slice(0, -1).join(' ') || args[0]` means if slice is empty, use args[0].
  
  const db = getDb();
  const actualName = isInteraction ? name : (args.length > 1 ? args.slice(0, -1).join(' ') : args[0]);

  const row = db.prepare(
    `SELECT * FROM coords WHERE guild_id = ? AND server_name = ? AND LOWER(name) = LOWER(?)`
  ).get(context.guild.id, server.server_name, actualName);

  if (!row) {
    const msg = `❌ No coord named **${actualName}** found on **${server.server_name}**.`;
    return isInteraction ? context.editReply(msg) : context.reply(msg);
  }

  const member = isInteraction ? context.member : context.member;
  const author = isInteraction ? context.user : context.author;

  const isManager = await canManageSMP(member, server.server_name);
  const isOwner = row.added_by_id === author.id;

  if (!isManager && !isOwner) {
    const msg = `❌ You can only delete coords you added. **${actualName}** was added by ${row.added_by}.`;
    return isInteraction ? context.editReply(msg) : context.reply(msg);
  }

  db.prepare(
    `DELETE FROM coords WHERE guild_id = ? AND server_name = ? AND LOWER(name) = LOWER(?)`
  ).run(context.guild.id, server.server_name, actualName);
  save();

  const successMsg = `🗑️ Deleted **${actualName}** from **${server.server_name}**.`;
  return isInteraction ? context.editReply(successMsg) : context.reply(successMsg);
}
