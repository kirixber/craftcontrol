const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const { rconCommand } = require('../../utils/rcon');
const { resolveServer } = require('../../utils/resolveServer');
const { searchPlugins: searchModrinth, getPluginInfo: getModrinthInfo, getPluginDownloadUrl: getModrinthDownload } = require('../../utils/modrinth');
const { searchPlugins: searchSpiget, getPluginInfo: getSpigetInfo, getPluginDownloadUrl: getSpigetDownload } = require('../../utils/spiget');
const { sshListFiles, sshDelete, sshUpload } = require('../../utils/ssh');
const { ftpListFiles, ftpDelete, ftpUpload, ftpRename } = require('../../utils/ftp');
const { pterodactylListFiles, pterodactylDelete, pterodactylUpload, pterodactylRename } = require('../../utils/pterodactyl');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const TEMP_DIR = path.join(__dirname, '../../../data/temp');

function ensureTempDir() {
  if (!fs.existsSync(TEMP_DIR)) {
    fs.mkdirSync(TEMP_DIR, { recursive: true });
  }
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(dest);

    protocol.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        downloadFile(response.headers.location, dest).then(resolve).catch(reject);
        return;
      }

      if (response.statusCode !== 200) {
        fs.unlinkSync(dest);
        reject(new Error(`Download failed with status ${response.statusCode}`));
        return;
      }

      response.pipe(file);

      file.on('finish', () => {
        file.close();
        resolve(dest);
      });
    }).on('error', (err) => {
      fs.unlinkSync(dest);
      reject(err);
    });
  });
}

function getAccessMethod(server) {
  if (server.pterodactyl_url && server.pterodactyl_api_key && server.pterodactyl_server_id) {
    return 'pterodactyl';
  }
  if (server.ssh_host && server.ssh_username) {
    return 'ssh';
  }
  if (server.ftp_host && server.ftp_username) {
    return 'ftp';
  }
  if (server.rcon_host && server.rcon_password) {
    return 'rcon';
  }
  return null;
}

function getPluginsPath(server) {
  return server.ftp_path || '/plugins';
}

async function listPluginsRcon(server) {
  try {
    const response = await rconCommand(server, 'plugins');
    const plugins = response.replace(/§./g, '').trim();
    return plugins.split(',').map(p => p.trim()).filter(p => p);
  } catch (error) {
    throw new Error('Could not fetch plugins via RCON');
  }
}

async function listPluginsFileAccess(server) {
  const method = getAccessMethod(server);
  const pluginsPath = getPluginsPath(server);

  switch (method) {
    case 'ssh':
      return await sshListFiles(server, pluginsPath);
    case 'ftp':
      return await ftpListFiles(server, pluginsPath);
    case 'pterodactyl':
      return await pterodactylListFiles(server, pluginsPath);
    default:
      throw new Error('No file access method configured');
  }
}

async function deletePluginFileAccess(server, pluginName) {
  const method = getAccessMethod(server);
  const pluginsPath = getPluginsPath(server);
  const pluginPath = `${pluginsPath}/${pluginName}`;

  switch (method) {
    case 'ssh':
      return await sshDelete(server, pluginPath);
    case 'ftp':
      return await ftpDelete(server, pluginPath);
    case 'pterodactyl':
      return await pterodactylDelete(server, pluginPath);
    default:
      throw new Error('No file access method configured');
  }
}

async function enablePluginFileAccess(server, pluginName) {
  const method = getAccessMethod(server);
  const pluginsPath = getPluginsPath(server);
  const disabledPath = `${pluginsPath}/disabled`;
  const fromPath = `${disabledPath}/${pluginName}`;
  const toPath = `${pluginsPath}/${pluginName}`;

  switch (method) {
    case 'ssh':
      await sshCommand(server, `mkdir -p "${disabledPath}"`);
      await sshCommand(server, `mv "${fromPath}" "${toPath}"`);
      return true;
    case 'ftp':
      return await ftpRename(server, fromPath, toPath);
    case 'pterodactyl':
      return await pterodactylRename(server, fromPath, toPath);
    default:
      throw new Error('No file access method configured');
  }
}

