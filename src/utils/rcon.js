const { Rcon } = require('rcon-client');

async function rconCommand(server, command) {
  if (!server.rcon_host || !server.rcon_password)
    throw new Error('RCON not configured for this server');

  const rcon = new Rcon({
    host: server.rcon_host,
    port: parseInt(server.rcon_port) || 25575,
    password: server.rcon_password,
    timeout: 5000,
  });

  await rcon.connect();
  const response = await rcon.send(command);
  await rcon.end();
  return response;
}

module.exports = { rconCommand };
