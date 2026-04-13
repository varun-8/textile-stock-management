const { app, BrowserWindow, screen, ipcMain, dialog, session } = require('electron');
const path = require('path');
const fs = require('fs');
const net = require('net');
const { spawn } = require('child_process');

// Load environment variables for the backend process
try {
    const isPackaged = __dirname.includes('app.asar') || process.defaultApp === false;
    const envPath = isPackaged 
        ? path.join(process.resourcesPath, 'backend', '.env')
        : path.join(__dirname, '..', 'backend', '.env');
        
    require('dotenv').config({ path: envPath });
} catch (e) {
    console.log('dotenv not loaded', e.message);
}

let mongoProcess = null;
let backendProcess = null;

// Ignore certificate errors for self-signed certificates
app.commandLine.appendSwitch('ignore-certificate-errors');

app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
    event.preventDefault();
    callback(true);
});

function collectMongoCandidates(isPackaged) {
    const candidates = [];
    const addCandidate = (candidatePath) => {
        if (!candidatePath || candidates.includes(candidatePath)) return;
        candidates.push(candidatePath);
    };

    addCandidate(process.env.MONGOD_PATH);

    if (isPackaged) {
        addCandidate(path.join(process.resourcesPath, 'resources', 'mongo', 'mongod.exe'));
        addCandidate(path.join(process.resourcesPath, 'mongo', 'mongod.exe'));
        addCandidate(path.join(process.resourcesPath, 'app.asar.unpacked', 'resources', 'mongo', 'mongod.exe'));
    } else {
        addCandidate(path.join(__dirname, 'resources', 'mongo', 'mongod.exe'));
        addCandidate(path.join(__dirname, '..', 'resources', 'mongo', 'mongod.exe'));
        addCandidate(path.join(__dirname, '..', 'backend', 'resources', 'mongo', 'mongod.exe'));
    }

    const programFilesRoots = [
        process.env['ProgramFiles'],
        process.env['ProgramFiles(x86)']
    ].filter(Boolean);

    for (const root of programFilesRoots) {
        const serverRoot = path.join(root, 'MongoDB', 'Server');
        if (!fs.existsSync(serverRoot)) continue;

        try {
            const versions = fs.readdirSync(serverRoot, { withFileTypes: true })
                .filter((entry) => entry.isDirectory())
                .map((entry) => entry.name)
                .sort((a, b) => b.localeCompare(a, undefined, { numeric: true, sensitivity: 'base' }));

            for (const version of versions) {
                addCandidate(path.join(serverRoot, version, 'bin', 'mongod.exe'));
            }
        } catch (err) {
            console.error('Failed to inspect MongoDB installation directory:', err);
        }
    }

    return candidates;
}

function resolveMongoBinary(isPackaged) {
    const candidates = collectMongoCandidates(isPackaged);
    const binaryPath = candidates.find((candidate) => fs.existsSync(candidate));
    return { binaryPath, candidates };
}

function isPortInUse(port) {
    return new Promise((resolve) => {
        const server = net.createServer();
        server.once('error', (err) => {
            if (err.code === 'EADDRINUSE' || err.code === 'EACCES') {
                resolve(true);
            } else {
                resolve(true); // Treat other errors as "unavailable" to be safe
            }
        });
        server.once('listening', () => {
            server.close(() => resolve(false));
        });

        // Bind without an explicit host so conflicts on IPv4/IPv6/any-interface are detected.
        server.listen(port);
    });
}

async function findAvailablePort(startPort) {
    let port = startPort;
    while (await isPortInUse(port)) {
        port++;
        if (port > startPort + 20) throw new Error("Could not find an available port in range.");
    }
    return port;
}

// Store assigned ports globally for IPC access
let assignedHttpPort = 5010;
let assignedHttpsPort = 5011;

