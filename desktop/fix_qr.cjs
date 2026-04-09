const fs = require('fs');
const file = 'src/pages/Scanners.jsx';
let c = fs.readFileSync(file, 'utf8');

// Replace getPairingUrl to use HTTPS port 5000 for BOTH the QR link AND server param
// This avoids Chrome's HTTPS-First upgrade (port 5001 has no HTTPS)
// And avoids mixed-content (HTTPS page calling HTTP API)
const oldPair = /const getPairingUrl = \(\) => \{[\s\S]*?\n    \};/;
const newPair = `const getPairingUrl = () => {
        if (!serverIp) return '';
        if (qrTarget === 'NEW' && !setupToken) return '';
        // Use HTTPS port 5000 - avoids Chrome HTTPS-First upgrade issues on port 5001
        const httpsUrl = \`https://\${serverIp}:5000\`;

        const tokenToUse = (qrTarget && typeof qrTarget === 'object') ? qrTarget.fingerprint : setupToken;
        // Pass server as HTTPS too so the PWA can call the API without mixed-content errors
        const urlParams = \`server=\${encodeURIComponent(httpsUrl)}\`;

        return \`\${httpsUrl}/pair?token=\${tokenToUse}&\${urlParams}&action=PAIR\`;
    };`;

const oldInstall = /const getInstallUrl = \(\) => \{[\s\S]*?\n    \};/;
const newInstall = `const getInstallUrl = () => {
        if (!serverIp) return '';
        return \`https://\${serverIp}:5000/pwa/ProdexaMobile.apk\`;
    };`;

const oldPwa = /const getPwaUrl = \(\) => \{[\s\S]*?\n    \};/;
const newPwa = `const getPwaUrl = () => {
        if (!serverIp) return '';
        return \`https://\${serverIp}:5000/pwa/index.html\`;
    };`;

c = c.replace(oldPair, newPair);
c = c.replace(oldInstall, newInstall);
c = c.replace(oldPwa, newPwa);

fs.writeFileSync(file, c);

// Verify
const idx = c.indexOf('getPairingUrl');
console.log('Done! New getPairingUrl:');
console.log(c.substring(idx, idx + 400));
