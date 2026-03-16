const { app, BrowserWindow, screen, session } = require('electron');
const path = require('path');

// Ignore certificate errors for self-signed certificates (common in local setups)
app.commandLine.appendSwitch('ignore-certificate-errors');

function createWindow() {
    const { width, height } = screen.getPrimaryDisplay().workAreaSize;

    // Mobile-like aspect ratio or standard window
    // Since it's a "mobile web view", we might want a tall window by default
    const mainWindow = new BrowserWindow({
        width: 450,
        height: 800,
        icon: path.join(__dirname, 'public', 'favicon.ico'), // Fallback if icon.png not found
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.cjs')
        }
    });

    mainWindow.setMenuBarVisibility(false);

    const startUrl = process.env.ELECTRON_START_URL || `file://${path.join(__dirname, 'dist/index.html')}`;
    mainWindow.loadURL(startUrl);
}

app.whenReady().then(() => {
    session.defaultSession.setCertificateVerifyProc((request, callback) => {
        callback(0); // 0 = OK
    });

    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
