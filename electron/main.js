const { app, BrowserWindow, session, protocol, ipcMain } = require("electron");
const { startWakeWord, stopWakeWord } = require('./wakeword');
const path = require("path");
const fs = require("fs");
require("dotenv").config();

const isDev = !app.isPackaged;

if (isDev) {
    require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
} else {
    const envPath = path.join(process.resourcesPath, ".env");
    console.log("Loading .env from:", envPath);
    console.log(".env exists:", fs.existsSync(envPath));

    if (fs.existsSync(envPath)) {
        require("dotenv").config({ path: envPath });
    } else {
        console.warn(".env file not found at:", envPath);
    }
}

let mainWindow;

protocol.registerSchemesAsPrivileged([
    {
        scheme: 'app',
        privileges: {
            standard: true,
            secure: true,
            supportFetchAPI: true,
            corsEnabled: true,
            bypassCSP: true
        }
    }
]);

function createWindow() {
    const preloadPath = path.join(__dirname, "preload.js");

    mainWindow = new BrowserWindow({
        kiosk: true,
        fullscreen: true,
        width: 1920,
        height: 1080,
        webPreferences: {
            preload: preloadPath,
            contextIsolation: true,
            nodeIntegration: false,
            devTools: true,
            webSecurity: false,
            allowRunningInsecureContent: true,
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
    });

    mainWindow.webContents.on('did-finish-load', () => {
        console.log('[Main] Renderer loaded, starting wake word...');
        setTimeout(() => {
            startWakeWord(mainWindow);
        }, 2000);
    });

    session.defaultSession.setPermissionRequestHandler((_, permission, callback) => {
        const allowed = ["media", "microphone", "audioCapture"];
        console.log("Permission requested:", permission, "→", allowed.includes(permission) ? "GRANTED" : "DENIED");
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
        console.log("Loading:", indexPath);
        mainWindow.loadFile(indexPath);
        mainWindow.webContents.openDevTools();
    }

    mainWindow.webContents.on("did-fail-load", (_, code, desc) => {
        console.error("Failed to load renderer:", code, desc);
    });

    mainWindow.on("closed", () => {
        mainWindow = null;
    });
}

app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");
app.commandLine.appendSwitch("use-fake-ui-for-media-stream");
app.commandLine.appendSwitch("enable-media-stream");
app.commandLine.appendSwitch("enable-speech-dispatcher");

app.whenReady().then(() => {
    console.log("App starting...");

    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
        callback({
            responseHeaders: {
                ...details.responseHeaders,
                'Content-Security-Policy': [
                    "default-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' http://localhost:5173 ws: wss: app:; " +
                    "script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' http://localhost:5173; " +
                    "connect-src 'self' ws: wss: http: https: app:; " +
                    "media-src 'self' blob: data: http://localhost:5173;"
                ]
            }
        });
    });

    protocol.handle('app', async (request) => {
        const urlPath = request.url.slice('app://'.length);

        let filePath;
        if (isDev) {
            filePath = path.join(__dirname, '..', 'core', 'public', urlPath);
        } else {
            filePath = path.join(process.resourcesPath, urlPath);
        }

        try {
            const data = await fs.promises.readFile(filePath);
            return new Response(data, {
                headers: {
                    'Content-Type': 'application/octet-stream',
                    'Access-Control-Allow-Origin': '*'
                }
            });
        } catch (error) {
            console.error('File not found:', filePath, error.message);
            return new Response('File not found: ' + filePath, { status: 404 });
        }
    });

    createWindow();
});

app.on('window-all-closed', () => {
    stopWakeWord();
    if (process.platform !== 'darwin') app.quit();
});

app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
});