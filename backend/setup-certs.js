#!/usr/bin/env node

/**
 * Automatic Certificate Generation Script
 * Runs during `npm install` to generate self-signed TLS certificates
 * Features:
 * - Skips if valid cert exists
 * - Auto-regenerates if cert expires within 30 days
 * - Auto-detects local IPs
 * - Shows clear messages if mkcert not available
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

function getCertExpiryDate(certPath) {
  try {
    // Parse certificate expiration using openssl
    const cmd = `openssl x509 -in "${certPath}" -noout -enddate`;
    const output = execSync(cmd, { encoding: 'utf-8', stdio: 'pipe' });
    const dateStr = output.replace('notAfter=', '').trim();
    return new Date(dateStr);
  } catch (e) {
    return null;
  }
}

function daysUntilExpiry(certPath) {
  const expiryDate = getCertExpiryDate(certPath);
  if (!expiryDate) return null;
  
  const now = new Date();
  const diff = expiryDate - now;
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  
  return days;
}

function certExists() {
  return fs.existsSync(KEY_FILE) && fs.existsSync(CERT_FILE);
}

function isMkcertInstalled() {
  try {
    execSync('mkcert --version', { stdio: 'pipe' });
    return true;
  } catch (e) {
    return false;
  }
}

function generateCerts() {
  try {
    if (!isMkcertInstalled()) {
      console.log('❌ mkcert not installed. Please install it:');
      console.log('   Windows (Chocolatey): choco install mkcert');
      console.log('   Windows (Scoop): scoop install mkcert');
      console.log('   macOS (Homebrew): brew install mkcert');
      console.log('   Linux: https://github.com/FiloSottile/mkcert');
      console.log('\n   Note: Certificates are already in git repo, you only need mkcert if regenerating them.\n');
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
  }
}

function checkCertExpiry() {
  if (!certExists()) {
    return false; // Cert doesn't exist, will be regenerated
  }

  const daysLeft = daysUntilExpiry(CERT_FILE);
  
  if (daysLeft === null) {
    console.log('⚠️  Could not determine certificate expiration date');
    return false;
  }

  console.log(`📅 Certificate expires in ${daysLeft} days`);

  if (daysLeft < 0) {
    console.log('❌ Certificate has EXPIRED! Regenerating...\n');
    return false; // Need to regenerate
  }

  if (daysLeft < 30) {
    console.log('⚠️  Certificate expiring soon! Regenerating...\n');
    return false; // Regenerate if expiring within 30 days
  }

  return true; // Cert is valid
}

// Main logic
console.log('');

if (certExists() && checkCertExpiry()) {
  console.log('✅ Certificates valid, skipping generation\n');
} else {
  if (certExists()) {
    console.log('🔄 Removing expired/expiring certificates...');
    try {
      fs.unlinkSync(KEY_FILE);
      fs.unlinkSync(CERT_FILE);
    } catch (e) {
      console.error('Failed to remove old certificates:', e.message);
    }
  }
  generateCerts();
}

