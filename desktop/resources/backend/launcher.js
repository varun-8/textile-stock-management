#!/usr/bin/env node
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Determine MongoDB path based on execution context
let mongoPath;
let dataPath;

// Check if running as bundled exe
const executableDir = path.dirname(process.execPath);
const bundledMongo = path.join(executableDir, 'resources', 'mongo', 'mongod.exe');
const localMongo = path.join(__dirname, 'resources', 'mongo', 'mongod.exe');
const devMongo = path.join(__dirname, '..', 'backend', 'resources', 'mongo', 'mongod.exe');

// Find MongoDB executable
if (fs.existsSync(bundledMongo)) {
    mongoPath = bundledMongo;
    dataPath = path.join(os.homedir(), '.textile-stock', 'data');
} else if (fs.existsSync(localMongo)) {
    mongoPath = localMongo;
    dataPath = path.join(__dirname, 'data');
} else if (fs.existsSync(devMongo)) {
    mongoPath = devMongo;
    dataPath = path.join(__dirname, 'data');
} else {
    console.error('❌ MongoDB executable not found!');
    console.error('Expected locations:');
    console.error(`  - ${bundledMongo}`);
    console.error(`  - ${localMongo}`);
    console.error(`  - ${devMongo}`);
    process.exit(1);
}

// Create data directory if it doesn't exist
if (!fs.existsSync(dataPath)) {
    fs.mkdirSync(dataPath, { recursive: true });
}

console.log(`🚀 Starting MongoDB from: ${mongoPath}`);
console.log(`📁 Data directory: ${dataPath}`);

// Start MongoDB
const mongoProcess = spawn(mongoPath, [`--dbpath=${dataPath}`, '--port=27017'], {
    stdio: 'inherit',
    windowsVerbatimArguments: true
});

mongoProcess.on('error', (err) => {
    console.error('❌ Failed to start MongoDB:', err.message);
    process.exit(1);
});

mongoProcess.on('exit', (code) => {
    console.log(`MongoDB exited with code ${code}`);
    process.exit(code);
});

// Wait for MongoDB to fully start before starting backend
setTimeout(() => {
    console.log('\n✅ MongoDB started. Starting backend server...\n');
    require('./server.js');
}, 3000);

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down...');
    mongoProcess.kill();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Shutting down...');
    mongoProcess.kill();
    process.exit(0);
});
