const fs = require('fs');
const file = 'server.js';
let c = fs.readFileSync(file, 'utf8');

// Aggressive CORS for debugging
const oldAppCors = /app\.use\(cors\(\{[\s\S]*?origin:[\s\S]*?\}\)\);/;
const newAppCors = 'app.use(cors({ origin: true, credentials: true }));';

c = c.replace(oldAppCors, newAppCors);

// Also patch isOriginAllowed to be safe
const oldLine = "if (origin === 'capacitor://localhost' || origin === 'ionic://localhost' || origin === 'http://localhost') return true;";
const newLine = "return true; // DEBUG: Allow all";

if (c.includes(oldLine)) {
    c = c.replace(oldLine, newLine);
}

fs.writeFileSync(file, c);
console.log('✅ Successfully applied Aggressive CORS to server.js.');
