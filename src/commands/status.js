const { EmbedBuilder } = require('discord.js');
const { resolveServer } = require('../utils/resolveServer');
const mcping = require('mcping-js');

function pingJava(host, port) {
  return new Promise((resolve) => {
    const start = Date.now();
    const server = new mcping.MinecraftServer(host, parseInt(port));
    server.ping(5000, 764, (err, res) => {
      if (err) return resolve({ online: false });
      resolve({
        online: true,
        players: res.players?.online ?? 0,
        maxPlayers: res.players?.max ?? 0,
        latency: Date.now() - start,
        version: res.version?.name ?? null,
      });
    });
  });
}

function pingBedrock(host, port) {
  const net = require('net');
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const start = Date.now();
    socket.setTimeout(5000);
    socket.on('connect', () => { socket.destroy(); resolve({ online: true, latency: Date.now() - start }); });
    socket.on('timeout', () => { socket.destroy(); resolve({ online: false }); });
    socket.on('error', () => resolve({ online: false }));
    socket.connect(parseInt(port), host);
  });
}

module.exports = {
  name: 'status',
  aliases: [],
  description: 'Check if the server is online',

  async execute(message, args) {
    const server = await resolveServer(message, args, 0);
    if (!server) return;

    if (!server.java_ip && !server.bedrock_ip)
      return message.reply('❌ No IP configured for this server. Run `*setup` again.');

    const checking = await message.channel.send(`🔄 Pinging **${server.server_name}**...`);
    const embed = new EmbedBuilder()
      .setTitle(`📡 ${server.server_name} — Status`)
      .setTimestamp();

    let anyOnline = false;

    if (server.java_ip) {
      const res = await pingJava(server.java_ip, server.java_port);
      if (res.online) anyOnline = true;
      let text = res.online ? '🟢 Online' : '🔴 Offline';
      if (res.online) {
        text += `\n👥 Players: **${res.players}/${res.maxPlayers}**`;
        text += `\n📶 Ping: **${res.latency}ms**`;
        if (res.version) text += `\n🎮 ${res.version}`;
      }
      embed.addFields({ name: '☕ Java Edition', value: text, inline: false });
    }

    if (server.bedrock_ip) {
      const res = await pingBedrock(server.bedrock_ip, server.bedrock_port);
      if (res.online) anyOnline = true;
      embed.addFields({
        name: '📱 Bedrock Edition',
        value: res.online ? `🟢 Online\n📶 Ping: **${res.latency}ms**` : '🔴 Offline',
        inline: false
      });
    }

    embed.setColor(anyOnline ? 0x44ff88 : 0xff4444);
    await checking.delete();
    message.channel.send({ embeds: [embed] });
  }
};