async function disablePluginFileAccess(server, pluginName) {
  const method = getAccessMethod(server);
  const pluginsPath = getPluginsPath(server);
  const disabledPath = `${pluginsPath}/disabled`;
  const fromPath = `${pluginsPath}/${pluginName}`;
  const toPath = `${disabledPath}/${pluginName}`;

  switch (method) {
    case 'ssh':
      await sshCommand(server, `mkdir -p "${disabledPath}"`);
      await sshCommand(server, `mv "${fromPath}" "${toPath}"`);
      return true;
    case 'ftp':
      return await ftpRename(server, fromPath, toPath);
    case 'pterodactyl':
      return await pterodactylRename(server, fromPath, toPath);
    default:
      throw new Error('No file access method configured');
  }
}

async function installPluginFileAccess(server, url, pluginName) {
  const method = getAccessMethod(server);
  const pluginsPath = getPluginsPath(server);

  ensureTempDir();
  const tempFile = path.join(TEMP_DIR, `${Date.now()}_${pluginName}.jar`);

  try {
    await downloadFile(url, tempFile);

    switch (method) {
      case 'ssh':
        await sshUpload(server, tempFile, `${pluginsPath}/${pluginName}`);
        break;
      case 'ftp':
        await ftpUpload(server, tempFile, `${pluginsPath}/${pluginName}`);
        break;
      case 'pterodactyl':
        const buffer = fs.readFileSync(tempFile);
        await pterodactylUpload(server, pluginName, buffer);
        break;
      default:
        throw new Error('No file access method configured');
    }

    fs.unlinkSync(tempFile);
    return true;
  } catch (error) {
    if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
    throw error;
  }
}

module.exports = {
  name: 'plugins',
  aliases: ['pl', 'plugin'],
  description: 'Manage server plugins',

  async execute(message, args) {
    if (!message.member.permissions.has('Administrator'))
      return message.reply('❌ You need Administrator permissions to manage plugins.');

    const sub = args[0]?.toLowerCase();

    if (!sub || sub === 'list') return listPlugins(message, args.slice(1));
    if (sub === 'info') return pluginInfo(message, args.slice(1));
    if (sub === 'search') return searchPlugins(message, args.slice(1));
    if (sub === 'install') return installPlugin(message, args.slice(1));
    if (sub === 'remove' || sub === 'delete') return removePlugin(message, args.slice(1));
    if (sub === 'enable') return enablePlugin(message, args.slice(1));
    if (sub === 'disable') return disablePlugin(message, args.slice(1));
    if (sub === 'help') return showHelp(message);

    message.reply([
      '❓ Usage:',
      '`*plugins list [server]` — List installed plugins',
      '`*plugins info <plugin> [server]` — Get plugin details',
      '`*plugins search <query>` — Search for plugins on Modrinth/Spigot',
      '`*plugins install <url> [name] [server]` — Install a plugin from URL',
      '`*plugins remove <plugin> [server]` — Remove a plugin',
      '`*plugins enable <plugin> [server]` — Enable a disabled plugin',
      '`*plugins disable <plugin> [server]` — Disable a plugin',
    ].join('\n'));
  }
};

