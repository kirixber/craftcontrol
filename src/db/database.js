const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../../data/smp.db');

let db;

function getDb() {
  if (db) return db;

  const dataDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  db = new Database(DB_PATH);
  
  // Basic optimization
  db.pragma('journal_mode = WAL');

  db.exec(`
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
      manager_role_id TEXT,
      UNIQUE(guild_id, server_name)
    )
  `);

  // Migrations
  const tableInfo = db.prepare("PRAGMA table_info(servers)").all();
  if (!tableInfo.some(col => col.name === 'local_ip')) {
    db.exec("ALTER TABLE servers ADD COLUMN local_ip TEXT");
  }
  if (!tableInfo.some(col => col.name === 'manager_role_id')) {
    db.exec("ALTER TABLE servers ADD COLUMN manager_role_id TEXT");
  }

  db.exec(`
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

  db.exec(`
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

  return db;
}

// Compatibility/Helper functions
function save() {
  // better-sqlite3 saves automatically
  return;
}

function getServers(guildId) {
  const db = getDb();
  return db.prepare(`SELECT * FROM servers WHERE guild_id = ?`).all(guildId);
}

function getServer(guildId, serverName = null) {
  const db = getDb();

  if (serverName) {
    const server = db.prepare(
      `SELECT * FROM servers WHERE guild_id = ? AND LOWER(server_name) = LOWER(?)`
    ).get(guildId, serverName);
    return server || null;
  }

  const servers = getServers(guildId);
  if (servers.length === 1) return servers[0];
  if (servers.length === 0) return null;
  return 'multiple';
}

module.exports = { getDb, save, getServers, getServer };
