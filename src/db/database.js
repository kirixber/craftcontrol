const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../../data/smp.db');

let db;

async function getDb() {
  if (db) return db;

  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS servers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      server_name TEXT NOT NULL,
      java_ip TEXT,
      java_port TEXT DEFAULT '25565',
      bedrock_ip TEXT,
      bedrock_port TEXT DEFAULT '19132',
      version TEXT,
      rcon_host TEXT,
      rcon_port TEXT DEFAULT '25575',
      rcon_password TEXT,
      local_ip TEXT,
      UNIQUE(guild_id, server_name)
    )
  `);

  // Migrate existing DBs
  try { db.run(`ALTER TABLE servers ADD COLUMN local_ip TEXT`); } catch {}

  db.run(`
    CREATE TABLE IF NOT EXISTS coords (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      server_name TEXT NOT NULL,
      name TEXT NOT NULL,
      x INTEGER NOT NULL,
      y INTEGER NOT NULL,
      z INTEGER NOT NULL,
      dimension TEXT DEFAULT 'overworld',
      added_by TEXT NOT NULL,
      added_by_id TEXT NOT NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS mods (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      server_name TEXT NOT NULL,
      mod_name TEXT NOT NULL,
      description TEXT,
      download_url TEXT,
      required INTEGER DEFAULT 0,
      added_by TEXT NOT NULL
    )
  `);

  save();
  return db;
}

function save() {
  if (!db) return;
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

async function getServers(guildId) {
  const db = await getDb();
  const result = db.exec(`SELECT * FROM servers WHERE guild_id = ?`, [guildId]);
  if (!result.length || !result[0].values.length) return [];
  const cols = result[0].columns;
  return result[0].values.map(v => Object.fromEntries(cols.map((c, i) => [c, v[i]])));
}

async function getServer(guildId, serverName = null) {
  const db = await getDb();

  if (serverName) {
    const result = db.exec(
      `SELECT * FROM servers WHERE guild_id = ? AND LOWER(server_name) = LOWER(?)`,
      [guildId, serverName]
    );
    if (!result.length || !result[0].values.length) return null;
    const cols = result[0].columns;
    return Object.fromEntries(cols.map((c, i) => [c, result[0].values[0][i]]));
  }

  const servers = await getServers(guildId);
  if (servers.length === 1) return servers[0];
  if (servers.length === 0) return null;
  return 'multiple';
}

module.exports = { getDb, save, getServers, getServer };
