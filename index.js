require('dotenv').config();
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const fs = require('fs');
const path = require('path');

const PREFIX = '*';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
  ]
});

client.commands = new Collection();

function loadCommands(dir) {
  for (const file of fs.readdirSync(dir)) {
    const full = path.join(dir, file);
    if (fs.statSync(full).isDirectory()) {
      loadCommands(full);
    } else if (file.endsWith('.js')) {
      const command = require(full);
      client.commands.set(command.name, command);
      if (command.aliases) {
        for (const alias of command.aliases) {
          client.commands.set(alias, command);
        }
      }
    }
  }
}

loadCommands(path.join(__dirname, 'src/commands'));

client.once('clientReady', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  console.log(`📦 Loaded: ${[...new Set(client.commands.values())].map(c => c.name).join(', ')}`);
});

// Prefix commands
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (!message.content.startsWith(PREFIX)) return;
  if (!message.guild) return;

  const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
  const commandName = args.shift().toLowerCase();
  const command = client.commands.get(commandName);
  if (!command) return;

  try {
    await command.execute(message, args);
  } catch (err) {
    console.error(`Error in command ${commandName}:`, err);
    message.reply('⚠️ Something went wrong running that command.');
  }
});

// Slash command handler
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction, []);
  } catch (err) {
    console.error(`Error in slash command ${interaction.commandName}:`, err);
    const msg = '⚠️ Something went wrong running that command.';
    if (interaction.deferred || interaction.replied) {
      await interaction.followUp({ content: msg, ephemeral: true });
    } else {
      await interaction.reply({ content: msg, ephemeral: true });
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
