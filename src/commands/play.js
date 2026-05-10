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

const BASE = 'https://raw.githubusercontent.com/kirixber/mc-sounds/refs/heads/master/';

const SOUNDS = {
  // ── Music Discs (records/) ──
  'pigstep':          'records/pigstep.ogg',
  'otherside':        'records/otherside.ogg',
  'cat':              'records/cat.ogg',
  'blocks':           'records/blocks.ogg',
  'chirp':            'records/chirp.ogg',
  'far':              'records/far.ogg',
  'mall':             'records/mall.ogg',
  'mellohi':          'records/mellohi.ogg',
  'stal':             'records/stal.ogg',
  'strad':            'records/strad.ogg',
  'ward':             'records/ward.ogg',
  'wait':             'records/wait.ogg',
  '11':               'records/11.ogg',
  '13':               'records/13.ogg',
  'relic':            'records/relic.ogg',
  'creator':          'records/creator.ogg',
  'precipice':        'records/precipice.ogg',

  // ── Background Music (music/game/) ──
  'a_familiar_room':      'music/game/a_familiar_room.ogg',
  'an_ordinary_day':      'music/game/an_ordinary_day.ogg',
  'ancestry':             'music/game/ancestry.ogg',
  'below_and_above':      'music/game/below_and_above.ogg',
  'broken_clocks':        'music/game/broken_clocks.ogg',
  'bromeliad':            'music/game/bromeliad.ogg',
  'clark':                'music/game/clark.ogg',
  'comforting_memories':  'music/game/comforting_memories.ogg',
  'crescent_dunes':       'music/game/crescent_dunes.ogg',

  // ── Menu Music (music/menu/) ──
  'beginning':        'music/menu/beginning_2.ogg',
  'floating_trees':   'music/menu/floating_trees.ogg',
  'moog_city':        'music/menu/moog_city_2.ogg',
  'mutation':         'music/menu/mutation.ogg',

  // ── Mob sounds (mob/) ──
  'cow':              'mob/cow/say1.ogg',
  'cow_hurt':         'mob/cow/hurt1.ogg',
  'pig':              'mob/pig/say1.ogg',
  'pig_hurt':         'mob/pig/hurt1.ogg',
  'chicken':          'mob/chicken/say1.ogg',
  'sheep':            'mob/sheep/say1.ogg',
  'zombie':           'mob/zombie/say1.ogg',
  'zombie_hurt':      'mob/zombie/hurt1.ogg',
  'zombie_death':     'mob/zombie/death1.ogg',
  'skeleton':         'mob/skeleton/hurt1.ogg',
  'skeleton_death':   'mob/skeleton/death1.ogg',
  'creeper':          'mob/creeper/say1.ogg',
  'spider':           'mob/spider/say1.ogg',
  'enderman':         'mob/endermen/scream1.ogg',
  'enderman_idle':    'mob/endermen/idle1.ogg',
  'ghast':            'mob/ghast/scream1.ogg',
  'ghast_warn':       'mob/ghast/warn1.ogg',
  'blaze':            'mob/blaze/breathe1.ogg',
  'slime':            'mob/slime/big1.ogg',
  'wolf':             'mob/wolf/bark1.ogg',
  'wolf_howl':        'mob/wolf/howl1.ogg',
  'cat_meow':         'mob/cat/meow1.ogg',
  'bat':              'mob/bat/loop1.ogg',
  'witch':            'mob/witch/idle1.ogg',
  'villager':         'mob/villager/idle1.ogg',
  'villager_no':      'mob/villager/no1.ogg',
  'villager_trade':   'mob/villager/trade1.ogg',
  'wither_spawn':     'mob/wither/spawn.ogg',
  'ender_dragon':     'mob/enderdragon/growl1.ogg',
  'iron_golem':       'mob/irongolem/walk1.ogg',

  // ── Ambient ──
  'cave':             'ambient/cave/cave1.ogg',
  'cave2':            'ambient/cave/cave2.ogg',
  'underwater':       'ambient/underwater/loop/loop.ogg',
  'nether_ambient':   'ambient/nether/nether1.ogg',
  'moody':            'mob/cow/moody/ambient1.ogg',

  // ── UI ──
  'hud':              'ui/hud/hud_bubble.ogg',

  // ── Block sounds ──
  'bell':             'block/bell/use1.ogg',
  'amethyst':         'block/amethyst/chime1.ogg',
  'chest_open':       'block/chest/open1.ogg',
  'chest_close':      'block/chest/close1.ogg',
  'anvil':            'block/anvil/land1.ogg',
  'beacon':           'block/beacon/activate.ogg',
  'sculk':            'block/sculk_sensor/clicking1.ogg',
  'conduit':          'block/conduit/activate.ogg',
  'portal':           'portal/portal.ogg',
  'fire':             'fire/fire.ogg',
  'enchant':          'enchant/thorns1.ogg',
};

