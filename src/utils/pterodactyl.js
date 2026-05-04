const axios = require('axios');

async function pterodactylRequest(server, endpoint, method = 'GET', data = null) {
  if (!server.pterodactyl_url || !server.pterodactyl_api_key || !server.pterodactyl_server_id)
    throw new Error('Pterodactyl not configured for this server');

  const url = `${server.pterodactyl_url}/api/client/servers/${server.pterodactyl_server_id}${endpoint}`;

  const config = {
    method,
    url,
    headers: {
      'Authorization': `Bearer ${server.pterodactyl_api_key}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
  };

  if (data) config.data = data;

  try {
    const response = await axios(config);
    return response.data;
  } catch (error) {
    if (error.response) {
      throw new Error(`Pterodactyl API error: ${error.response.data?.errors?.[0]?.detail || error.message}`);
    }
    throw error;
  }
}

async function pterodactylListFiles(server, path = '/plugins') {
  const result = await pterodactylRequest(server, `/files/list?directory=${encodeURIComponent(path)}`);
  return result.data.map(f => f.name);
}

async function pterodactylUpload(server, fileName, fileBuffer) {
  const result = await pterodactylRequest(server, '/files/upload', 'POST', {
    target: '/plugins',
    files: [
      {
        name: fileName,
        file: fileBuffer.toString('base64'),
      },
    ],
  });
  return result;
}

async function pterodactylDelete(server, path) {
  await pterodactylRequest(server, '/files/delete', 'POST', {
    root: '/',
    files: [path],
  });
  return true;
}

async function pterodactylRename(server, oldPath, newPath) {
  await pterodactylRequest(server, '/files/rename', 'POST', {
    root: '/',
    files: [
      {
        from: oldPath,
        to: newPath,
      },
    ],
  });
  return true;
}

async function pterodactylSendCommand(server, command) {
  await pterodactylRequest(server, '/command', 'POST', { command });
  return true;
}

module.exports = {
  pterodactylListFiles,
  pterodactylUpload,
  pterodactylDelete,
  pterodactylRename,
  pterodactylSendCommand,
};
