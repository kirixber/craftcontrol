const { Client } = require('ssh2');

async function sshCommand(server, command) {
  if (!server.ssh_host || !server.ssh_username)
    throw new Error('SSH not configured for this server');

  return new Promise((resolve, reject) => {
    const conn = new Client();

    const config = {
      host: server.ssh_host,
      port: parseInt(server.ssh_port) || 22,
      username: server.ssh_username,
    };

    if (server.ssh_key_path) {
      config.privateKey = require('fs').readFileSync(server.ssh_key_path);
    } else if (server.ssh_password) {
      config.password = server.ssh_password;
    } else {
      reject(new Error('SSH requires either password or key'));
      return;
    }

    conn.on('ready', () => {
      conn.exec(command, (err, stream) => {
        if (err) {
          conn.end();
          return reject(err);
        }

        let output = '';
        let errorOutput = '';

        stream.on('data', (data) => {
          output += data.toString();
        });

        stream.stderr.on('data', (data) => {
          errorOutput += data.toString();
        });

        stream.on('close', (code) => {
          conn.end();
          if (code !== 0 && errorOutput) {
            reject(new Error(errorOutput));
          } else {
            resolve(output.trim());
          }
        });
      });
    });

    conn.on('error', reject);
    conn.connect(config);
  });
}

async function sshUpload(server, localPath, remotePath) {
  if (!server.ssh_host || !server.ssh_username)
    throw new Error('SSH not configured for this server');

  return new Promise((resolve, reject) => {
    const conn = new Client();
    const fs = require('fs');

    const config = {
      host: server.ssh_host,
      port: parseInt(server.ssh_port) || 22,
      username: server.ssh_username,
    };

    if (server.ssh_key_path) {
      config.privateKey = fs.readFileSync(server.ssh_key_path);
    } else if (server.ssh_password) {
      config.password = server.ssh_password;
    } else {
      reject(new Error('SSH requires either password or key'));
      return;
    }

    conn.on('ready', () => {
      conn.sftp((err, sftp) => {
        if (err) {
          conn.end();
          return reject(err);
        }

        sftp.fastPut(localPath, remotePath, (err) => {
          conn.end();
          if (err) reject(err);
          else resolve(true);
        });
      });
    });

    conn.on('error', reject);
    conn.connect(config);
  });
}

async function sshDelete(server, remotePath) {
  if (!server.ssh_host || !server.ssh_username)
    throw new Error('SSH not configured for this server');

  return new Promise((resolve, reject) => {
    const conn = new Client();

    const config = {
      host: server.ssh_host,
      port: parseInt(server.ssh_port) || 22,
      username: server.ssh_username,
    };

    if (server.ssh_key_path) {
      config.privateKey = require('fs').readFileSync(server.ssh_key_path);
    } else if (server.ssh_password) {
      config.password = server.ssh_password;
    } else {
      reject(new Error('SSH requires either password or key'));
      return;
    }

    conn.on('ready', () => {
      conn.exec(`rm -f "${remotePath}"`, (err, stream) => {
        if (err) {
          conn.end();
          return reject(err);
        }

        stream.on('close', (code) => {
          conn.end();
          resolve(code === 0);
        });
      });
    });

    conn.on('error', reject);
    conn.connect(config);
  });
}

async function sshListFiles(server, remotePath) {
  if (!server.ssh_host || !server.ssh_username)
    throw new Error('SSH not configured for this server');

  return new Promise((resolve, reject) => {
    const conn = new Client();

    const config = {
      host: server.ssh_host,
      port: parseInt(server.ssh_port) || 22,
      username: server.ssh_username,
    };

    if (server.ssh_key_path) {
      config.privateKey = require('fs').readFileSync(server.ssh_key_path);
    } else if (server.ssh_password) {
      config.password = server.ssh_password;
    } else {
      reject(new Error('SSH requires either password or key'));
      return;
    }

    conn.on('ready', () => {
      conn.exec(`ls -1 "${remotePath}"`, (err, stream) => {
        if (err) {
          conn.end();
          return reject(err);
        }

        let output = '';
        stream.on('data', (data) => {
          output += data.toString();
        });

        stream.on('close', () => {
          conn.end();
          const files = output.trim().split('\n').filter(f => f);
          resolve(files);
        });
      });
    });

    conn.on('error', reject);
    conn.connect(config);
  });
}

module.exports = { sshCommand, sshUpload, sshDelete, sshListFiles };