const CATEGORIES = {
  '🎵 Music Discs':       ['pigstep','otherside','cat','blocks','chirp','far','mall','mellohi','stal','strad','ward','wait','11','13','relic','creator','precipice'],
  '🎼 Background Music':  ['a_familiar_room','an_ordinary_day','ancestry','below_and_above','broken_clocks','bromeliad','clark','comforting_memories','crescent_dunes','beginning','floating_trees','moog_city','mutation'],
  '🐾 Mobs':              ['cow','cow_hurt','pig','pig_hurt','chicken','sheep','zombie','zombie_hurt','zombie_death','skeleton','skeleton_death','creeper','spider','enderman','enderman_idle','ghast','ghast_warn','blaze','slime','wolf','wolf_howl','cat_meow','bat','witch','villager','villager_no','villager_trade','wither_spawn','ender_dragon','iron_golem'],
  '🌍 Ambient':           ['cave','cave2','underwater','nether_ambient','moody'],
  '🧱 Blocks & Other':    ['bell','amethyst','chest_open','chest_close','anvil','beacon','sculk','conduit','portal','fire','enchant','hud'],
};

const IDLE_TIMEOUT_MS = 5 * 60 * 1000;
const idleTimers = new Map();

function resetIdleTimer(guildId, connection) {
  if (idleTimers.has(guildId)) clearTimeout(idleTimers.get(guildId));
  const timer = setTimeout(() => {
    try { connection.destroy(); } catch { }
    idleTimers.delete(guildId);
  }, IDLE_TIMEOUT_MS);
  idleTimers.set(guildId, timer);
}

function clearIdleTimer(guildId) {
  if (idleTimers.has(guildId)) {
    clearTimeout(idleTimers.get(guildId));
    idleTimers.delete(guildId);
  }
}

function findSound(query) {
  const q = query.toLowerCase().replace(/\s+/g, '_');
  if (SOUNDS[q]) return q;
  return Object.keys(SOUNDS).find(k => k.includes(q) || q.includes(k)) || null;
}

module.exports = {
  name: 'play',
  aliases: ['p'],
  description: 'Play a Minecraft sound in your voice channel',
  SOUNDS,
  CATEGORIES,
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('Play a Minecraft sound in your voice channel')
    .addStringOption(option =>
      option.setName('sound')
        .setDescription('The sound to play')
        .setRequired(true)),

  async execute(context, args) {
    const isInteraction = !!context.isChatInputCommand?.();
    const query = isInteraction ? context.options.getString('sound') : args.join(' ');

    if (!query) {
      const msg = '❌ Usage: `*play <sound>`\nUse `*sounds` to see all available sounds.';
      return isInteraction ? context.reply({ content: msg, ephemeral: true }) : context.reply(msg);
    }

    const soundKey = findSound(query);

    if (!soundKey) {
      const suggestions = Object.keys(SOUNDS)
        .filter(k => query.toLowerCase().split(' ').some(a => k.includes(a)))
        .slice(0, 4);
      const hint = suggestions.length ? `\nDid you mean: ${suggestions.map(s => `\`${s}\``).join(', ')}` : '';
      const msg = `❓ Sound **${query}** not found.${hint}\nUse \`*sounds\` to browse all sounds.`;
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

    const soundUrl = BASE + SOUNDS[soundKey];

    try {
      if (isInteraction) await context.deferReply();

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
            connection.destroy();
            clearIdleTimer(context.guild.id);
          }
        });
      }

      const player = createAudioPlayer();
      const resource = createAudioResource(soundUrl);
      connection.subscribe(player);
      player.play(resource);
      clearIdleTimer(context.guild.id);

      const embed = new EmbedBuilder()
        .setDescription(`🎵 Playing \`${soundKey}\` in **${voiceChannel.name}**`)
        .setColor(0x5865F2)
        .setFooter({ text: 'Bot leaves after 5 min of inactivity • *stop to disconnect' });

      if (isInteraction) {
        await context.editReply({ embeds: [embed] });
      } else {
        context.channel.send({ embeds: [embed] });
      }

      player.on(AudioPlayerStatus.Idle, () => resetIdleTimer(context.guild.id, connection));
      player.on('error', err => {
        console.error('Audio error:', err.message, soundUrl);
        const msg = `⚠️ Couldn't play \`${soundKey}\`. The file path may be slightly different — let the dev know!`;
        if (isInteraction) context.followUp({ content: msg, ephemeral: true });
        else context.channel.send(msg);
        resetIdleTimer(context.guild.id, connection);
      });

    } catch (err) {
      console.error('Voice error:', err);
      const msg = '⚠️ Something went wrong joining the voice channel.';
      if (isInteraction) {
        if (context.deferred) await context.editReply(msg);
        else await context.reply({ content: msg, ephemeral: true });
      } else {
        context.reply(msg);
      }
    }
  }
};