async function startServices() {
    const isPackaged = app.isPackaged;
    const { binaryPath: mongoPath, candidates: mongoCandidates } = resolveMongoBinary(isPackaged);

    const backendCandidates = isPackaged
        ? [
            path.join(process.resourcesPath, 'backend'),
            path.join(process.resourcesPath, 'resources', 'backend'),
            path.join(process.resourcesPath, 'app.asar.unpacked', 'resources', 'backend'),
            path.join(process.resourcesPath, 'app.asar.unpacked', 'backend')
          ]
        : [
            path.join(__dirname, '..', 'backend'),
            path.join(__dirname, 'resources', 'backend')
          ];

    const backendDir = backendCandidates.find(dir => fs.existsSync(path.join(dir, 'server.js'))) || backendCandidates[0];
    const backendScript = path.join(backendDir, 'server.js');
    const dbPath = path.join(app.getPath('userData'), 'database');
    const tlsKeyPath = path.join(backendDir, 'stock-system.local-key.pem');
    const tlsCertPath = path.join(backendDir, 'stock-system.local.pem');

    if (!fs.existsSync(dbPath)) fs.mkdirSync(dbPath, { recursive: true });

    // 1. Start MongoDB
    if (mongoPath) {
        try {
            if (await isPortInUse(27017)) {
                console.log('MongoDB port 27017 already in use. Reusing existing MongoDB instance.');
            } else {
                console.log('Starting MongoDB embedded logic...');
                const mongoLogPath = path.join(app.getPath('userData'), 'mongo.log');
                mongoProcess = spawn(mongoPath, [
                    '--dbpath', dbPath, 
                    '--port', '27017',
                    '--bind_ip', '127.0.0.1',
                    '--logpath', mongoLogPath,
                    '--logappend'
                ], {
                    stdio: 'ignore', // mongod redirects its own output to the logpath
                    windowsHide: true
                });
                mongoProcess.on('error', (err) => console.error('Mongo Error:', err));
            }
        } catch (e) {
            console.error('Failed to start MongoDB:', e);
        }
    } else {
        const searchedPaths = mongoCandidates.length > 0 ? mongoCandidates.join('\n') : '(no candidates)';
        console.error('MongoDB executable not found. Searched paths:\n', searchedPaths);
        dialog.showErrorBox(
            'Initialization Error',
            `MongoDB binary not found.\n\nSearched:\n${searchedPaths}\n\nSet MONGOD_PATH or install MongoDB Server.`
        );
    }

    // 2. Start Backend using Electron's built-in node
    if (fs.existsSync(backendScript)) {
        try {
            // Give MongoDB a few seconds to initialize its socket listeners
            console.log('Waiting for MongoDB to initialize...');
            await new Promise(resolve => setTimeout(resolve, 3000));

            assignedHttpPort = await findAvailablePort(5050);
            assignedHttpsPort = await findAvailablePort(assignedHttpPort + 1);

            console.log(`Starting Backend Node Server on Dynamic Ports: HTTP:${assignedHttpPort}, HTTPS:${assignedHttpsPort}`);
            const backendLogStream = fs.createWriteStream(path.join(app.getPath('userData'), 'backend.log'), { flags: 'a' });
            
            backendProcess = spawn(process.execPath, [backendScript], {
                cwd: backendDir,
                windowsHide: true,
                env: {
                    ...process.env,
                    ELECTRON_RUN_AS_NODE: '1',
                    MONGODB_URI: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/textile-stock-management',
                    TLS_KEY_PATH: process.env.TLS_KEY_PATH || tlsKeyPath,
                    TLS_CERT_PATH: process.env.TLS_CERT_PATH || tlsCertPath,
                    HTTP_PORT: String(assignedHttpPort),
                    PORT: String(assignedHttpsPort),
                    APP_USERNAME: process.env.APP_USERNAME || 'admin',
                    APP_PASSWORD: process.env.APP_PASSWORD || 'password',
                    NODE_ENV: 'production'
                }
            });

            backendProcess.stdout.pipe(backendLogStream);
            backendProcess.stderr.pipe(backendLogStream);
            
            backendProcess.on('error', (err) => {
                console.error('Backend spawn error:', err);
                backendLogStream.write(`\n[${new Date().toISOString()}] Spawn Error: ${err.message}\n`);
            });
        } catch (e) {
            console.error('Failed to start Backend:', e);
            dialog.showErrorBox('Initialization Error', `Backend startup failed:\n${e.message}`);
        }
    } else {
        console.error('Backend script not found at:', backendScript);
        dialog.showErrorBox('Initialization Error', `Backend Node server not found at:\n${backendScript}`);
    }
}

