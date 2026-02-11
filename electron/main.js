const { app, BrowserWindow, session, ipcMain } = require("electron");
const PorcupineService = require("./porcupineService");
const path = require("path");
const fs = require("fs");
require("dotenv").config();

const isDev = !app.isPackaged;

if (isDev) {
    // Development: .env di root project
    require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
} else {
    // Production: .env di resources folder
    const envPath = path.join(process.resourcesPath, ".env");
    console.log("📁 Loading .env from:", envPath);
    console.log("📄 .env exists:", fs.existsSync(envPath));

    if (fs.existsSync(envPath)) {
        require("dotenv").config({ path: envPath });
    } else {
        console.warn("⚠️ .env file not found at:", envPath);
    }
}

let mainWindow;
let porcupineService;

const PICOVOICE_ACCESS_KEY = process.env.PICOVOICE_KEY;
const WAKE_WORD_KEYWORDS = ["HAI_TRESSA"];

console.log("🔑 PICOVOICE_ACCESS_KEY:", PICOVOICE_ACCESS_KEY ? "SET ✅" : "MISSING ❌");
console.log("📍 __dirname:", __dirname);
console.log("📍 app.getAppPath():", app.getAppPath());

function createWindow() {
    const preloadPath = path.join(__dirname, "preload.js");
    console.log("📄 Preload path:", preloadPath);

    mainWindow = new BrowserWindow({
        kiosk: !isDev,
        fullscreen: !isDev,
        width: 1920,
        height: 1080,
        webPreferences: {
            preload: preloadPath,
            contextIsolation: true,
            nodeIntegration: false,
            devTools: false
        }
    });

    session.defaultSession.setPermissionRequestHandler((_, permission, callback) => {
        const allowed = ["media", "microphone", "audioCapture"];
        console.log("🎤 Permission requested:", permission, "→", allowed.includes(permission) ? "GRANTED" : "DENIED");
        callback(allowed.includes(permission));
    });

    session.defaultSession.setPermissionCheckHandler((_, permission) => {
        return ["media", "microphone", "audioCapture"].includes(permission);
    });

    if (isDev) {
        mainWindow.loadURL("http://localhost:5173");
        mainWindow.webContents.openDevTools();
    } else {
        const indexPath = path.join(app.getAppPath(), "core/dist/index.html");
        console.log("📄 Loading:", indexPath);
        mainWindow.loadFile(indexPath);
        mainWindow.webContents.openDevTools();
    }

    mainWindow.webContents.on("did-fail-load", (_, code, desc) => {
        console.error("❌ Failed to load renderer:", code, desc);
    });

    ipcMain.handle("porcupine-start", async () => {
        console.log("▶️ [IPC] Renderer requested Porcupine start");

        if (mainWindow && !mainWindow.isDestroyed()) {
            await mainWindow.webContents.executeJavaScript('Promise.resolve()');
        }

        console.log("⏳ Waiting 1 second for audio subsystem...");
        await new Promise(res => setTimeout(res, 1000));

        console.log("🎯 Calling startPorcupine()...");

        try {
            await startPorcupine();

            const status = porcupineService ? porcupineService.getStatus() : { isListening: false };
            console.log("📤 [IPC] Returning status to renderer:", status);

            if (!status.isListening) {
                console.error("❌ [IPC] Porcupine failed to start! Status:", status);
            }

            return { success: true, ...status };
        } catch (error) {
            console.error("❌ [IPC] startPorcupine threw error:", error.message);
            console.error("❌ [IPC] Error stack:", error.stack);
            return {
                success: false,
                isListening: false,
                version: null,
                error: error.message
            };
        }
    });

    mainWindow.on("closed", () => {
        stopPorcupine();
        mainWindow = null;
    });
}

async function startPorcupine() {
    try {
        console.log("🚀 [Main] Starting Porcupine...");
        console.log("🔑 Access key available:", !!PICOVOICE_ACCESS_KEY);
        console.log("🎤 Wake words:", WAKE_WORD_KEYWORDS);

        const onStatusChanged = (status) => {
            console.log("📢 [Main] Porcupine status changed:", status);
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send("porcupine-status-changed", status);
            }
        };

        const onWakeWord = (keywordIndex) => {
            console.log("📢 [Main] Wake word detected, index:", keywordIndex);
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send("wake-word-detected", {
                    keywordIndex,
                    keyword: WAKE_WORD_KEYWORDS[keywordIndex],
                    timestamp: Date.now()
                });
            }
        };

        porcupineService = new PorcupineService(onStatusChanged);
        console.log("✅ [Main] PorcupineService instance created");

        await porcupineService.start(
            PICOVOICE_ACCESS_KEY,
            WAKE_WORD_KEYWORDS,
            onWakeWord
        );

        console.log("✅ [Main] Porcupine started successfully");
    } catch (err) {
        console.error("❌ [Main] Porcupine error:", err.message);
        console.error("❌ [Main] Stack trace:", err.stack);
        throw err;
    }
}

function stopPorcupine() {
    console.log("🛑 [Main] Stopping Porcupine...");
    if (porcupineService) {
        porcupineService.stop();
        porcupineService = null;
    }
}

ipcMain.handle("porcupine-status", () => {
    const status = porcupineService
        ? porcupineService.getStatus()
        : { isListening: false, version: null };
    console.log("📊 [IPC] Status requested:", status);
    return status;
});

ipcMain.handle("porcupine-restart", async () => {
    console.log("🔄 [IPC] Restart requested");
    stopPorcupine();
    await new Promise((r) => setTimeout(r, 1000));
    await startPorcupine();
    return { success: true };
});

app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");
app.commandLine.appendSwitch("use-fake-ui-for-media-stream");
app.commandLine.appendSwitch("enable-media-stream");
app.commandLine.appendSwitch("enable-speech-dispatcher");

app.whenReady().then(() => {
    console.log("🚀 App starting...");
    console.log("Mode:", isDev ? "DEV" : "PROD");
    console.log("App path:", app.getAppPath());
    console.log("Resources path:", process.resourcesPath);
    console.log("Is packaged:", app.isPackaged);

    // ✅ Debug: cek apakah model file ada
    const modelPath = isDev
        ? path.join(__dirname, 'models', 'hai-tressa.ppn')
        : path.join(process.resourcesPath, 'app.asar.unpacked', 'electron', 'models', 'hai-tressa.ppn');

    console.log("📁 Model path:", modelPath);
    console.log("📄 Model exists:", fs.existsSync(modelPath));

    createWindow();
});

app.on("window-all-closed", () => {
    stopPorcupine();
    if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
});