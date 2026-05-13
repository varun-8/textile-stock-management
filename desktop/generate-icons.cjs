const sharp = require('sharp');
const toIco = require('to-ico');
const fs = require('fs');
const path = require('path');

const inputImage = path.join(__dirname, 'icon.png');
const outputIco = path.join(__dirname, 'public', 'icon.ico');
const outputPng = path.join(__dirname, 'public', 'icon.png');

async function generateIcons() {
    console.log('Generating icons...');
    
    if (!fs.existsSync(inputImage)) {
        console.error(`Input image not found: ${inputImage}`);
        process.exit(1);
    }

    // 1. Ensure public directory exists
    const publicDir = path.join(__dirname, 'public');
    if (!fs.existsSync(publicDir)) {
        fs.mkdirSync(publicDir, { recursive: true });
    }

    // 2. Generate a clean 512x512 PNG for the public folder
    await sharp(inputImage)
        .resize(512, 512, {
            fit: 'contain',
            background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .toFile(outputPng + '.tmp');
    
    if (fs.existsSync(outputPng)) fs.unlinkSync(outputPng);
    fs.renameSync(outputPng + '.tmp', outputPng);
    console.log(`Generated ${outputPng}`);

    // 3. Generate ICO with multiple sizes
    const sizes = [16, 32, 48, 64, 128, 256];
    const buffers = await Promise.all(
        sizes.map(size => 
            sharp(inputImage)
                .resize(size, size, {
                    fit: 'contain',
                    background: { r: 0, g: 0, b: 0, alpha: 0 }
                })
                .png()
                .toBuffer()
        )
    );

    const icoBuffer = await toIco(buffers);
    fs.writeFileSync(outputIco, icoBuffer);
    console.log(`Generated ${outputIco}`);
}

generateIcons().catch(err => {
    console.error('Failed to generate icons:', err);
    process.exit(1);
});