async function listPlugins(message, args) {
  const server = await resolveServer(message, args, 0);
  if (!server) return;

  const accessMethod = getAccessMethod(server);

  if (!accessMethod) {
    return message.reply(
      '❌ No access method configured. Run `*setup` and configure SSH, FTP, or Pterodactyl for full plugin management.\n\n' +
      'Basic plugin listing via RCON is available if RCON is configured.'
    );
  }

  const checking = await message.channel.send(`📦 Fetching plugins for **${server.server_name}**...`);

  try {
    let plugins = [];

    if (accessMethod === 'rcon') {
      plugins = await listPluginsRcon(server);
    } else {
      plugins = await listPluginsFileAccess(server);
    }

    await checking.delete();

    if (!plugins || plugins.length === 0) {
      return message.reply(`📭 No plugins found on **${server.server_name}**.`);
    }

    const methodEmoji = {
      ssh: '🔐',
      ftp: '📡',
      pterodactyl: '🐉',
      rcon: '🎮',
    };

    const embed = new EmbedBuilder()
      .setTitle(`📦 ${server.server_name} — Plugins`)
      .setColor(0x5865F2)
      .setDescription(`Found **${plugins.length}** plugin(s) via ${methodEmoji[accessMethod]} ${accessMethod.toUpperCase()}`)
      .addFields({
        name: 'Installed Plugins',
        value: plugins.map(p => `• \`${p}\``).join('\n').slice(0, 1024),
      })
      .setFooter({ text: accessMethod === 'rcon' ? 'RCON only shows loaded plugins. Use SSH/FTP/Pterodactyl for full file access.' : '' });

    message.channel.send({ embeds: [embed] });
  } catch (error) {
    await checking.delete();
    console.error('List plugins error:', error);
    message.reply(`⚠️ Could not fetch plugins: ${error.message}`);
  }
}

async function pluginInfo(message, args) {
  if (!args[0]) return message.reply('❌ Usage: `*plugins info <plugin> [server]`');

  const server = await resolveServer(message, args.slice(-1), 0);
  if (!server) return;

  const pluginName = args.slice(0, -1).join(' ') || args[0];
  const accessMethod = getAccessMethod(server);

  if (!accessMethod) {
    return message.reply('❌ No access method configured. Run `*setup` and configure SSH, FTP, or Pterodactyl.');
  }

  const checking = await message.channel.send(`🔍 Looking up **${pluginName}** on **${server.server_name}**...`);

  try {
    let plugins = [];

    if (accessMethod === 'rcon') {
      plugins = await listPluginsRcon(server);
    } else {
      plugins = await listPluginsFileAccess(server);
    }

    await checking.delete();

    const found = plugins.find(p => p.toLowerCase().includes(pluginName.toLowerCase()));

    if (!found) {
      return message.reply(`❌ Plugin **${pluginName}** not found on **${server.server_name}**.`);
    }

    const embed = new EmbedBuilder()
      .setTitle(`📦 ${found}`)
      .setColor(0x5865F2)
      .setDescription(`Plugin found on **${server.server_name}**`)
      .addFields(
        { name: 'Status', value: '✅ Installed', inline: true },
        { name: 'Access Method', value: accessMethod.toUpperCase(), inline: true },
      );

    message.channel.send({ embeds: [embed] });
  } catch (error) {
    await checking.delete();
    console.error('Plugin info error:', error);
    message.reply(`⚠️ Could not fetch plugin info: ${error.message}`);
  }
}

async function searchPlugins(message, args) {
  if (!args[0]) return message.reply('❌ Usage: `*plugins search <query>`');

  const query = args.join(' ');
  const checking = await message.channel.send(`🔍 Searching for **${query}** on Modrinth and Spigot...`);

  try {
    const [modrinthResults, spigetResults] = await Promise.all([
      searchModrinth(query, 5),
      searchSpiget(query, 5),
    ]);

    await checking.delete();

    const embed = new EmbedBuilder()
      .setTitle(`🔍 Search Results: ${query}`)
      .setColor(0x5865F2)
      .setDescription('Found plugins from Modrinth and Spigot');

    if (modrinthResults.length > 0) {
      embed.addFields({
        name: '🟦 Modrinth',
        value: modrinthResults.map(p => {
          const line = `**[${p.title}](https://modrinth.com/plugin/${p.slug})**`;
          const desc = p.description ? ` — ${p.description.slice(0, 50)}...` : '';
          const dl = p.downloads ? ` (${(p.downloads / 1000000).toFixed(1)}M downloads)` : '';
          return `${line}${desc}${dl}`;
        }).join('\n'),
      });
    }

    if (spigetResults.length > 0) {
      embed.addFields({
        name: '🟨 Spigot',
        value: spigetResults.map(p => {
          const line = `**[${p.name}](${p.url})**`;
          const desc = p.tag ? ` — ${p.tag.slice(0, 50)}...` : '';
          const dl = p.downloads ? ` (${(p.downloads / 1000).toFixed(1)}K downloads)` : '';
          return `${line}${desc}${dl}`;
        }).join('\n'),
      });
    }

    if (modrinthResults.length === 0 && spigetResults.length === 0) {
      embed.setDescription('No plugins found. Try a different search term.');
    }

    embed.setFooter({ text: 'Use *plugins install <url> to install a plugin' });

    message.channel.send({ embeds: [embed] });
  } catch (error) {
    await checking.delete();
    console.error('Search plugins error:', error);
    message.reply(`⚠️ Could not search plugins: ${error.message}`);
  }
}

