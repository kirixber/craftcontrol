const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');
const { rconCommand } = require('../utils/rcon');
const { getServer } = require('../db/database');

module.exports = {
  name: 'player',
  description: 'Look up a Minecraft player by IGN',
  data: new SlashCommandBuilder()
    .setName('player')
    .setDescription('Look up a Minecraft player by IGN')
    .addStringOption(opt => opt.setName('ign').setDescription('Minecraft username').setRequired(true)),

  async execute(context, args) {
    const isInteraction = !!context.isChatInputCommand?.();
    const ign = isInteraction ? context.options.getString('ign') : args[0];

    if (!ign) return context.reply('❌ Usage: `*player <username>`');

    if (isInteraction) await context.deferReply();
    const reply = async (content) => isInteraction ? context.editReply(content) : context.channel.send(content);
    const checking = await reply(`🔍 Looking up **${ign}**...`);

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
        const server = getServer(context.guild.id); // Default server
        if (server && server !== 'multiple' && server.rcon_host) {
          try {
            const listRes = await rconCommand(server, 'list');
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

        if (isInteraction) {
          await context.editReply({ content: null, embeds: [embed] });
        } else {
          await checking.delete().catch(() => {});
          await context.channel.send({ embeds: [embed] });
        }
        return;
      }

      // Step 3: Not found on Mojang — could be cracked
      const server = getServer(context.guild.id);
      let onlineStatus = '❓ Unknown';

      if (server && server !== 'multiple' && server.rcon_host) {
        try {
          const listRes = await rconCommand(server, 'list');
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

      if (isInteraction) {
        await context.editReply({ content: null, embeds: [embed] });
      } else {
        await checking.delete().catch(() => {});
        await context.channel.send({ embeds: [embed] });
      }

    } catch (err) {
      if (isInteraction) {
        await context.editReply('⚠️ Something went wrong fetching player data. Try again later.');
      } else {
        await checking.delete().catch(() => {});
        await context.reply('⚠️ Something went wrong fetching player data. Try again later.');
      }
      console.error('Player lookup error:', err);
    }
  }
};
