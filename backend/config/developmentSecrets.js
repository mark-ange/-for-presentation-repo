const fs = require('fs');
const path = require('path');
const { randomBytes } = require('crypto');

const SECRET_NAMES = ['JWT_SECRET', 'JWT_REFRESH_SECRET', 'SESSION_SECRET'];
const SECRET_FILE_NAME = 'developmentSecrets.json';

const readSecrets = (secretPath) => {
  const secrets = JSON.parse(fs.readFileSync(secretPath, 'utf8'));
  if (!secrets || typeof secrets !== 'object' ||
      SECRET_NAMES.some(name => typeof secrets[name] !== 'string' || secrets[name].length < 32)) {
    throw new Error(`Development secrets file is invalid: ${secretPath}`);
  }
  return secrets;
};

const loadDevelopmentSecrets = (configDirectory = __dirname) => {
  const secretPath = path.join(configDirectory, SECRET_FILE_NAME);
  let secrets;

  if (fs.existsSync(secretPath)) {
    secrets = readSecrets(secretPath);
  } else {
    secrets = Object.fromEntries(
      SECRET_NAMES.map(name => [name, randomBytes(32).toString('hex')])
    );
    try {
      fs.writeFileSync(secretPath, `${JSON.stringify(secrets, null, 2)}\n`, {
        encoding: 'utf8',
        flag: 'wx',
        mode: 0o600
      });
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      secrets = readSecrets(secretPath);
    }
  }

  for (const name of SECRET_NAMES) {
    if (!process.env[name]) process.env[name] = secrets[name];
  }
};

module.exports = loadDevelopmentSecrets;