async function installPlugin(message, args) {
  if (!args[0]) return message.reply('❌ Usage: `*plugins install <url> [name] [server]`');

  const url = args[0];
  let pluginName = args[1];
  const serverArg = args[2] || null;

  const server = await resolveServer(message, serverArg ? [serverArg] : [], 0);
  if (!server) return;

  const accessMethod = getAccessMethod(server);

  if (!accessMethod || accessMethod === 'rcon') {
    return message.reply(
      '❌ File access required for plugin installation. Run `*setup` and configure SSH, FTP, or Pterodactyl.\n\n' +
      'For free hosting (Aternos, etc.), you\'ll need to manually upload the plugin file.'
    );
  }

  if (!pluginName) {
    const urlParts = url.split('/');
    pluginName = urlParts[urlParts.length - 1].replace(/\?.*$/, '');
  }

  if (!pluginName.endsWith('.jar')) {
    pluginName += '.jar';
  }

  const checking = await message.channel.send(`📥 Installing **${pluginName}** to **${server.server_name}**...`);

  try {
    await installPluginFileAccess(server, url, pluginName);

    await checking.delete();

    const embed = new EmbedBuilder()
      .setTitle(`✅ Plugin Installed`)
      .setColor(0x44ff88)
      .setDescription(`**${pluginName}** has been installed on **${server.server_name}**`)
      .addFields(
        { name: 'Source', value: url.slice(0, 50) + (url.length > 50 ? '...' : ''), inline: true },
        { name: 'Method', value: accessMethod.toUpperCase(), inline: true },
      )
      .setFooter({ text: 'Restart your server to load the new plugin' });

    message.channel.send({ embeds: [embed] });
  } catch (error) {
    await checking.delete();
    console.error('Install plugin error:', error);
    message.reply(`⚠️ Could not install plugin: ${error.message}`);
  }
}

async function removePlugin(message, args) {
  if (!args[0]) return message.reply('❌ Usage: `*plugins remove <plugin> [server]`');

  const server = await resolveServer(message, args.slice(-1), 0);
  if (!server) return;

  const pluginName = args.slice(0, -1).join(' ') || args[0];
  const accessMethod = getAccessMethod(server);

  if (!accessMethod || accessMethod === 'rcon') {
    return message.reply(
      '❌ File access required for plugin removal. Run `*setup` and configure SSH, FTP, or Pterodactyl.'
    );
  }

  const checking = await message.channel.send(`🗑️ Removing **${pluginName}** from **${server.server_name}**...`);

  try {
    await deletePluginFileAccess(server, pluginName);

    await checking.delete();

    const embed = new EmbedBuilder()
      .setTitle(`✅ Plugin Removed`)
      .setColor(0x44ff88)
      .setDescription(`**${pluginName}** has been removed from **${server.server_name}**`)
      .setFooter({ text: 'Restart your server to apply changes' });

    message.channel.send({ embeds: [embed] });
  } catch (error) {
    await checking.delete();
    console.error('Remove plugin error:', error);
    message.reply(`⚠️ Could not remove plugin: ${error.message}`);
  }
}

