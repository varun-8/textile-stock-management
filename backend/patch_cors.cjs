const fs = require('fs');
const file = 'server.js';
let c = fs.readFileSync(file, 'utf8');

const oldLine = "if (origin === 'capacitor://localhost' || origin === 'ionic://localhost') return true;";
const newLine = "if (origin === 'capacitor://localhost' || origin === 'ionic://localhost' || origin === 'http://localhost') return true;";

if (c.includes(oldLine)) {
    c = c.replace(oldLine, newLine);
    fs.writeFileSync(file, c);
    console.log('✅ Successfully patched server.js CORS origins.');
} else {
    console.log('❌ Could not find the line in server.js. Content might have changed.');
}
