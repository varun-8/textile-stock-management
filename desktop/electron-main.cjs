const { app, BrowserWindow, screen, ipcMain, dialog, session } = require('electron');
const path = require('path');
const fs = require('fs');
const net = require('net');
const http = require('http');
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

function waitForBackendReady(port, timeoutMs = 30000) {
    const deadline = Date.now() + timeoutMs;

    return new Promise((resolve, reject) => {
        const tryOnce = () => {
            const req = http.get({
                host: '127.0.0.1',
                port,
                path: '/api/admin/server-ip',
                timeout: 1500
            }, (res) => {
                res.resume();
                if (res.statusCode && res.statusCode < 500) {
                    resolve(true);
                    return;
                }
                if (Date.now() >= deadline) {
                    reject(new Error(`Backend responded with status ${res.statusCode} on port ${port}`));
                    return;
                }
                setTimeout(tryOnce, 500);
            });

            req.on('error', () => {
                if (Date.now() >= deadline) {
                    reject(new Error(`Backend did not become ready on port ${port} within ${timeoutMs}ms`));
                    return;
                }
                setTimeout(tryOnce, 500);
            });

            req.on('timeout', () => {
                req.destroy(new Error('Backend readiness probe timed out'));
            });
        };

        tryOnce();
    });
}

function waitForTcpPort(host, port, timeoutMs = 15000) {
    const deadline = Date.now() + timeoutMs;

    return new Promise((resolve, reject) => {
        const tryConnect = () => {
            const socket = net.createConnection({ host, port });
            let settled = false;

            const finish = (ok, err) => {
                if (settled) return;
                settled = true;
                try { socket.destroy(); } catch (_) {}
                if (ok) {
                    resolve(true);
                    return;
                }
                if (Date.now() >= deadline) {
                    reject(err || new Error(`Timed out waiting for ${host}:${port}`));
                    return;
                }
                setTimeout(tryConnect, 400);
            };

            socket.once('connect', () => finish(true));
            socket.once('error', (err) => finish(false, err));
            socket.setTimeout(1500, () => finish(false, new Error('TCP probe timed out')));
        };

        tryConnect();
    });
}

function resolveBundledNodeBinary(isPackaged) {
    if (!isPackaged) return null;

    const candidates = [
        path.join(process.resourcesPath, 'resources', 'node', 'node.exe'),
        path.join(process.resourcesPath, 'node', 'node.exe'),
        path.join(process.resourcesPath, 'app.asar.unpacked', 'resources', 'node', 'node.exe')
    ];

    return candidates.find((candidate) => fs.existsSync(candidate)) || null;
}

// Store assigned ports globally for IPC access
let assignedHttpPort = 5010;
let assignedHttpsPort = 5011;
let assignedMongoPort = 27017;

