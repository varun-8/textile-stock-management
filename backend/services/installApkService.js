const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '../..');
const targetDir = path.resolve(repoRoot, 'backend/public/pwa');
const targetApk = path.resolve(targetDir, 'ProdexaMobile.apk');

const sourceCandidates = [
    path.resolve(repoRoot, 'mobile-web/android/app/build/outputs/apk/release/app-release.apk'),
    path.resolve(repoRoot, 'mobile-web/android/app/build/outputs/apk/debug/app-debug.apk')
];

let guardianTimer = null;

const ensureInstallApk = () => {
    if (fs.existsSync(targetApk)) {
        const stat = fs.statSync(targetApk);
        return {
            exists: true,
            source: targetApk,
            target: targetApk,
            size: stat.size,
            copied: false
        };
    }

    const sourceApk = sourceCandidates.find((candidate) => fs.existsSync(candidate));
    if (!sourceApk) {
        return {
            exists: false,
            source: null,
            target: targetApk,
            size: 0,
            copied: false,
            checkedPaths: sourceCandidates
        };
    }

    fs.mkdirSync(targetDir, { recursive: true });
    fs.copyFileSync(sourceApk, targetApk);
    const stat = fs.statSync(targetApk);

    return {
        exists: true,
        source: sourceApk,
        target: targetApk,
        size: stat.size,
        copied: true,
        checkedPaths: sourceCandidates
    };
};

const startInstallApkGuardian = (intervalMs = 30000) => {
    if (guardianTimer) return guardianTimer;
    guardianTimer = setInterval(() => {
        try {
            ensureInstallApk();
        } catch (err) {
            console.warn('Install APK guardian failed:', err.message);
        }
    }, intervalMs);
    return guardianTimer;
};

const stopInstallApkGuardian = () => {
    if (guardianTimer) {
        clearInterval(guardianTimer);
        guardianTimer = null;
    }
};

module.exports = {
    ensureInstallApk,
    startInstallApkGuardian,
    stopInstallApkGuardian,
    targetApk,
    sourceCandidates
};
