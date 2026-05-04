const { EmbedBuilder } = require('discord.js');
const { rconCommand, getRconConfig } = require('../utils/rcon');

module.exports = {
  name: 'player',
  description: 'Look up a Minecraft player by IGN',

  async execute(message, args) {
    if (!args[0]) return message.reply('❌ Usage: `\'player <username>`');

    const ign = args[0];
    const checking = await message.channel.send(`🔍 Looking up **${ign}**...`);

    try {
      // Step 1: Try Mojang API (works for Java/premium accounts)
      const profileRes = await fetch(`https://api.mojang.com/users/profiles/minecraft/${ign}`);

      if (profileRes.status === 200) {
        // Premium/Java player
        const profile = await profileRes.json();
        const { id: rawUuid, name } = profile;

        const uuid = `${rawUuid.slice(0,8)}-${rawUuid.slice(8,12)}-${rawUuid.slice(12,16)}-${rawUuid.slice(16,20)}-${rawUuid.slice(20)}`;
        const skinUrl = `https://crafatar.com/renders/body/${rawUuid}?overlay`;
        const headUrl = `https://crafatar.com/avatars/${rawUuid}?overlay`;
        const nameMcUrl = `https://namemc.com/profile/${rawUuid}`;

        // Step 2: Check if currently online via RCON
        let onlineStatus = '❓ Unknown';
        const rconConfig = await getRconConfig(message.guild.id);
        if (rconConfig) {
          try {
            const listRes = await rconCommand(message.guild.id, 'list');
            const playerList = listRes.split(':')[1] || '';
            const isOnline = playerList.split(',').map(p => p.trim().toLowerCase()).includes(name.toLowerCase());
            onlineStatus = isOnline ? '🟢 Online' : '⚫ Offline';
          } catch { /* RCON failed, skip */ }
        }

        const embed = new EmbedBuilder()
          .setTitle(`🎮 ${name}`)
          .setURL(nameMcUrl)
          .setThumbnail(headUrl)
          .setImage(skinUrl)
          .setColor(0x44ff88)
          .addFields(
            { name: '👤 Username', value: name, inline: true },
            { name: '📡 Status', value: onlineStatus, inline: true },
            { name: '🔑 UUID', value: `\`${uuid}\``, inline: false },
            { name: '🔗 NameMC', value: `[View Profile](${nameMcUrl})`, inline: true },
            { name: '✅ Account', value: 'Premium (Java)', inline: true }
          )
          .setFooter({ text: 'Skin powered by Crafatar • Data from Mojang API' });

        await checking.delete();
        return message.channel.send({ embeds: [embed] });
      }

      // Step 3: Not found on Mojang — could be cracked
      // Check if they're online via RCON
      const rconConfig = await getRconConfig(message.guild.id);
      let onlineStatus = '❓ Unknown';

      if (rconConfig) {
        try {
          const listRes = await rconCommand(message.guild.id, 'list');
          const playerList = listRes.split(':')[1] || '';
          const isOnline = playerList.split(',').map(p => p.trim().toLowerCase()).includes(ign.toLowerCase());
          onlineStatus = isOnline ? '🟢 Online' : '⚫ Offline';
        } catch { /* RCON failed */ }
      }

      // Show cracked player embed with Steve skin
      const embed = new EmbedBuilder()
        .setTitle(`🎮 ${ign}`)
        .setThumbnail('https://crafatar.com/avatars/8667ba71b85a4004af54457a9734eed7?overlay') // Steve
        .setImage('https://crafatar.com/renders/body/8667ba71b85a4004af54457a9734eed7?overlay')
        .setColor(0xffa500)
        .addFields(
          { name: '👤 Username', value: ign, inline: true },
          { name: '📡 Status', value: onlineStatus, inline: true },
          { name: '🔑 UUID', value: 'N/A (Cracked)', inline: false },
          { name: '⚠️ Account', value: 'Cracked / Offline-mode', inline: true }
        )
        .setFooter({ text: 'This player was not found on Mojang — likely a cracked account' });

      await checking.delete();
      message.channel.send({ embeds: [embed] });

    } catch (err) {
      await checking.delete();
      console.error('Player lookup error:', err);
      message.reply('⚠️ Something went wrong fetching player data. Try again later.');
    }
  }
};
