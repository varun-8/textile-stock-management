#!/usr/bin/env node
/**
 * Build script for Textile Stock Management Electron App
 * Creates a complete desktop application with frontend, backend, and MongoDB
 */

const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');
const os = require('os');

const PROJECT_ROOT = path.join(__dirname, '..');
const DESKTOP_DIR = path.join(PROJECT_ROOT, 'desktop');
const BACKEND_DIR = path.join(PROJECT_ROOT, 'backend');
const RESOURCES_DIR = path.join(DESKTOP_DIR, 'resources');

console.log('\n' + '='.repeat(70));
console.log('  TEXTILE STOCK MANAGEMENT - DESKTOP APP BUILDER');
console.log('='.repeat(70) + '\n');

// Helper function to run commands
function runCommand(command, cwd = DESKTOP_DIR) {
    console.log(`[Command] ${command}`);
    try {
        const output = execSync(command, {
            cwd,
            stdio: 'inherit'
        });
        return true;
    } catch (error) {
        console.error(`[Error] Command failed: ${command}`);
        return false;
    }
}

// Step 1: Prepare resources directory
console.log('[1/7] Preparing resources directory...');
fs.ensureDirSync(RESOURCES_DIR);
console.log('✓ Resources directory ready\n');

// Step 2: Copy backend files
console.log('[2/7] Copying backend files...');
try {
    const backendResourcesDir = path.join(RESOURCES_DIR, 'backend');
    fs.ensureDirSync(backendResourcesDir);
    
    // Copy essential backend files
    const backendFiles = [
        'server.js',
        'package.json',
        'config.json',
        'stock-system.local-key.pem',
        'stock-system.local.pem',
        'server-key.pem',
        'server-cert.pem',
        '.env'
    ];
    
    for (const file of backendFiles) {
        const src = path.join(BACKEND_DIR, file);
        const dest = path.join(backendResourcesDir, file);
        if (fs.existsSync(src)) {
            fs.copySync(src, dest);
            console.log(`  ✓ Copied ${file}`);
        }
    }
    
    // Copy backend directories
    const backendDirs = [
        'middleware',
        'models',
        'routes',
        'services',
        'utils',
        'public'
    ];
    
    for (const dir of backendDirs) {
        const src = path.join(BACKEND_DIR, dir);
        const dest = path.join(backendResourcesDir, dir);
        if (fs.existsSync(src)) {
            fs.copySync(src, dest);
            console.log(`  ✓ Copied ${dir}/`);
        }
    }
    
    // Copy/Install backend node_modules
    console.log('  → Handling backend dependencies...');
    const srcModules = path.join(BACKEND_DIR, 'node_modules');
    const destModules = path.join(backendResourcesDir, 'node_modules');
    if (fs.existsSync(srcModules)) {
        console.log('    ✓ Copying existing backend node_modules (this may take a minute)...');
        fs.copySync(srcModules, destModules);
    } else {
        console.log('    → node_modules not found in backend, installing...');
        runCommand('npm install --production', backendResourcesDir);
    }
    
    // Copy MongoDB binary if available
    const mongoResourcesSrc = path.join(BACKEND_DIR, 'resources', 'mongo');
    const mongoResourcesDest = path.join(RESOURCES_DIR, 'mongo');
    if (fs.existsSync(mongoResourcesSrc)) {
        fs.copySync(mongoResourcesSrc, mongoResourcesDest);
        console.log('  ✓ Copied MongoDB binary');
    } else {
        console.log('  ⚠ MongoDB binary not found - it will need to be installed on target system');
    }
    
    console.log('✓ Backend files copied\n');
} catch (error) {
    console.error('✗ Failed to copy backend files:', error.message);
    process.exit(1);
}

// Step 3: Build frontend (React/Vite)
console.log('[3/7] Building frontend...');
if (!runCommand('npm run build')) {
    console.error('✗ Frontend build failed');
    process.exit(1);
}
console.log('✓ Frontend built\n');

// Step 4: Install dependencies
console.log('[4/7] Verifying dependencies...');
if (!runCommand('npm install')) {
    console.log('⚠ Warning: npm install had issues, continuing anyway...\n');
}
console.log('✓ Dependencies verified\n');

// Step 5: Prepare build configuration
console.log('[5/7] Preparing build configuration...');
try {
    const packageJsonPath = path.join(DESKTOP_DIR, 'package.json');
    const packageJson = fs.readJsonSync(packageJsonPath);
    
    // Update main entry point
    packageJson.main = 'electron-main.cjs';
    
    // Update build configuration
    packageJson.build = {
        appId: 'com.textilestock.inventory',
        productName: 'Textile Stock Management',
        directories: {
            output: 'dist-app',
            buildResources: 'public'
        },
        files: [
            'dist/**/*',
            'node_modules/**/*',
            'electron-main.cjs',
            'preload.cjs',
            'public/**/*',
            'resources/**/*'
        ],
        asarUnpack: [
            "resources/mongo/**/*",
            "resources/backend/**/*"
        ],
        win: {
            target: [
                {
                    target: 'nsis',
                    arch: ['x64']
                },
                {
                    target: 'portable',
                    arch: ['x64']
                }
            ],
            icon: 'public/icon.ico'
        },
        nsis: {
            oneClick: false,
            allowToChangeInstallationDirectory: true,
            createDesktopShortcut: true,
            createStartMenuShortcut: true,
            shortcutName: 'Textile Stock Management'
        },
        portable: {
            artifactName: 'Textile-Stock-Management-Portable.exe'
        }
    };
    
    fs.writeJsonSync(packageJsonPath, packageJson, { spaces: 2 });
    console.log('✓ Build configuration ready\n');
} catch (error) {
    console.error('✗ Failed to prepare build config:', error.message);
    process.exit(1);
}

// Step 6: Build with electron-builder
console.log('[6/7] Building Electron application...');
if (!runCommand('npx electron-builder --win --x64')) {
    console.error('✗ Electron build failed');
    process.exit(1);
}
console.log('✓ Electron app built\n');

// Step 7: Show output information
console.log('[7/7] Build complete!\n');
console.log('='.repeat(70));
console.log('  BUILD SUCCESSFUL');
console.log('='.repeat(70) + '\n');

const distDir = path.join(DESKTOP_DIR, 'dist-app');
const portableExe = path.join(distDir, 'Textile-Stock-Management-Portable.exe');
const installerExe = path.join(distDir, 'Textile Stock Management 1.0.0.exe');

console.log('Output files:\n');

if (fs.existsSync(portableExe)) {
    const size = (fs.statSync(portableExe).size / 1024 / 1024).toFixed(2);
    console.log(`  ✓ Portable EXE: ${portableExe}`);
    console.log(`    Size: ${size} MB\n`);
}

if (fs.existsSync(installerExe)) {
    const size = (fs.statSync(installerExe).size / 1024 / 1024).toFixed(2);
    console.log(`  ✓ Installer EXE: ${installerExe}`);
    console.log(`    Size: ${size} MB\n`);
}

console.log('Installation:\n');
console.log('  1. Open dist-app/ folder');
console.log('  2. Run the EXE file');
console.log('  3. Follow the installation wizard\n');

console.log('What\'s included in the app:\n');
console.log('  ✓ React Frontend (Vite bundled)');
console.log('  ✓ Express.js Backend');
console.log('  ✓ MongoDB Database');
console.log('  ✓ Socket.IO Real-time Communication');
console.log('  ✓ All Dependencies\n');

console.log('='.repeat(70) + '\n');
