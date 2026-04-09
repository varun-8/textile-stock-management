import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const watchRoots = [
    path.join(repoRoot, 'src'),
    path.join(repoRoot, 'public'),
    path.join(repoRoot, 'capacitor.config.json'),
    path.join(repoRoot, 'package.json'),
    path.join(repoRoot, 'android', 'app', 'src', 'main', 'AndroidManifest.xml')
];

const debounceMs = 1500;
let buildTimer = null;
let building = false;
let rerunRequested = false;
let activeChild = null;

const runBuild = () => {
    if (building) {
        rerunRequested = true;
        return;
    }

    building = true;
    rerunRequested = false;
    console.log('\n[watch-apk] Rebuilding APK...');

    activeChild = spawn('npm', ['run', 'apk:release'], {
        cwd: repoRoot,
        stdio: 'inherit',
        shell: true,
        windowsHide: true,
        env: process.env
    });

    activeChild.on('exit', (code) => {
        activeChild = null;
        building = false;
        if (code === 0) {
            console.log('[watch-apk] Build complete.');
        } else {
            console.log(`[watch-apk] Build failed with exit code ${code}.`);
        }

        if (rerunRequested) {
            rerunRequested = false;
            setTimeout(runBuild, 300);
        }
    });
};

const scheduleBuild = () => {
    if (buildTimer) clearTimeout(buildTimer);
    buildTimer = setTimeout(() => {
        buildTimer = null;
        runBuild();
    }, debounceMs);
};

const watchers = [];

for (const target of watchRoots) {
    if (!fs.existsSync(target)) {
        console.log(`[watch-apk] Skipping missing path: ${target}`);
        continue;
    }

    try {
        const stat = fs.statSync(target);
        if (stat.isDirectory()) {
            const watcher = fs.watch(target, { recursive: true }, () => {
                console.log(`[watch-apk] Change detected in ${path.relative(repoRoot, target)}`);
                scheduleBuild();
            });
            watchers.push(watcher);
        } else {
            const parentDir = path.dirname(target);
            const fileName = path.basename(target);
            const watcher = fs.watch(parentDir, { recursive: false }, (eventType, changedName) => {
                if (!changedName) return;
                if (path.basename(String(changedName)) === fileName) {
                    console.log(`[watch-apk] Change detected in ${path.relative(repoRoot, target)}`);
                    scheduleBuild();
                }
            });
            watchers.push(watcher);
        }
    } catch (err) {
        console.warn(`[watch-apk] Failed to watch ${target}: ${err.message}`);
    }
}

console.log('[watch-apk] Watching for changes. Press Ctrl+C to stop.');
runBuild();

process.on('SIGINT', () => {
    console.log('\n[watch-apk] Stopping watchers...');
    for (const watcher of watchers) {
        try {
            watcher.close();
        } catch (_) {
            // ignore
        }
    }
    if (activeChild) {
        activeChild.kill();
    }
    process.exit(0);
});
