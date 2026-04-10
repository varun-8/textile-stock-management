import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, '..');
const sourceCandidates = [
  path.resolve(projectRoot, 'android', 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk'),
  path.resolve(projectRoot, 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk')
];
const targetDir = path.resolve(projectRoot, '..', 'backend', 'public', 'pwa');
const targetApk = path.resolve(targetDir, 'LoomTrackMobile.apk');

const sourceApk = sourceCandidates.find((candidate) => fs.existsSync(candidate));

if (!sourceApk) {
  console.error('APK not found in any expected build output.');
  sourceCandidates.forEach((candidate) => console.error(`Checked: ${candidate}`));
  console.error('Run release build first.');
  process.exit(1);
}

if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

fs.copyFileSync(sourceApk, targetApk);
const stat = fs.statSync(targetApk);
console.log(`Published release APK to ${targetApk}`);
console.log(`Size: ${(stat.size / (1024 * 1024)).toFixed(2)} MB`);
