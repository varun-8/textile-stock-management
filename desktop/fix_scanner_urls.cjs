const fs = require('fs');
const file = 'src/pages/Scanners.jsx';
let content = fs.readFileSync(file, 'utf8');

// Replace https:5000 back to http:5001 for ALL three URL functions
// The mixed-content restriction means HTTPS page can't call HTTP API
// So we must use plain HTTP throughout
content = content.replace(/`https:\/\/\$\{serverIp\}:5000`/g, '`http://${serverIp}:${MOBILE_LAN_PORT}`');
content = content.replace(/`https:\/\/\$\{serverIp\}:5000\/pwa\/index\.html`/g, '`http://${serverIp}:${MOBILE_LAN_PORT}/pwa/index.html`');
content = content.replace(/`https:\/\/\$\{serverIp\}:5000\/pwa\/ProdexaMobile\.apk`/g, '`http://${serverIp}:${MOBILE_LAN_PORT}/pwa/ProdexaMobile.apk`');

// Also remove the httpFallback lines I added earlier if present
content = content.replace(/\s*const httpFallback = `http:\/\/\$\{serverIp\}:\$\{MOBILE_LAN_PORT\}`;\n\s*const urlParams = `server=\$\{encodeURIComponent\(httpFallback\)\}`;/g, 
  '\n        const urlParams = `server=${encodeURIComponent(lanUrl)}`;');

fs.writeFileSync(file, content);
console.log('Fixed - all QR URLs now use HTTP port 5001');
console.log('');
console.log('Current getPairingUrl section:');
const section = content.substring(content.indexOf('getPairingUrl'), content.indexOf('getInstallUrl'));
console.log(section);
