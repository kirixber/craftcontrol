const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { resolveServer } = require('../utils/resolveServer');
const { rconCommand } = require('../utils/rcon');
const mcping = require('mcping-js');
const net = require('net');

const PING_COUNT = 3;
const PING_DELAY = 800; // ms between pings — prevents flooding

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function pingJavaOnce(host, port) {
  return new Promise((resolve) => {
    const start = Date.now();
    const server = new mcping.MinecraftServer(host, parseInt(port));
    server.ping(5000, 764, (err, res) => {
      if (err) return resolve(null);
      resolve({
        latency: Date.now() - start,
        players: res.players?.online ?? 0,
        max: res.players?.max ?? 0,
        version: res.version?.name ?? null,
      });
    });
  });
}

function pingTcpOnce(host, port) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const start = Date.now();
    socket.setTimeout(5000);
    socket.on('connect', () => { socket.destroy(); resolve(Date.now() - start); });
    socket.on('timeout', () => { socket.destroy(); resolve(null); });
    socket.on('error', () => resolve(null));
    socket.connect(parseInt(port), host);
  });
}

// Ping sequentially with delay between each
async function pingSequential(pingFn, count, delay) {
  const results = [];
  for (let i = 0; i < count; i++) {
    results.push(await pingFn());
    if (i < count - 1) await sleep(delay);
  }
  return results;
}

function getQuality(avg) {
  if (avg === null) return { label: 'Offline', emoji: '🔴', color: 0xff4444 };
  if (avg < 50)    return { label: 'Excellent', emoji: '🟢', color: 0x44ff88 };
  if (avg < 100)   return { label: 'Good',      emoji: '🟢', color: 0x44ff88 };
  if (avg < 200)   return { label: 'Fair',      emoji: '🟡', color: 0xffcc00 };
  if (avg < 400)   return { label: 'Poor',      emoji: '🟠', color: 0xff8800 };
  return             { label: 'Bad',        emoji: '🔴', color: 0xff4444 };
}

function pingBar(avg) {
  if (avg === null) return '░░░░░░░░░░';
  const filled = Math.max(1, Math.min(10, Math.round(10 - (avg / 50))));
  return '█'.repeat(filled) + '░'.repeat(10 - filled);
}

function buildStats(pings) {
  const valid = pings.filter(p => p !== null);
  if (!valid.length) return null;
  const latencies = valid.map(p => typeof p === 'object' ? p.latency : p);
  return {
    sent: pings.length,
    received: valid.length,
    lost: pings.length - valid.length,
    loss: (((pings.length - valid.length) / pings.length) * 100).toFixed(0),
    min: Math.min(...latencies),
    max: Math.max(...latencies),
    avg: Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length),
    jitter: Math.round(Math.max(...latencies) - Math.min(...latencies)),
  };
}