function killServices() {
    if (backendProcess) {
        try { backendProcess.kill('SIGTERM'); } catch (e) { }
        backendProcess = null;
    }
    if (mongoProcess) {
        try { mongoProcess.kill('SIGTERM'); } catch (e) { }
        mongoProcess = null;
    }
}

function createWindow() {
    const { width, height } = screen.getPrimaryDisplay().workAreaSize;

    // In packaged mode with asarUnpack, the icon lives in app.asar.unpacked
    const iconPath = app.isPackaged
        ? path.join(process.resourcesPath, 'app.asar.unpacked', 'icon.png')
        : path.join(__dirname, 'icon.png');

    const mainWindow = new BrowserWindow({
        width: width,
        height: height,
        icon: iconPath,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.cjs')
        }
    });

    // mainWindow.webContents.openDevTools();

    mainWindow.setMenuBarVisibility(false);

    const startUrl = process.env.ELECTRON_START_URL || `file://${path.join(__dirname, 'dist/index.html')}`;

    // Small delay to allow Express & Mongo to physically boot before we ping the frontend 
    // Although the frontend will handle retries, this is a nice touch
    setTimeout(() => {
        mainWindow.loadURL(startUrl);
    }, 1500);
}

app.whenReady().then(async () => {
    // Bypass self-signed certificate errors for ALL renderer-process requests
    // (axios, fetch, XHR). The BrowserWindow handler above only covers page loads.
    session.defaultSession.setCertificateVerifyProc((request, callback) => {
        callback(0); // 0 = OK, trust all certs
    });

    ipcMain.handle('dialog:selectDirectory', async () => {
        const { canceled, filePaths } = await dialog.showOpenDialog({
            properties: ['openDirectory', 'createDirectory']
        });
        if (canceled) return null;
        return filePaths[0];
    });

    ipcMain.handle('dialog:saveFile', async (event, filename, content) => {
        const { canceled, filePath } = await dialog.showSaveDialog({
            defaultPath: filename,
            filters: [{ name: 'JSON Backup', extensions: ['json'] }]
        });
        if (canceled || !filePath) return false;
        require('fs').writeFileSync(filePath, content);
        return true;
    });

    ipcMain.handle('api:get-config', async () => {
        return {
            httpPort: assignedHttpPort,
            httpsPort: assignedHttpsPort
        };
    });

    ipcMain.handle('pdf:printOrSave', async (event, filename, bytes) => {
        try {
            const safeName = String(filename || 'Delivery_Challan.pdf').replace(/[\\/:*?"<>|]+/g, '_');
            const byteArray = Array.isArray(bytes) ? bytes : [];
            const pdfBuffer = Buffer.from(byteArray);
            if (!pdfBuffer || pdfBuffer.length === 0) {
                return { success: false, mode: 'none', message: 'Empty PDF data' };
            }

            const tempPath = path.join(app.getPath('temp'), `${Date.now()}-${safeName}`);
            fs.writeFileSync(tempPath, pdfBuffer);

            const printWindow = new BrowserWindow({
                show: false,
                webPreferences: {
                    sandbox: true
                }
            });

            await printWindow.loadURL(`file://${tempPath}`);

            let printers = [];
            try {
                printers = await printWindow.webContents.getPrintersAsync();
            } catch (err) {
                printers = [];
            }

            if (printers.length > 0) {
                const printResult = await new Promise((resolve) => {
                    printWindow.webContents.print(
                        { silent: false, printBackground: true },
                        (success, failureReason) => {
                            resolve({ success, failureReason: failureReason || '' });
                        }
                    );
                });

                printWindow.destroy();

                if (printResult.success) {
                    try { fs.unlinkSync(tempPath); } catch (_) {}
                    return { success: true, mode: 'printed' };
                }
            } else {
                printWindow.destroy();
            }
            try { fs.unlinkSync(tempPath); } catch (_) {}
            return { success: false, mode: 'no_printer' };
        } catch (err) {
            return { success: false, mode: 'none', message: err.message };
        }
    });

    ipcMain.handle('fs:fileExists', async (event, targetPath) => {
        try {
            if (!targetPath || typeof targetPath !== 'string') return false;
            return fs.existsSync(targetPath);
        } catch (_) {
            return false;
        }
    });

    await startServices();
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    killServices();
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('will-quit', () => {
    killServices();
});
app.on('quit', () => {
    killServices();
});
