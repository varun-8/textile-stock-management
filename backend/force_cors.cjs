const fs = require('fs');
const file = 'server.js';
let c = fs.readFileSync(file, 'utf8');

// Replace Socket.io CORS
const socketOld = /cors: \{[\s\S]*?origin: \(origin, callback\) => \{[\s\S]*?\},[\s\S]*?methods: \['GET', 'POST'\][\s\S]*?\}/;
const socketNew = `cors: {
        origin: true,
        methods: ['GET', 'POST']
    }`;
c = c.replace(socketOld, socketNew);

// Replace Express CORS
const expressOld = /app\.use\(cors\(\{[\s\S]*?origin: \(origin, callback\) => \{[\s\S]*?\},[\s\S]*?credentials: true,[\s\S]*?methods: \['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'\][\s\S]*?\}\)\);/;
const expressNew = `app.use(cors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
}));`;
c = c.replace(expressOld, expressNew);

fs.writeFileSync(file, c);
console.log('✅ Aggressive CORS restored via regex script.');