module.exports = {
  name: 'ping',
  aliases: ['network', 'latency'],
  description: 'Show detailed network stats for the server',
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Show detailed network stats for the server')
    .addStringOption(option =>
      option.setName('server')
        .setDescription('The server name (optional)')
        .setRequired(false)),

  async execute(context, args) {
    const isInteraction = !!context.isChatInputCommand?.();
    const finalArgs = isInteraction ? [context.options.getString('server')] : args;

    if (isInteraction) await context.deferReply();

    const server = await resolveServer(context, finalArgs, 0);
    if (!server) return;

    if (!server.java_ip && !server.bedrock_ip) {
      const msg = '❌ No IP configured. Run `*setup` first.';
      return isInteraction ? context.editReply(msg) : context.reply(msg);
    }

    let checking;
    if (!isInteraction) {
      checking = await context.channel.send(`📡 Pinging **${server.server_name}** (${PING_COUNT}x, please wait)...`);
    }

    // ── Java: sequential pings ──
    let javaStats = null;
    let javaInfo = null;
    if (server.java_ip) {
      const pings = await pingSequential(
        () => pingJavaOnce(server.java_ip, server.java_port),
        PING_COUNT,
        PING_DELAY
      );
      javaStats = buildStats(pings);
      javaInfo = pings.find(p => p !== null) || null;
    }

    // ── Bedrock: sequential pings ──
    let bedrockStats = null;
    if (server.bedrock_ip) {
      const pings = await pingSequential(
        () => pingTcpOnce(server.bedrock_ip, server.bedrock_port),
        PING_COUNT,
        PING_DELAY
      );
      bedrockStats = buildStats(pings);
    }

    // ── TPS via RCON (single call, non-critical) ──
    let tps = null;
    if (server.rcon_host && server.rcon_password) {
      try {
        const res = await rconCommand(server, 'tps');
        const match = res.match(/[\d.]+/g);
        if (match) tps = parseFloat(match[0]);
      } catch { /* RCON unavailable, skip */ }
    }

    const quality = getQuality(javaStats?.avg ?? bedrockStats?.avg ?? null);

    const embed = new EmbedBuilder()
      .setTitle(`📡 ${server.server_name} — Network Stats`)
      .setColor(quality.color)
      .setTimestamp();

    if (server.java_ip) {
      if (javaStats) {
        embed.addFields({
          name: `☕ Java Edition — ${quality.emoji} ${quality.label}`,
          value: [
            '```',
            `Packets Sent:     ${javaStats.sent}`,
            `Packets Received: ${javaStats.received}`,
            `Packet Loss:      ${javaStats.loss}%`,
            ``,
            `Min Latency:  ${javaStats.min}ms`,
            `Max Latency:  ${javaStats.max}ms`,
            `Avg Latency:  ${javaStats.avg}ms`,
            `Jitter:       ${javaStats.jitter}ms`,
            '```',
            `Signal: \`${pingBar(javaStats.avg)}\` ${javaStats.avg}ms`,
            javaInfo ? `👥 Players: **${javaInfo.players}/${javaInfo.max}**` : '',
            javaInfo?.version ? `🎮 ${javaInfo.version}` : '',
          ].filter(Boolean).join('\n'),
          inline: false
        });
      } else {
        embed.addFields({
          name: '☕ Java Edition — 🔴 Offline',
          value: `All ${PING_COUNT} ping attempts timed out.`,
          inline: false
        });
      }
    }

    if (server.bedrock_ip) {
      if (bedrockStats) {
        const bq = getQuality(bedrockStats.avg);
        embed.addFields({
          name: `📱 Bedrock Edition — ${bq.emoji} ${bq.label}`,
          value: [
            '```',
            `Packets Sent:     ${bedrockStats.sent}`,
            `Packets Received: ${bedrockStats.received}`,
            `Packet Loss:      ${bedrockStats.loss}%`,
            ``,
            `Min Latency:  ${bedrockStats.min}ms`,
            `Max Latency:  ${bedrockStats.max}ms`,
            `Avg Latency:  ${bedrockStats.avg}ms`,
            `Jitter:       ${bedrockStats.jitter}ms`,
            '```',
            `Signal: \`${pingBar(bedrockStats.avg)}\` ${bedrockStats.avg}ms`,
          ].join('\n'),
          inline: false
        });
      } else {
        embed.addFields({
          name: '📱 Bedrock Edition — 🔴 Offline',
          value: `All ${PING_COUNT} ping attempts timed out.`,
          inline: false
        });
      }
    }

    if (tps !== null) {
      const tpsEmoji = tps >= 19 ? '🟢' : tps >= 15 ? '🟡' : '🔴';
      embed.addFields({
        name: '⚡ Server TPS',
        value: `${tpsEmoji} **${tps}** / 20.0`,
        inline: true
      });
    }

    embed.setFooter({ text: `${PING_COUNT} packets • 800ms between each • Jitter = ping variance` });
    
    if (isInteraction) {
      await context.editReply({ content: null, embeds: [embed] });
    } else {
      await checking.delete();
      context.channel.send({ embeds: [embed] });
    }
  }
};
