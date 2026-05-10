const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  getVoiceConnection,
  entersState,
} = require('@discordjs/voice');
const { EmbedBuilder, SlashCommandBuilder } = require('discord.js');
const { SOUNDS } = require('./play');

const loopState = new Map();

module.exports = {
  name: 'loop',
  aliases: ['lp'],
  description: 'Loop a Minecraft sound in your VC',
  loopState,
  data: new SlashCommandBuilder()
    .setName('loop')
    .setDescription('Loop a Minecraft sound in your VC')
    .addStringOption(option =>
      option.setName('sound')
        .setDescription('The sound to loop')
        .setRequired(true)),

  async execute(context, args) {
    const isInteraction = !!context.isChatInputCommand?.();
    const query = (isInteraction ? context.options.getString('sound') : args.join(' ')).toLowerCase().replace(/\s+/g, '_');

    if (!query) {
      const msg = '❌ Usage: `*loop <sound>`\nExample: `*loop pigstep`\nUse `*sounds` to see all available sounds.';
      return isInteraction ? context.reply({ content: msg, ephemeral: true }) : context.reply(msg);
    }

    const soundKey = SOUNDS[query]
      ? query
      : Object.keys(SOUNDS).find(k => k.includes(query) || query.includes(k)) || null;

    if (!soundKey) {
      const msg = `❓ Sound **${query}** not found. Use \`*sounds\` to browse all sounds.`;
      return isInteraction ? context.reply({ content: msg, ephemeral: true }) : context.reply(msg);
    }

    const member = isInteraction ? context.member : context.member;
    const voiceChannel = member?.voice?.channel;
    if (!voiceChannel) {
      const msg = '❌ You need to be in a voice channel first!';
      return isInteraction ? context.reply({ content: msg, ephemeral: true }) : context.reply(msg);
    }

    const perms = voiceChannel.permissionsFor(context.client.user);
    if (!perms.has('Connect') || !perms.has('Speak')) {
      const msg = '❌ I don\'t have permission to join or speak in that voice channel.';
      return isInteraction ? context.reply({ content: msg, ephemeral: true }) : context.reply(msg);
    }

    if (isInteraction) await context.deferReply();

    // Stop any existing loop
    if (loopState.has(context.guild.id)) {
      loopState.get(context.guild.id).player.stop();
      loopState.delete(context.guild.id);
    }

    // Join or reuse connection
    let connection = getVoiceConnection(context.guild.id);
    if (!connection) {
      connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: context.guild.id,
        adapterCreator: context.guild.voiceAdapterCreator,
      });

      connection.on(VoiceConnectionStatus.Disconnected, async () => {
        try {
          await Promise.race([
            entersState(connection, VoiceConnectionStatus.Signalling, 5000),
            entersState(connection, VoiceConnectionStatus.Connecting, 5000),
          ]);
        } catch {
          try { connection.destroy(); } catch { }
          loopState.delete(context.guild.id);
        }
      });
    }

    const soundUrl = 'https://raw.githubusercontent.com/kirixber/mc-sounds/refs/heads/master/' + SOUNDS[soundKey];
    const player = createAudioPlayer();
    connection.subscribe(player);

    function playOnce() {
      const resource = createAudioResource(soundUrl);
      player.play(resource);
    }

    playOnce();
    loopState.set(context.guild.id, { soundKey, player });

    player.on(AudioPlayerStatus.Idle, () => {
      if (loopState.has(context.guild.id)) playOnce();
    });

    player.on('error', err => {
      console.error('Loop error:', err.message);
      loopState.delete(context.guild.id);
      const msg = `⚠️ Error looping \`${soundKey}\`.`;
      if (isInteraction) context.followUp({ content: msg, ephemeral: true });
      else context.channel.send(msg);
    });

    const embed = new EmbedBuilder()
      .setDescription(`🔁 Looping \`${soundKey}\` in **${voiceChannel.name}**`)
      .setColor(0x44ff88)
      .setFooter({ text: 'Use *stop to stop and disconnect' });

    if (isInteraction) {
      await context.editReply({ embeds: [embed] });
    } else {
      context.channel.send({ embeds: [embed] });
    }
  }
};
