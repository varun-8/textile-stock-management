const fs = require('fs');
const file = 'server.js';
let c = fs.readFileSync(file, 'utf8');

// Restore secure CORS
const aggressiveCors = 'app.use(cors({ origin: true, credentials: true }));';
const secureCors = `app.use(cors({
    origin: (origin, callback) => {
        if (isOriginAllowed(origin)) return callback(null, true);
        return callback(new Error('CORS blocked'), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
}));`;

if (c.includes(aggressiveCors)) {
    c = c.replace(aggressiveCors, secureCors);
}

// Ensure isOriginAllowed includes the native origins
if (c.includes('return true; // DEBUG: Allow all')) {
    c = c.replace('return true; // DEBUG: Allow all', "if (origin === 'capacitor://localhost' || origin === 'ionic://localhost' || origin === 'http://localhost') return true;");
}

fs.writeFileSync(file, c);
console.log('✅ Successfully restored secure CORS in server.js.');
