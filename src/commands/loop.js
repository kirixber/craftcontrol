const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  getVoiceConnection,
  entersState,
} = require('@discordjs/voice');
const { EmbedBuilder } = require('discord.js');
const { SOUNDS } = require('./play');

const loopState = new Map();

module.exports = {
  name: 'loop',
  aliases: ['lp'],
  description: 'Loop a Minecraft sound in your VC',
  loopState,

  async execute(message, args) {
    if (!args.length)
      return message.reply('❌ Usage: `*loop <sound>`\nExample: `*loop pigstep`\nUse `*sounds` to see all available sounds.');

    const query = args.join(' ').toLowerCase().replace(/\s+/g, '_');
    const soundKey = SOUNDS[query]
      ? query
      : Object.keys(SOUNDS).find(k => k.includes(query) || query.includes(k)) || null;

    if (!soundKey)
      return message.reply(`❓ Sound **${query}** not found. Use \`*sounds\` to browse all sounds.`);

    const voiceChannel = message.member?.voice?.channel;
    if (!voiceChannel)
      return message.reply('❌ You need to be in a voice channel first!');

    const perms = voiceChannel.permissionsFor(message.client.user);
    if (!perms.has('Connect') || !perms.has('Speak'))
      return message.reply('❌ I don\'t have permission to join or speak in that voice channel.');

    // Stop any existing loop
    if (loopState.has(message.guild.id)) {
      loopState.get(message.guild.id).player.stop();
      loopState.delete(message.guild.id);
    }

    // Join or reuse connection
    let connection = getVoiceConnection(message.guild.id);
    if (!connection) {
      connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: message.guild.id,
        adapterCreator: message.guild.voiceAdapterCreator,
      });

      connection.on(VoiceConnectionStatus.Disconnected, async () => {
        try {
          await Promise.race([
            entersState(connection, VoiceConnectionStatus.Signalling, 5000),
            entersState(connection, VoiceConnectionStatus.Connecting, 5000),
          ]);
        } catch {
          try { connection.destroy(); } catch { }
          loopState.delete(message.guild.id);
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
    loopState.set(message.guild.id, { soundKey, player });

    player.on(AudioPlayerStatus.Idle, () => {
      if (loopState.has(message.guild.id)) playOnce();
    });

    player.on('error', err => {
      console.error('Loop error:', err.message);
      loopState.delete(message.guild.id);
      message.channel.send(`⚠️ Error looping \`${soundKey}\`.`);
    });

    const embed = new EmbedBuilder()
      .setDescription(`🔁 Looping \`${soundKey}\` in **${voiceChannel.name}**`)
      .setColor(0x44ff88)
      .setFooter({ text: 'Use *stop to stop and disconnect' });

    message.channel.send({ embeds: [embed] });
  }
};
