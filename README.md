# 🎮 SMP Bot

A Discord bot for Minecraft SMP servers. Manage server IPs, check status, and save shared coordinates — all from Discord.

Works across multiple servers. Each Discord server gets its own isolated data.

---

## Setup

### 1. Clone & install
```bash
git clone <your-repo>
cd smp-bot
npm install
```

### 2. Create your bot
- Go to https://discord.com/developers/applications
- New Application → Bot → Add Bot
- Copy the **Token**
- Under **Privileged Gateway Intents**, enable **Message Content Intent**
- Under **OAuth2 → URL Generator**, select `bot` with these permissions:
  - Send Messages, Embed Links, Read Message History, Manage Messages

### 3. Configure
```bash
cp .env.example .env
# Edit .env and paste your token
```

### 4. Run
```bash
node index.js
```

### 5. Optional: Run as a systemd service (Linux)
```ini
[Unit]
Description=SMP Discord Bot
After=network.target

[Service]
WorkingDirectory=/path/to/smp-bot
ExecStart=/usr/bin/node index.js
Restart=always
EnvironmentFile=/path/to/smp-bot/.env

[Install]
WantedBy=multi-user.target
```

---

## Commands

| Command | Description |
|---|---|
| `!setup` | Set up the bot for your server (admin only) |
| `!ip` | Show server connection info |
| `!status` | Check if server is online |
| `!coords list` | View all saved waypoints |
| `!coords add <n> <x> <y> <z> [dim]` | Save a location |
| `!coords delete <n>` | Delete a waypoint |
| `!help` | Show all commands |

**Dimensions:** `overworld` (default), `nether`, `end`

---

## Data

All data is stored in `data/smp.db` (SQLite). Back this file up to preserve your coords.
