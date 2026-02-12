const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
    isElectron: true,
    platform: process.platform,

    onWakeWordDetected: (callback) => {
        ipcRenderer.on('wakeword:detected', callback);
        return () => ipcRenderer.removeListener('wakeword:detected', callback);
    },

    onWakeWordStatus: (callback) => {
        ipcRenderer.on('wakeword:status', (_, data) => callback(data));
        return () => ipcRenderer.removeListener('wakeword:status', callback);
    },

    getWakeWordPath: (filename) => {
        return `/word-wake/${filename}`;
    }
});

console.log('Preload loaded');