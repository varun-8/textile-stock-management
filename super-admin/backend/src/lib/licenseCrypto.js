const fs = require('fs');
const path = require('path');

let jwt = null;
try {
    jwt = require('jsonwebtoken');
} catch (err) {
    throw new Error('jsonwebtoken is required for super-admin license signing');
}

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
    if (!privateKey) throw new Error('LICENSE_PRIVATE_KEY is not configured');
    return jwt.sign(payload, privateKey, { algorithm: 'RS256' });
};

const signResetCode = (payload) => {
    const privateKey = getPrivateKey();
    if (!privateKey) throw new Error('LICENSE_PRIVATE_KEY is not configured');
    const options = { algorithm: 'RS256' };
    if (payload.expiresAt) {
        const expiresAt = new Date(payload.expiresAt).getTime();
        if (Number.isFinite(expiresAt) && expiresAt > Date.now()) {
            options.expiresIn = Math.floor((expiresAt - Date.now()) / 1000);
        }
    }
    return jwt.sign(payload, privateKey, options);
};

const verifyLicense = (token) => {
    const publicKey = getPublicKey();
    if (!publicKey) throw new Error('LICENSE_PUBLIC_KEY is not configured');
    return jwt.verify(token, publicKey, { algorithms: ['RS256'] });
};

module.exports = {
    signLicense,
    signResetCode,
    verifyLicense
};
