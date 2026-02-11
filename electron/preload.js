const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("porcupine", {
    start: () => ipcRenderer.invoke("porcupine-start"),
    stop: () => ipcRenderer.invoke("porcupine-stop"),
    getStatus: () => ipcRenderer.invoke("porcupine-status"),

    onWakeWordDetected: (cb) => ipcRenderer.on("wake-word-detected", cb),
    offWakeWordDetected: (cb) =>
        ipcRenderer.removeListener("wake-word-detected", cb),

    onStatusChanged: (cb) =>
        ipcRenderer.on("porcupine-status-changed", cb),
    offStatusChanged: (cb) =>
        ipcRenderer.removeListener("porcupine-status-changed", cb),
});

console.log("✅ Preload script loaded - Porcupine API exposed");
