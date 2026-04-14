const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

let jwt = null;
try {
    jwt = require('jsonwebtoken');
} catch (err) {
    console.warn('[License] Optional dependency "jsonwebtoken" not installed. License verification will be limited.');
}

const DATA_DIR = process.env.LICENSE_DATA_DIR || path.resolve(__dirname, '..', 'license-data');
const LICENSE_FILE = path.join(DATA_DIR, 'license.json');
const DEVICE_FILE = path.join(DATA_DIR, 'device.json');

const ensureDataDir = () => {
    fs.mkdirSync(DATA_DIR, { recursive: true });
};

const readJson = (filePath) => {
    if (!fs.existsSync(filePath)) return null;
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (err) {
        return null;
    }
};

const writeJson = (filePath, value) => {
    ensureDataDir();
    fs.writeFileSync(filePath, JSON.stringify(value, null, 2));
};

const isLicenseRequired = () => {
    // Explicit LICENSE_REQUIRED env var takes precedence
    if (process.env.LICENSE_REQUIRED === 'false') {
        return false;
    }
    return process.env.LICENSE_REQUIRED === 'true' || process.env.NODE_ENV === 'production';
};

const getDeviceId = () => {
    const existing = readJson(DEVICE_FILE);
    if (existing?.deviceId) return existing.deviceId;

    const deviceId = crypto.randomUUID();
    writeJson(DEVICE_FILE, {
        deviceId,
        createdAt: new Date().toISOString()
    });
    return deviceId;
};

const getPublicKey = () => {
    const keyFromEnv = process.env.LICENSE_PUBLIC_KEY_PEM;
    if (keyFromEnv) return keyFromEnv;

    const keyPath = process.env.LICENSE_PUBLIC_KEY_PATH || path.join(DATA_DIR, 'license-public.pem');
    if (fs.existsSync(keyPath)) {
        return fs.readFileSync(keyPath, 'utf8');
    }

    return null;
};

const verifySignedCode = (code, expectedType) => {
    if (!jwt) {
        throw new Error('jsonwebtoken is not available for license verification');
    }

    const publicKey = getPublicKey();
    if (!publicKey) {
        throw new Error('License public key is not configured');
    }

    const payload = jwt.verify(code, publicKey, { algorithms: ['RS256'] });
    if (payload?.typ !== expectedType) {
        throw new Error(`Invalid ${expectedType.toLowerCase()} token`);
    }

    return payload;
};

const readLicenseRecord = () => readJson(LICENSE_FILE);

const writeLicenseRecord = (record) => {
    writeJson(LICENSE_FILE, record);
};

const getLicenseStatus = () => {
    const deviceId = getDeviceId();
    const required = isLicenseRequired();
    const record = readLicenseRecord();

    if (!required) {
        return {
            required: false,
            active: true,
            deviceId,
            companyName: record?.companyName || null,
            licenseId: record?.licenseId || null,
            workspaceCode: record?.workspaceCode || null,
            message: 'License enforcement is disabled in this environment.'
        };
    }

    if (!record?.activationCode) {
        return {
            required: true,
            active: false,
            deviceId,
            companyName: null,
            licenseId: null,
            workspaceCode: null,
            message: 'No license has been activated on this device.'
        };
    }

    try {
        const payload = verifySignedCode(record.activationCode, 'LICENSE');
        const active = payload.deviceId === deviceId;

        return {
            required: true,
            active,
            deviceId,
            companyName: payload.companyName || null,
            licenseId: payload.licenseId || null,
            workspaceCode: payload.workspaceCode || null,
            expiresAt: payload.expiresAt || null,
            issuedAt: payload.issuedAt || null,
            message: active
                ? 'License active.'
                : 'License exists, but it does not belong to this device.'
        };
    } catch (err) {
        return {
            required: true,
            active: false,
            deviceId,
            companyName: record?.companyName || null,
            licenseId: record?.licenseId || null,
            workspaceCode: record?.workspaceCode || null,
            message: err.message || 'License verification failed.'
        };
    }
};

const activateLicense = (activationCode) => {
    const payload = verifySignedCode(activationCode, 'LICENSE');
    const deviceId = getDeviceId();

    if (payload.deviceId && payload.deviceId !== deviceId) {
        throw new Error('License was issued for a different device.');
    }

    const record = {
        activationCode,
        licenseId: payload.licenseId || crypto.randomUUID(),
        companyName: payload.companyName || '',
        workspaceCode: payload.workspaceCode || '',
        deviceId,
        activatedAt: new Date().toISOString(),
        issuedAt: payload.issuedAt || null,
        expiresAt: payload.expiresAt || null,
        features: Array.isArray(payload.features) ? payload.features : [],
        payload
    };

    writeLicenseRecord(record);
    return getLicenseStatus();
};

const verifyResetCode = (resetCode) => {
    const payload = verifySignedCode(resetCode, 'RESET');
    const deviceId = getDeviceId();

    if (payload.deviceId && payload.deviceId !== deviceId) {
        throw new Error('Reset code was issued for a different device.');
    }

    return payload;
};

module.exports = {
    activateLicense,
    getDeviceId,
    getLicenseStatus,
    isLicenseRequired,
    verifyResetCode
};
