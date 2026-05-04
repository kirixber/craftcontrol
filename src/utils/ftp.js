const ftp = require('ftp');

async function ftpConnect(server) {
  if (!server.ftp_host || !server.ftp_username)
    throw new Error('FTP not configured for this server');

  return new Promise((resolve, reject) => {
    const client = new ftp();

    client.on('ready', () => resolve(client));
    client.on('error', reject);

    client.connect({
      host: server.ftp_host,
      port: parseInt(server.ftp_port) || 21,
      user: server.ftp_username,
      password: server.ftp_password || '',
    });
  });
}

async function ftpUpload(server, localPath, remotePath) {
  const client = await ftpConnect(server);
  const fs = require('fs');

  return new Promise((resolve, reject) => {
    client.put(localPath, remotePath, (err) => {
      client.destroy();
      if (err) reject(err);
      else resolve(true);
    });
  });
}

async function ftpDelete(server, remotePath) {
  const client = await ftpConnect(server);

  return new Promise((resolve, reject) => {
    client.delete(remotePath, (err) => {
      client.destroy();
      if (err) reject(err);
      else resolve(true);
    });
  });
}

async function ftpListFiles(server, remotePath) {
  const client = await ftpConnect(server);

  return new Promise((resolve, reject) => {
    client.list(remotePath, (err, list) => {
      client.destroy();
      if (err) reject(err);
      else resolve(list.map(f => f.name));
    });
  });
}

async function ftpRename(server, oldPath, newPath) {
  const client = await ftpConnect(server);

  return new Promise((resolve, reject) => {
    client.rename(oldPath, newPath, (err) => {
      client.destroy();
      if (err) reject(err);
      else resolve(true);
    });
  });
}

module.exports = { ftpUpload, ftpDelete, ftpListFiles, ftpRename };