async function startServices() {
    // Resolve ports immediately so frontend gets the correct ones on boot
    assignedHttpPort = await findAvailablePort(5050);
    assignedHttpsPort = await findAvailablePort(assignedHttpPort + 1);

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
    const runtimeDir = path.join(app.getPath('userData'), 'backend-data');
    const runtimeConfigPath = path.join(runtimeDir, 'config.json');
    const runtimeBackupPath = path.join(runtimeDir, 'backups');
    const tlsKeyPath = path.join(backendDir, 'stock-system.local-key.pem');
    const tlsCertPath = path.join(backendDir, 'stock-system.local.pem');

    if (!fs.existsSync(dbPath)) fs.mkdirSync(dbPath, { recursive: true });
    if (!fs.existsSync(runtimeDir)) fs.mkdirSync(runtimeDir, { recursive: true });
    if (!fs.existsSync(runtimeBackupPath)) fs.mkdirSync(runtimeBackupPath, { recursive: true });

    const bundledConfigPath = path.join(backendDir, 'config.json');
    if (!fs.existsSync(runtimeConfigPath) && fs.existsSync(bundledConfigPath)) {
        fs.copyFileSync(bundledConfigPath, runtimeConfigPath);
    }

    // 1. Start MongoDB
    let mongoUriForBackend = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/textile-stock-management';

    if (mongoPath) {
        try {
            assignedMongoPort = await findAvailablePort(27017);
            console.log(`Starting app-owned MongoDB on port ${assignedMongoPort}...`);

            const mongoLogPath = path.join(app.getPath('userData'), 'mongo.log');
            mongoProcess = spawn(mongoPath, [
                '--dbpath', dbPath,
                '--port', String(assignedMongoPort),
                '--bind_ip', '127.0.0.1',
                '--logpath', mongoLogPath,
                '--logappend'
            ], {
                stdio: 'ignore', // mongod redirects its own output to the logpath
                windowsHide: true
            });

            mongoProcess.on('error', (err) => console.error('Mongo Error:', err));
            mongoUriForBackend = `mongodb://127.0.0.1:${assignedMongoPort}/textile-stock-management`;

            console.log(`Waiting for MongoDB readiness on 127.0.0.1:${assignedMongoPort}...`);
            await waitForTcpPort('127.0.0.1', assignedMongoPort, 20000);
            console.log(`MongoDB is ready on 127.0.0.1:${assignedMongoPort}`);
        } catch (e) {
            console.error('Failed to start MongoDB:', e);
            dialog.showErrorBox('Initialization Error', `MongoDB startup failed:\n${e.message}`);
            return;
        }
    } else {
        const searchedPaths = mongoCandidates.length > 0 ? mongoCandidates.join('\n') : '(no candidates)';
        console.error('MongoDB executable not found. Searched paths:\n', searchedPaths);
        const externalMongoAvailable = await isPortInUse(27017);
        if (!externalMongoAvailable) {
            dialog.showErrorBox(
                'Initialization Error',
                `MongoDB binary not found and no external MongoDB is listening on port 27017.\n\nSearched:\n${searchedPaths}\n\nSet MONGOD_PATH, bundle mongod.exe, or install MongoDB Server.`
            );
            return;
        }

        console.warn('MongoDB binary not found. Falling back to external MongoDB on port 27017.');
    }

    // 2. Start Backend using Electron's built-in node
    if (fs.existsSync(backendScript)) {
        try {
            console.log(`Starting Backend Node Server on Dynamic Ports: HTTP:${assignedHttpPort}, HTTPS:${assignedHttpsPort}`);
            const backendLogStream = fs.createWriteStream(path.join(app.getPath('userData'), 'backend.log'), { flags: 'a' });
            const writeBackendLog = (chunk) => {
                if (!backendLogStream.destroyed && !backendLogStream.writableEnded) {
                    backendLogStream.write(chunk);
                }
            };
            
            const bundledNode = resolveBundledNodeBinary(isPackaged);
            const nodeBinary = bundledNode || 'node';

            if (isPackaged && !bundledNode) {
                console.warn('Bundled node.exe not found. Falling back to "node" from PATH.');
            }

            backendProcess = spawn(nodeBinary, [backendScript], {
                cwd: backendDir,
                detached: true,
                stdio: ['ignore', 'pipe', 'pipe'],
                windowsHide: true,
                env: {
                    ...process.env,
                    MONGODB_URI: mongoUriForBackend,
                    TLS_KEY_PATH: process.env.TLS_KEY_PATH || tlsKeyPath,
                    TLS_CERT_PATH: process.env.TLS_CERT_PATH || tlsCertPath,
                    APP_RUNTIME_DIR: runtimeDir,
                    APP_CONFIG_PATH: runtimeConfigPath,
                    DEFAULT_BACKUP_PATH: runtimeBackupPath,
                    HTTP_PORT: String(assignedHttpPort),
                    PORT: String(assignedHttpsPort),
                    APP_USERNAME: process.env.APP_USERNAME || 'admin',
                    APP_PASSWORD: process.env.APP_PASSWORD || 'password',
                    NODE_ENV: 'production'
                }
            });
            
            backendProcess.stdout.on('data', (chunk) => writeBackendLog(chunk));
            backendProcess.stderr.on('data', (chunk) => writeBackendLog(chunk));
            backendProcess.unref();
            
            backendProcess.on('error', (err) => {
                console.error('Backend spawn error:', err);
                writeBackendLog(`\n[${new Date().toISOString()}] Spawn Error: ${err.message}\n`);
            });

            backendProcess.on('close', (code, signal) => {
                console.error(`Backend process exited with code ${code} and signal ${signal}`);
                writeBackendLog(`\n[${new Date().toISOString()}] Process Exit: Code ${code}, Signal ${signal}\n`);
                if (!backendLogStream.destroyed && !backendLogStream.writableEnded) {
                    backendLogStream.end();
                }
            });

            console.log(`Waiting for backend HTTP readiness on port ${assignedHttpPort}...`);
            await waitForBackendReady(assignedHttpPort);
            console.log(`Backend HTTP server is ready on port ${assignedHttpPort}`);
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
