const { Porcupine } = require('@picovoice/porcupine-node');
const { PvRecorder } = require('@picovoice/pvrecorder-node');
const path = require('path');
const { app } = require('electron');

let porcupine = null;
let recorder = null;
let isRunning = false;
let mainWindow = null;

const isDev = !app.isPackaged;

function getModelPath(filename) {
    if (isDev) {
        return path.join(__dirname, '..', 'core', 'public', 'word-wake', filename);
    }
    return path.join(process.resourcesPath, 'models', filename);
}

async function startWakeWord(win) {
    mainWindow = win;

    try {
        const accessKey = process.env.PICOVOICE_KEY;
        const keywordPath = getModelPath('Hai-Tressa_en_windows_v4_0_0.ppn');
        const modelPath = getModelPath('model.pv');

        console.log('[WakeWord Node] Starting with:', { keywordPath, modelPath });

        porcupine = new Porcupine(
            accessKey,
            [keywordPath],
            [0.5]  // sensitivity
        );

        const devices = PvRecorder.getAvailableDevices();
        console.log('[WakeWord Node] Available audio devices:', devices);

        recorder = new PvRecorder(porcupine.frameLength, -1); // -1 = default device
        recorder.start();
        isRunning = true;

        console.log('Listening for wake word...');

        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('wakeword:status', {
                isLoaded: true,
                isListening: true
            });
        }

        while (isRunning) {
            const pcm = await recorder.read();
            const keywordIndex = porcupine.process(pcm);

            if (keywordIndex >= 0) {
                console.log('Wake word detected!');
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('wakeword:detected');
                }
            }
        }
    } catch (err) {
        console.error('Error:', err);
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('wakeword:status', {
                isLoaded: false,
                isListening: false,
                error: err.message
            });
        }
    }
}

function stopWakeWord() {
    isRunning = false;
    if (recorder) {
        recorder.stop();
        recorder.release();
        recorder = null;
    }
    if (porcupine) {
        porcupine.release();
        porcupine = null;
    }
    console.log('[WakeWord Node] Stopped');
}

module.exports = { startWakeWord, stopWakeWord };