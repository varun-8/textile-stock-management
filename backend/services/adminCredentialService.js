const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

let bcrypt = null;
try {
    bcrypt = require('bcryptjs');
} catch (err) {
    console.warn('[Security] Optional dependency "bcryptjs" not installed. Falling back to SHA-256 credential hashing.');
}

const DATA_DIR = process.env.LICENSE_DATA_DIR || path.resolve(__dirname, '..', 'license-data');
const ADMIN_FILE = path.join(DATA_DIR, 'admin.json');

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

const hashPassword = async (password) => {
    const plain = String(password || '');
    if (bcrypt) {
        return bcrypt.hash(plain, 12);
    }
    return crypto.createHash('sha256').update(plain).digest('hex');
};

const verifyPassword = async (password, storedHash) => {
    const plain = String(password || '');
    if (!storedHash) return false;
    if (storedHash.startsWith('$2') && bcrypt) {
        return bcrypt.compare(plain, storedHash);
    }
    return crypto.createHash('sha256').update(plain).digest('hex') === storedHash;
};

const ensureAdminStore = async () => {
    const existing = readJson(ADMIN_FILE);
    if (existing?.username && existing?.passwordHash) {
        return existing;
    }

    const username = String(process.env.APP_USERNAME || 'admin').trim();
    const password = String(process.env.APP_PASSWORD || 'change-me').trim();
    const passwordHash = await hashPassword(password);
    const record = {
        username,
        passwordHash,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    writeJson(ADMIN_FILE, record);
    return record;
};

const getAdminUsername = async () => {
    const record = await ensureAdminStore();
    return record.username;
};

const authenticateAdmin = async (username, password) => {
    const record = await ensureAdminStore();
    if (String(username || '').trim() !== record.username) {
        return false;
    }
    return verifyPassword(password, record.passwordHash);
};

const resetAdminPassword = async (newPassword) => {
    const record = await ensureAdminStore();
    const passwordHash = await hashPassword(newPassword);
    const next = {
        ...record,
        passwordHash,
        updatedAt: new Date().toISOString()
    };
    writeJson(ADMIN_FILE, next);
    return { username: next.username };
};

module.exports = {
    authenticateAdmin,
    ensureAdminStore,
    getAdminUsername,
    resetAdminPassword
};
