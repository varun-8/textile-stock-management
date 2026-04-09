const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.SUPER_ADMIN_DATA_DIR || path.resolve(process.cwd(), 'data');
const FILE = path.join(DATA_DIR, 'licenses.json');

const ensureDir = () => {
    fs.mkdirSync(DATA_DIR, { recursive: true });
};

const readStore = () => {
    if (!fs.existsSync(FILE)) {
        return { items: [] };
    }

    try {
        return JSON.parse(fs.readFileSync(FILE, 'utf8'));
    } catch {
        return { items: [] };
    }
};

const writeStore = (store) => {
    ensureDir();
    fs.writeFileSync(FILE, JSON.stringify(store, null, 2));
};

const listLicenses = () => readStore().items || [];

const saveLicense = (license) => {
    const store = readStore();
    store.items = Array.isArray(store.items) ? store.items : [];
    store.items.unshift(license);
    writeStore(store);
    return license;
};

const updateLicense = (licenseId, updater) => {
    const store = readStore();
    store.items = Array.isArray(store.items) ? store.items : [];
    const index = store.items.findIndex((item) => item.licenseId === licenseId);
    if (index < 0) return null;
    const next = updater(store.items[index]);
    store.items[index] = next;
    writeStore(store);
    return next;
};

module.exports = {
    listLicenses,
    saveLicense,
    updateLicense
};
