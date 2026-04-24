const path = require('path');

const backendRoot = path.resolve(__dirname, '..');

const getRuntimeBaseDir = () => {
    if (process.env.APP_RUNTIME_DIR) {
        return path.resolve(process.env.APP_RUNTIME_DIR);
    }
    return backendRoot;
};

const getConfigPath = () => {
    if (process.env.APP_CONFIG_PATH) {
        return path.resolve(process.env.APP_CONFIG_PATH);
    }
    return path.join(backendRoot, 'config.json');
};

const getDefaultBackupDir = () => {
    if (process.env.DEFAULT_BACKUP_PATH) {
        return path.resolve(process.env.DEFAULT_BACKUP_PATH);
    }
    return path.join(getRuntimeBaseDir(), 'backups');
};

const resolveBackupPath = (backupPath) => {
    const rawPath = typeof backupPath === 'string' && backupPath.trim()
        ? backupPath.trim()
        : getDefaultBackupDir();

    if (path.isAbsolute(rawPath)) {
        return rawPath;
    }

    return path.resolve(getRuntimeBaseDir(), rawPath);
};

module.exports = {
    getRuntimeBaseDir,
    getConfigPath,
    getDefaultBackupDir,
    resolveBackupPath
};
