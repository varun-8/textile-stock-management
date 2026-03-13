const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

exports.default = async function(context) {
    console.log('--- Running afterPack hook to install backend dependencies ---');
    
    const unpackedDir = context.appOutDir;
    
    let destBackend;
    if (context.packager.platform.name === 'mac') {
        destBackend = path.join(unpackedDir, `${context.packager.appInfo.productFilename}.app`, 'Contents', 'Resources', 'backend');
    } else {
        destBackend = path.join(unpackedDir, 'resources', 'backend');
    }

    if (fs.existsSync(destBackend)) {
        console.log(`Installing production dependencies in ${destBackend}`);
        try {
            execSync('npm install --omit=dev', { cwd: destBackend, stdio: 'inherit' });
            console.log('Successfully installed backend dependencies!');
        } catch (error) {
            console.error('Failed to install backend dependencies:', error);
        }
    } else {
        console.warn(`WARNING: Backend directory not found at ${destBackend}`);
    }
};
