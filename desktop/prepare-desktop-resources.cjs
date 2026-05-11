#!/usr/bin/env node
const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');

const PROJECT_ROOT = path.join(__dirname, '..');
const DESKTOP_DIR = __dirname;
const BACKEND_DIR = path.join(PROJECT_ROOT, 'backend');
const RESOURCES_DIR = path.join(DESKTOP_DIR, 'resources');
const BACKEND_RESOURCES_DIR = path.join(RESOURCES_DIR, 'backend');
const NODE_RESOURCES_DIR = path.join(RESOURCES_DIR, 'node');
const MONGO_RESOURCES_SRC = path.join(BACKEND_DIR, 'resources', 'mongo');
const MONGO_RESOURCES_DEST = path.join(RESOURCES_DIR, 'mongo');

function runCommand(command, cwd) {
    execSync(command, {
        cwd,
        stdio: 'inherit'
    });
}

function copyIfExists(src, dest) {
    if (fs.existsSync(src)) {
        fs.copySync(src, dest, { overwrite: true });
        return true;
    }
    return false;
}

function prepareDesktopResources() {
    fs.ensureDirSync(RESOURCES_DIR);
    fs.ensureDirSync(BACKEND_RESOURCES_DIR);

    const backendFiles = [
        'server.js',
        'launcher.js',
        'package.json',
        'package-lock.json',
        'config.json',
        'stock-system.local-key.pem',
        'stock-system.local.pem',
        'server-key.pem',
        'server-cert.pem',
        '.env'
    ];

    for (const file of backendFiles) {
        copyIfExists(path.join(BACKEND_DIR, file), path.join(BACKEND_RESOURCES_DIR, file));
    }

    const backendDirs = [
        'middleware',
        'models',
        'routes',
        'services',
        'utils',
        'public'
    ];

    for (const dir of backendDirs) {
        copyIfExists(path.join(BACKEND_DIR, dir), path.join(BACKEND_RESOURCES_DIR, dir));
    }

    const srcModules = path.join(BACKEND_DIR, 'node_modules');
    const destModules = path.join(BACKEND_RESOURCES_DIR, 'node_modules');
    if (fs.existsSync(srcModules)) {
        fs.removeSync(destModules);
        fs.copySync(srcModules, destModules);
    } else {
        runCommand('npm install --omit=dev', BACKEND_RESOURCES_DIR);
    }

    fs.ensureDirSync(NODE_RESOURCES_DIR);
    if (process.execPath && fs.existsSync(process.execPath)) {
        fs.copySync(process.execPath, path.join(NODE_RESOURCES_DIR, 'node.exe'));
    }

    if (fs.existsSync(MONGO_RESOURCES_SRC)) {
        fs.removeSync(MONGO_RESOURCES_DEST);
        fs.copySync(MONGO_RESOURCES_SRC, MONGO_RESOURCES_DEST);
    }
}

try {
    prepareDesktopResources();
    console.log('Desktop resources prepared successfully.');
} catch (error) {
    console.error('Failed to prepare desktop resources:', error);
    process.exit(1);
}
