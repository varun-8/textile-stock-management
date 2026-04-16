#!/usr/bin/env node

/**
 * Initial Setup Script for Textile Stock Management
 * Runs automatically after npm install to prepare the system
 * 
 * Tasks:
 * 1. Generate TLS certificates (if missing)
 * 2. Build PWA assets
 * 3. Copy PWA to backend public folder
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const PROJECT_ROOT = path.join(__dirname, '..');
const BACKEND_DIR = path.join(PROJECT_ROOT, 'backend');
const MOBILE_WEB_DIR = path.join(PROJECT_ROOT, 'mobile-web');
const PWA_SOURCE = path.join(MOBILE_WEB_DIR, 'dist');
const PWA_DEST = path.join(BACKEND_DIR, 'public', 'pwa');

console.log('\n🚀 Initial Setup Starting...\n');

// Step 1: Build PWA
console.log('📱 Building PWA assets...');
try {
  // Check if mobile-web exists
  if (!fs.existsSync(MOBILE_WEB_DIR)) {
    console.log('⚠️  mobile-web folder not found, skipping PWA build');
  } else {
    console.log('   Running: npm run build:pwa in mobile-web/');
    execSync('npm run build:pwa', {
      cwd: MOBILE_WEB_DIR,
      stdio: 'inherit'
    });
    console.log('✅ PWA built successfully');

    // Step 2: Copy PWA to backend
    console.log('\n📋 Copying PWA to backend/public/pwa...');
    
    // Create destination if it doesn't exist
    if (!fs.existsSync(PWA_DEST)) {
      fs.mkdirSync(PWA_DEST, { recursive: true });
    }

    // Copy all files from dist to public/pwa
    if (fs.existsSync(PWA_SOURCE)) {
      const files = fs.readdirSync(PWA_SOURCE);
      files.forEach(file => {
        const src = path.join(PWA_SOURCE, file);
        const dst = path.join(PWA_DEST, file);
        
        if (fs.statSync(src).isDirectory()) {
          // Copy directory recursively
          execSync(`xcopy "${src}" "${dst}" /E /I /Y`, {
            stdio: 'pipe'
          });
        } else {
          // Copy file
          fs.copyFileSync(src, dst);
        }
      });
      console.log('✅ PWA copied to backend/public/pwa');
    } else {
      console.log('⚠️  PWA dist folder not found');
    }
  }
} catch (error) {
  console.error('❌ PWA build failed:', error.message);
  console.log('\n⚠️  You may need to build PWA manually:');
  console.log('   cd mobile-web');
  console.log('   npm run build:pwa');
  console.log('   (then copy dist folder to backend/public/pwa)\n');
}

console.log('\n✨ Setup complete!\n');
