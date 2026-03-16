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
        console.log(`[AfterPack] Found backend at: ${destBackend}`);
        console.log(`[AfterPack] Installing production dependencies...`);
        try {
            // Check if npm is available
            execSync('npm --version', { stdio: 'ignore' });
            
            // Run npm install
            execSync('npm install --omit=dev', { 
                cwd: destBackend, 
                stdio: 'inherit',
                env: { ...process.env, NODE_ENV: 'production' }
            });
            console.log('[AfterPack] Successfully installed backend dependencies!');
        } catch (error) {
            console.error('[AfterPack] Error during backend dependency installation:');
            console.error(error.message);
            // We don't necessarily want to kill the whole build if it's a minor warning,
            // but for a production installer, missing dependencies is a fatal error.
            throw new Error(`Critical: Failed to install backend dependencies in ${destBackend}`);
        }
    } else {
        console.error(`[AfterPack] CRITICAL ERROR: Backend directory not found at ${destBackend}`);
        throw new Error('Backend directory missing during packaging');
    }
};
