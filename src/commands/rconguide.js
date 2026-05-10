const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');

const GUIDES = {
  aternos: {
    name: 'Aternos',
    emoji: '🟢',
    steps: [
      '1. Go to your **Aternos server dashboard**',
      '2. Click **Files** in the left sidebar',
      '3. Find and click **server.properties**',
      '4. Find `enable-rcon` → change `false` to `true`',
      '5. Find `rcon.password` → set any password you want',
      '6. Find `rcon.port` → note the value (default `25575`)',
      '7. Click **Save**',
      '8. **Restart** your server',
      '9. Run `*setup` or `/setup` in Discord and enter the details!',
    ],
    note: 'For RCON host, use the same IP as your Minecraft server.',
  },
  minehut: {
    name: 'Minehut',
    emoji: '🔵',
    steps: [
      '1. Go to **minehut.com** and log in',
      '2. Click your server → **File Manager**',
      '3. Open **server.properties**',
      '4. Find `enable-rcon` → set to `true`',
      '5. Find `rcon.password` → set a password',
      '6. Save and **restart** your server',
      '7. Run `*setup` or `/setup` in Discord and enter the details!',
    ],
    note: 'Minehut may block external RCON connections — if it doesn\'t work, skip RCON in `*setup`.',
  },
  bisect: {
    name: 'Bisect Hosting',
    emoji: '🟠',
    steps: [
      '1. Log into your **Bisect Hosting panel**',
      '2. Go to **Files** → **Config Files** → **Server Settings**',
      '3. Find **Enable RCON** → set to `true`',
      '4. Set **RCON Password** to anything you want',
      '5. Save and **restart** your server from the panel',
      '6. Run `*setup` or `/setup` in Discord!',
    ],
    note: 'Use your server IP and port 25575 for RCON in `*setup`.',
  },
  pebblehost: {
    name: 'PebbleHost',
    emoji: '🟤',
    steps: [
      '1. Log into **PebbleHost panel** (panel.pebblehost.com)',
      '2. Go to **Files** → open **server.properties**',
      '3. Set `enable-rcon=true`',
      '4. Set `rcon.password=yourpassword`',
      '5. Save → go to **Startup** and restart',
      '6. Run `*setup` or `/setup` in Discord!',
    ],
    note: 'Use your server IP and port 25575 for RCON.',
  },
  pterodactyl: {
    name: 'Pterodactyl / Any Panel',
    emoji: '⚙️',
    steps: [
      '1. Open your panel\'s **File Manager**',
      '2. Find and edit **server.properties**',
      '3. Set these three values:',
      '   • `enable-rcon=true`',
      '   • `rcon.password=yourpassword`',
      '   • `rcon.port=25575`',
      '4. Save the file',
      '5. **Restart** your server',
      '6. Run `*setup` or `/setup` in Discord and enter your IP, port 25575, and password!',
    ],
    note: 'This works for Pterodactyl, Crafty, AMP, and any panel with file access.',
  },
  selfhost: {
    name: 'Self Hosted (Linux/Windows)',
    emoji: '🖥️',
    steps: [
      '1. Download the setup script by running this command in the terminal to the folder where the "server.properties" file is located:',
      '   ```',
      '   curl -O https://raw.githubusercontent.com/kirixber/mc-sounds/refs/heads/master/rcon-setup.sh',
      '   ```',
      '2. Open a terminal in that folder',
      '3. Run: `bash rcon-setup.sh`',
      '4. Enter a password when prompted',
      '5. Restart your Minecraft server',
      '6. Run `*setup` or `/setup` in Discord with the details it prints!',
    ],
    note: 'The rcon-setup.sh script auto-edits server.properties for you.',
  },
};

module.exports = {
  name: 'rconguide',
  aliases: ['rcon', 'rconhelp'],
  description: 'Step-by-step RCON setup guide for your hosting panel',
  data: new SlashCommandBuilder()
    .setName('rconguide')
    .setDescription('Step-by-step RCON setup guide for your hosting panel'),

  async execute(context) {
    const isInteraction = context.isChatInputCommand?.();
    if (isInteraction) await context.deferReply();

    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('rcon_host_select')
        .setPlaceholder('Select your hosting panel...')
        .addOptions([
          { label: 'Aternos', value: 'aternos', emoji: '🟢' },
          { label: 'Minehut', value: 'minehut', emoji: '🔵' },
          { label: 'Bisect Hosting', value: 'bisect', emoji: '🟠' },
          { label: 'PebbleHost', value: 'pebblehost', emoji: '🟤' },
          { label: 'Pterodactyl / Any Panel', value: 'pterodactyl', emoji: '⚙️' },
          { label: 'Self Hosted (Linux/Windows)', value: 'selfhost', emoji: '🖥️' },
        ])
    );

    const prompt = new EmbedBuilder()
      .setTitle('🔧 RCON Setup Guide')
      .setDescription('Select your hosting panel below and I\'ll give you step-by-step instructions to enable RCON.\n\nRCON lets the bot use commands like `*online`, `*kick`, `*ban`, `*gm`, `*tp` and more.')
      .setColor(0x5865F2)
      .setFooter({ text: 'You can skip RCON — basic features still work without it' });

    let reply;
    if (isInteraction) {
      reply = await context.editReply({ embeds: [prompt], components: [row] });
    } else {
      reply = await context.channel.send({ embeds: [prompt], components: [row] });
    }

    const userId = isInteraction ? context.user.id : context.author.id;

    // Listen for selection
    const collector = reply.createMessageComponentCollector({
      filter: i => i.user.id === userId,
      time: 60000,
      max: 1,
    });

    collector.on('collect', async interaction => {
      const selected = interaction.values[0];
      const guide = GUIDES[selected];

      const embed = new EmbedBuilder()
        .setTitle(`${guide.emoji} RCON Setup — ${guide.name}`)
        .setColor(0x44ff88)
        .setDescription(guide.steps.join('\n'))
        .setFooter({ text: guide.note });

      await interaction.update({ embeds: [embed], components: [] });
    });

    collector.on('end', (collected) => {
      if (collected.size === 0) {
        if (isInteraction) {
          context.editReply({ components: [] }).catch(() => {});
        } else {
          reply.edit({ components: [] }).catch(() => {});
        }
      }
    });
  }
};
