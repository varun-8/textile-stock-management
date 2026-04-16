#!/usr/bin/env node

/**
 * Automatic Certificate Generation Script
 * Runs during `npm install` to generate self-signed TLS certificates
 * Only generates if certificates don't already exist
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const os = require('os');

const KEY_FILE = path.join(__dirname, 'stock-system.local-key.pem');
const CERT_FILE = path.join(__dirname, 'stock-system.local.pem');

function getLocalIPs() {
  const interfaces = os.networkInterfaces();
  const ips = [];
  
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Skip internal and non-IPv4 addresses
      if (iface.family === 'IPv4' && !iface.internal) {
        ips.push(iface.address);
      }
    }
  }
  
  return ips;
}

function certExists() {
  return fs.existsSync(KEY_FILE) && fs.existsSync(CERT_FILE);
}

function generateCerts() {
  try {
    // Check if mkcert is installed
    try {
      execSync('mkcert --version', { stdio: 'pipe' });
    } catch (e) {
      console.log('❌ mkcert not found. Install it:');
      console.log('   Windows (Chocolatey): choco install mkcert');
      console.log('   Windows (Scoop): scoop install mkcert');
      console.log('   macOS (Homebrew): brew install mkcert');
      console.log('   Linux: See https://github.com/FiloSottile/mkcert');
      console.log('\n⚠️  Certificates not generated - but system will still run (HTTPS not available)');
      return;
    }

    // Get local IP addresses
    const localIPs = getLocalIPs();
    
    // Build mkcert command with all possible names
    const names = [
      'localhost',
      '127.0.0.1',
      'stock-system.local',
      ...localIPs
    ];

    const uniqueNames = [...new Set(names)].join(' ');
    const cmd = `mkcert -key-file stock-system.local-key.pem -cert-file stock-system.local.pem ${uniqueNames}`;

    console.log('\n📜 Generating self-signed TLS certificates...');
    console.log(`   Hostnames: ${uniqueNames}`);
    
    execSync(cmd, { 
      cwd: __dirname,
      stdio: 'inherit'
    });

    console.log('✅ Certificates generated successfully!');
    console.log(`   Key:  ${KEY_FILE}`);
    console.log(`   Cert: ${CERT_FILE}`);
    console.log('\n💡 mkcert has installed root CA - no browser warnings on local network\n');

  } catch (error) {
    console.error('❌ Certificate generation failed:', error.message);
    console.log('\n⚠️  System will still run but HTTPS/PWA won\'t be available');
    console.log('   Run manually: mkcert -key-file stock-system.local-key.pem -cert-file stock-system.local.pem localhost 127.0.0.1 stock-system.local <your-ip>\n');
  }
}

// Main logic
if (!certExists()) {
  console.log('');
  generateCerts();
} else {
  console.log('✅ Certificates already exist, skipping generation');
}
