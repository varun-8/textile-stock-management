const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

// Changed to 8.2.2 to match the local database's Feature Compatibility Version of 8.2
const url = 'https://fastdl.mongodb.org/windows/mongodb-windows-x86_64-8.2.2.zip';
const zipPath = path.join(__dirname, 'mongodb.zip');
const destDir = path.join(__dirname, 'resources', 'mongo');

if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
} else {
    // Clear the directory first
    fs.rmSync(destDir, { recursive: true, force: true });
    fs.mkdirSync(destDir, { recursive: true });
}

console.log('Downloading MongoDB 8.2.2...');
const file = fs.createWriteStream(zipPath);

https.get(url, (response) => {
    response.pipe(file);
    file.on('finish', () => {
        file.close();
        console.log('Download complete. Extracting...');
        try {
            // Using tar for extraction, available natively in modern Windows
            execSync(`tar -xf mongodb.zip`, { stdio: 'inherit' });
            console.log('Extraction complete. Moving binaries...');
            const extractedDir = 'mongodb-win32-x86_64-windows-8.2.2';
            const binDir = path.join(__dirname, extractedDir, 'bin');
            
            if (fs.existsSync(binDir)) {
                const files = fs.readdirSync(binDir);
                for (const f of files) {
                    fs.copyFileSync(path.join(binDir, f), path.join(destDir, f));
                }
                console.log('✓ Successfully bundled MongoDB 8.2.2 into resources/mongo');
            } else {
                console.error('bin directory not found after extraction');
            }
            
            // Cleanup
            fs.unlinkSync(zipPath);
            fs.rmSync(path.join(__dirname, extractedDir), { recursive: true, force: true });
        } catch (err) {
            console.error('Error during extraction:', err);
        }
    });
}).on('error', (err) => {
    fs.unlink(zipPath, () => {});
    console.error('Download failed:', err);
});