async function enablePlugin(message, args) {
  if (!args[0]) return message.reply('❌ Usage: `*plugins enable <plugin> [server]`');

  const server = await resolveServer(message, args.slice(-1), 0);
  if (!server) return;

  const pluginName = args.slice(0, -1).join(' ') || args[0];
  const accessMethod = getAccessMethod(server);

  if (!accessMethod || accessMethod === 'rcon') {
    return message.reply(
      '❌ File access required to enable plugins. Run `*setup` and configure SSH, FTP, or Pterodactyl.'
    );
  }

  const checking = await message.channel.send(`✅ Enabling **${pluginName}** on **${server.server_name}**...`);

  try {
    await enablePluginFileAccess(server, pluginName);

    await checking.delete();

    const embed = new EmbedBuilder()
      .setTitle(`✅ Plugin Enabled`)
      .setColor(0x44ff88)
      .setDescription(`**${pluginName}** has been enabled on **${server.server_name}**`)
      .setFooter({ text: 'Restart your server to load the plugin' });

    message.channel.send({ embeds: [embed] });
  } catch (error) {
    await checking.delete();
    console.error('Enable plugin error:', error);
    message.reply(`⚠️ Could not enable plugin: ${error.message}`);
  }
}

async function disablePlugin(message, args) {
  if (!args[0]) return message.reply('❌ Usage: `*plugins disable <plugin> [server]`');

  const server = await resolveServer(message, args.slice(-1), 0);
  if (!server) return;

  const pluginName = args.slice(0, -1).join(' ') || args[0];
  const accessMethod = getAccessMethod(server);

  if (!accessMethod || accessMethod === 'rcon') {
    return message.reply(
      '❌ File access required to disable plugins. Run `*setup` and configure SSH, FTP, or Pterodactyl.'
    );
  }

  const checking = await message.channel.send(`⏸️ Disabling **${pluginName}** on **${server.server_name}**...`);

  try {
    await disablePluginFileAccess(server, pluginName);

    await checking.delete();

    const embed = new EmbedBuilder()
      .setTitle(`⏸️ Plugin Disabled`)
      .setColor(0xffaa00)
      .setDescription(`**${pluginName}** has been disabled on **${server.server_name}**`)
      .setFooter({ text: 'Restart your server to apply changes' });

    message.channel.send({ embeds: [embed] });
  } catch (error) {
    await checking.delete();
    console.error('Disable plugin error:', error);
    message.reply(`⚠️ Could not disable plugin: ${error.message}`);
  }
}

async function showHelp(message) {
  const embed = new EmbedBuilder()
    .setTitle('📦 Plugin Management Help')
    .setColor(0x5865F2)
    .setDescription('Manage your Minecraft server plugins directly from Discord')
    .addFields(
      {
        name: '📋 List Plugins',
        value: '`*plugins list [server]` — Show all installed plugins',
        inline: false,
      },
      {
        name: '🔍 Search Plugins',
        value: '`*plugins search <query>` — Search Modrinth and Spigot for plugins',
        inline: false,
      },
      {
        name: '📥 Install Plugin',
        value: '`*plugins install <url> [name] [server]` — Install from direct download URL',
        inline: false,
      },
      {
        name: '🗑️ Remove Plugin',
        value: '`*plugins remove <plugin> [server]` — Delete a plugin file',
        inline: false,
      },
      {
        name: '✅ Enable Plugin',
        value: '`*plugins enable <plugin> [server]` — Move from disabled folder',
        inline: false,
      },
      {
        name: '⏸️ Disable Plugin',
        value: '`*plugins disable <plugin> [server]` — Move to disabled folder',
        inline: false,
      },
      {
        name: '⚙️ Setup Required',
        value: 'For full plugin management, run `*setup` and configure SSH, FTP, or Pterodactyl access.\nRCON-only users can still list loaded plugins.',
        inline: false,
      },
    )
    .setFooter({ text: 'Admin only • Requires file access for most operations' });

  message.channel.send({ embeds: [embed] });
}
