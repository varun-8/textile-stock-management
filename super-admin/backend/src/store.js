const fs = require('fs');
const path = require('path');

const DATA_DIR = process.env.SUPER_ADMIN_DATA_DIR || path.resolve(process.cwd(), 'data');

const FILES = {
    licenses: path.join(DATA_DIR, 'licenses.json'),
    users: path.join(DATA_DIR, 'users.json'),
    audit: path.join(DATA_DIR, 'audit-log.json'),
    clients: path.join(DATA_DIR, 'clients.json'),
    systems: path.join(DATA_DIR, 'systems.json'),
    company: path.join(DATA_DIR, 'company-profile.json')
};

const ensureDir = () => {
    fs.mkdirSync(DATA_DIR, { recursive: true });
};

const readJson = (file, fallback) => {
    if (!fs.existsSync(file)) {
        return fallback;
    }

    try {
        return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch {
        return fallback;
    }
};

const writeJson = (file, data) => {
    ensureDir();
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
};

const readItems = (file) => readJson(file, { items: [] }).items || [];

const writeItems = (file, items) => {
    writeJson(file, { items });
};

const upsertItem = (file, matchFn, nextItem) => {
    const items = readItems(file);
    const index = items.findIndex(matchFn);
    if (index < 0) {
        items.unshift(nextItem);
    } else {
        items[index] = nextItem;
    }
    writeItems(file, items);
    return nextItem;
};

const updateItem = (file, matchFn, updater) => {
    const items = readItems(file);
    const index = items.findIndex(matchFn);
    if (index < 0) {
        return null;
    }

    const next = updater(items[index]);
    items[index] = next;
    writeItems(file, items);
    return next;
};

const listLicenses = () => readItems(FILES.licenses);

const saveLicense = (license) => upsertItem(FILES.licenses, (item) => item.licenseId === license.licenseId, license);

const updateLicense = (licenseId, updater) =>
    updateItem(FILES.licenses, (item) => item.licenseId === licenseId, updater);

const listUsers = () => readItems(FILES.users);

const findUserByUsername = (username) =>
    listUsers().find((item) => String(item.username || '').toLowerCase() === String(username || '').toLowerCase()) || null;

const findUserByEmail = (email) => findUserByUsername(email);

const findUserById = (userId) => listUsers().find((item) => item.userId === userId) || null;

const saveUser = (user) => upsertItem(FILES.users, (item) => item.userId === user.userId, user);

const updateUser = (userId, updater) =>
    updateItem(FILES.users, (item) => item.userId === userId, updater);

const listAuditLogs = () => readItems(FILES.audit);

const appendAuditLog = (entry) => {
    const items = readItems(FILES.audit);
    items.unshift(entry);
    writeItems(FILES.audit, items);
    return entry;
};

const listClients = () => readItems(FILES.clients);

const saveClient = (client) => upsertItem(FILES.clients, (item) => item.clientId === client.clientId, client);

const updateClient = (clientId, updater) =>
    updateItem(FILES.clients, (item) => item.clientId === clientId, updater);

const listSystems = () => readItems(FILES.systems);

const saveSystem = (system) => upsertItem(FILES.systems, (item) => item.systemId === system.systemId, system);

const updateSystem = (systemId, updater) =>
    updateItem(FILES.systems, (item) => item.systemId === systemId, updater);

const defaultCompanyProfile = () => ({
    companyName: process.env.SUPER_ADMIN_COMPANY_NAME || 'LoomTrack',
    portalTitle: process.env.SUPER_ADMIN_PORTAL_TITLE || 'Super Admin Portal',
    supportEmail: process.env.SUPER_ADMIN_SUPPORT_EMAIL || 'support@loomtrack.com',
    supportPhone: process.env.SUPER_ADMIN_SUPPORT_PHONE || '',
    billingEmail: process.env.SUPER_ADMIN_BILLING_EMAIL || '',
    address: process.env.SUPER_ADMIN_COMPANY_ADDRESS || '',
    brandColor: process.env.SUPER_ADMIN_BRAND_COLOR || '#6366f1',
    updatedAt: null,
    updatedBy: null
});

const getCompanyProfile = () => {
    const existing = readJson(FILES.company, null);
    if (existing && typeof existing === 'object' && !Array.isArray(existing)) {
        return { ...defaultCompanyProfile(), ...existing };
    }

    return defaultCompanyProfile();
};

const saveCompanyProfile = (profile) => {
    const next = { ...defaultCompanyProfile(), ...profile };
    writeJson(FILES.company, next);
    return next;
};

module.exports = {
    listLicenses,
    saveLicense,
    updateLicense,
    listUsers,
    findUserByUsername,
    findUserByEmail,
    findUserById,
    saveUser,
    updateUser,
    listAuditLogs,
    appendAuditLog,
    listClients,
    saveClient,
    updateClient,
    listSystems,
    saveSystem,
    updateSystem,
    getCompanyProfile,
    saveCompanyProfile
};
