const fs = require('fs');
const path = require('path');
const jwt = require('jsonwebtoken');

const getKeyFromEnvOrFile = (envKey, pathKey, fallbackFile) => {
    if (process.env[envKey]) {
        return process.env[envKey];
    }

    const keyPath = process.env[pathKey] || fallbackFile;
    if (keyPath && fs.existsSync(keyPath)) {
        return fs.readFileSync(keyPath, 'utf8');
    }

    return null;
};

const getPrivateKey = () => {
    const fallbackFile = path.resolve(process.cwd(), 'keys/license-private.pem');
    return getKeyFromEnvOrFile('LICENSE_PRIVATE_KEY_PEM', 'LICENSE_PRIVATE_KEY_PATH', fallbackFile);
};

const getPublicKey = () => {
    const fallbackFile = path.resolve(process.cwd(), 'keys/license-public.pem');
    return getKeyFromEnvOrFile('LICENSE_PUBLIC_KEY_PEM', 'LICENSE_PUBLIC_KEY_PATH', fallbackFile);
};

const signLicense = (payload) => {
    const privateKey = getPrivateKey();
    if (!privateKey) throw new Error('RSA Private Key not configured for license signing');
    return jwt.sign(payload, privateKey, { algorithm: 'RS256' });
};

const signResetCode = (payload) => {
    const privateKey = getPrivateKey();
    if (!privateKey) throw new Error('RSA Private Key not configured for reset code signing');
    const options = { algorithm: 'RS256' };
    
    if (payload.expiresAt) {
        const expiresAtSec = Math.floor(new Date(payload.expiresAt).getTime() / 1000);
        const nowSec = Math.floor(Date.now() / 1000);
        if (expiresAtSec > nowSec) {
            options.expiresIn = expiresAtSec - nowSec;
        }
    }
    
    return jwt.sign(payload, privateKey, options);
};

const verifyLicense = (token) => {
    const publicKey = getPublicKey();
    if (!publicKey) throw new Error('RSA Public Key not configured for license verification');
    return jwt.verify(token, publicKey, { algorithms: ['RS256'] });
};

module.exports = {
    signLicense,
    signResetCode,
    verifyLicense
};
