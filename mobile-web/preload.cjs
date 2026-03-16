const { contextBridge } = require('electron');

// Basic bridge for future use
contextBridge.exposeInMainWorld('electronAPI', {
    platform: process.platform,
    version: process.versions.electron
});
