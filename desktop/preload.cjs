const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    selectDirectory: () => ipcRenderer.invoke('dialog:selectDirectory'),
    saveFile: (filename, data) => ipcRenderer.invoke('dialog:saveFile', filename, data),
    printOrSavePdf: (filename, bytes) => ipcRenderer.invoke('pdf:printOrSave', filename, bytes)
});
