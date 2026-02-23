const { app, BrowserWindow, screen, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

let mongoProcess = null;
let backendProcess = null;

// Ignore certificate errors for self-signed certificates
app.commandLine.appendSwitch('ignore-certificate-errors');

app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
    event.preventDefault();
    callback(true);
});

function startServices() {
    const isPackaged = app.isPackaged;

    const mongoPath = isPackaged
        ? path.join(process.resourcesPath, 'resources', 'mongo', 'mongod.exe')
        : path.join(__dirname, 'resources', 'mongo', 'mongod.exe');

    const backendDir = isPackaged
        ? path.join(process.resourcesPath, 'backend')
        : path.join(__dirname, '..', 'backend');

    const backendScript = path.join(backendDir, 'server.js');
    const dbPath = path.join(app.getPath('userData'), 'database');

    if (!fs.existsSync(dbPath)) fs.mkdirSync(dbPath, { recursive: true });

    // 1. Start MongoDB
    if (fs.existsSync(mongoPath)) {
        try {
            console.log('Starting MongoDB embedded logic...');
            mongoProcess = spawn(mongoPath, ['--dbpath', dbPath, '--port', '27017'], {
                stdio: 'ignore'
            });
            mongoProcess.on('error', (err) => console.error('Mongo Error:', err));
        } catch (e) {
            console.error('Failed to start MongoDB:', e);
        }
    } else {
        console.error('MongoDB executable not found at:', mongoPath);
        dialog.showErrorBox('Initialization Error', `MongoDB binary not found at:\n${mongoPath}`);
    }

    // 2. Start Backend using Electron's built-in node
    if (fs.existsSync(backendScript)) {
        try {
            console.log('Starting Backend Node Server...');
            // In packaged app, process.env gets stripped of many things. We must pass required items carefully.
            backendProcess = spawn(process.execPath, [backendScript], {
                cwd: backendDir,
                env: {
                    ...process.env,
                    ELECTRON_RUN_AS_NODE: '1',
                    MONGODB_URI: 'mongodb://127.0.0.1:27017/prodexa',
                    PORT: '5000'
                }
            });

            // Helpful debugging if server crashes
            backendProcess.stdout.on('data', data => console.log(`Backend: ${data}`));
            backendProcess.stderr.on('data', data => console.error(`Backend Error: ${data}`));
            backendProcess.on('error', (err) => console.error('Backend spawn error:', err));
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

    const mainWindow = new BrowserWindow({
        width: width,
        height: height,
        icon: path.join(__dirname, 'icon.png'),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.cjs')
        }
    });

    mainWindow.setMenuBarVisibility(false);

    const startUrl = process.env.ELECTRON_START_URL || `file://${path.join(__dirname, 'dist/index.html')}`;

    // Small delay to allow Express & Mongo to physically boot before we ping the frontend 
    // Although the frontend will handle retries, this is a nice touch
    setTimeout(() => {
        mainWindow.loadURL(startUrl);
    }, 1500);
}

app.whenReady().then(() => {
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

    startServices();
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
