const path = require("path");
const fs = require("fs");
const { app } = require("electron");

// ✅ Force load dari unpacked directory
let Porcupine, PvRecorder;

if (app.isPackaged) {
    const unpackedModulesPath = path.join(
        process.resourcesPath,
        'app.asar.unpacked',
        'node_modules'
    );

    const porcupinePath = path.join(unpackedModulesPath, '@picovoice', 'porcupine-node');
    const recorderPath = path.join(unpackedModulesPath, '@picovoice', 'pvrecorder-node');

    console.log("📦 Loading Porcupine from:", porcupinePath);
    console.log("📦 Loading PvRecorder from:", recorderPath);

    Porcupine = require(porcupinePath).Porcupine;
    PvRecorder = require(recorderPath).PvRecorder;
} else {
    const { Porcupine: P } = require("@picovoice/porcupine-node");
    const { PvRecorder: R } = require("@picovoice/pvrecorder-node");
    Porcupine = P;
    PvRecorder = R;
}

class PorcupineService {
    constructor(onStatusChanged) {
        console.log("🔧 [PorcupineService] Constructor called");
        this.porcupine = null;
        this.recorder = null;
        this.isListening = false;
        this.onStatusChanged = onStatusChanged;
        this.onWakeWord = null;
        this.loopRunning = false;
    }

    async start(accessKey, keywords, onWakeWord) {
        console.log("🎯 [PorcupineService] start() called");
        console.log("   - isListening:", this.isListening);
        console.log("   - accessKey:", accessKey ? `${accessKey.substring(0, 10)}...` : "MISSING");
        console.log("   - keywords:", keywords);
        console.log("   - app.isPackaged:", app.isPackaged);

        if (this.isListening) {
            console.log("⚠️ [PorcupineService] Already running, aborting");
            return;
        }

        if (!accessKey) {
            const err = new Error("PICOVOICE access key missing");
            console.error("❌ [PorcupineService]", err.message);
            throw err;
        }

        try {
            this.onWakeWord = onWakeWord;

            let basePath;
            let modelFilePath;

            if (app.isPackaged) {
                basePath = path.join(process.resourcesPath, 'models');
                modelFilePath = path.join(
                    process.resourcesPath,
                    'app.asar.unpacked',
                    'node_modules',
                    '@picovoice',
                    'porcupine-node',
                    'lib',
                    'common',
                    'porcupine_params.pv'
                );
                console.log("📦 [PorcupineService] Running in PACKAGED mode");
            } else {
                basePath = path.join(__dirname, 'models');
                modelFilePath = undefined; // Let Porcupine use default
                console.log("🛠️ [PorcupineService] Running in DEV mode");
            }

            console.log("📁 [PorcupineService] Base path:", basePath);
            if (modelFilePath) {
                console.log("📁 [PorcupineService] Model file path:", modelFilePath);
                console.log("📁 [PorcupineService] Model file exists:", fs.existsSync(modelFilePath));
            }

            const keywordPaths = {
                HAI_TRESSA: path.join(basePath, "hai-tressa.ppn"),
            };

            const keywordPathsResolved = keywords.map((id) => {
                if (!keywordPaths[id]) {
                    throw new Error(`Wake word model not found: ${id}`);
                }
                const modelPath = keywordPaths[id];
                console.log(`   📄 Model for ${id}: ${modelPath}`);

                if (!fs.existsSync(modelPath)) {
                    console.error(`   ❌ File does NOT exist: ${modelPath}`);
                    throw new Error(`Model file does not exist: ${modelPath}`);
                }

                console.log(`   ✅ File exists: ${modelPath}`);
                return modelPath;
            });

            console.log("🔨 [PorcupineService] Creating Porcupine instance...");

            this.porcupine = new Porcupine(
                accessKey,
                keywordPathsResolved,
                keywords.map(() => 0.7),
                modelFilePath
            );

            console.log("✅ [PorcupineService] Porcupine instance created");
            console.log("   - Version:", this.porcupine.version);
            console.log("   - Frame length:", this.porcupine.frameLength);

            const devices = PvRecorder.getAvailableDevices();
            console.log("🎤 [PorcupineService] Available audio devices:");
            devices.forEach((d, i) => console.log(`   [${i}] ${d}`));

            console.log("🎙️ [PorcupineService] Creating recorder...");
            this.recorder = new PvRecorder(this.porcupine.frameLength, -1);

            console.log("▶️ [PorcupineService] Starting recorder...");
            this.recorder.start();
            console.log("✅ [PorcupineService] Recorder started");

            this.isListening = true;
            this.loopRunning = true;

            const status = {
                isListening: true,
                version: this.porcupine.version
            };
            console.log("📤 [PorcupineService] Sending status:", status);
            this.onStatusChanged?.(status);

            console.log("🔄 [PorcupineService] Starting audio loop...");
            this._loop();

        } catch (err) {
            console.error("❌ [PorcupineService] Failed to start:", err.message);
            console.error("❌ [PorcupineService] Error name:", err.name);
            console.error("❌ [PorcupineService] Stack:", err.stack);
            this.stop();
            throw err;
        }
    }

    async _loop() {
        if (!this.loopRunning || !this.recorder || !this.porcupine) {
            console.log("⏹️ [PorcupineService] Loop stopped");
            return;
        }

        try {
            const pcm = await this.recorder.read();
            if (pcm && pcm.length === this.porcupine.frameLength) {
                const keywordIndex = this.porcupine.process(pcm);
                if (keywordIndex !== -1) {
                    console.log("🎉 [PorcupineService] Wake word detected! Index:", keywordIndex);
                    this.onWakeWord?.(keywordIndex);
                }
            }
        } catch (err) {
            console.error("❌ [PorcupineService] Audio loop error:", err);
        }

        setImmediate(() => this._loop());
    }

    stop() {
        console.log("🛑 [PorcupineService] stop() called");
        this.loopRunning = false;
        this.isListening = false;

        try {
            if (this.recorder) {
                this.recorder.stop();
                this.recorder.release();
                console.log("✅ [PorcupineService] Recorder stopped");
            }
        } catch (err) {
            console.error("⚠️ [PorcupineService] Error stopping recorder:", err);
        }

        try {
            if (this.porcupine) {
                this.porcupine.release();
                console.log("✅ [PorcupineService] Porcupine released");
            }
        } catch (err) {
            console.error("⚠️ [PorcupineService] Error releasing Porcupine:", err);
        }

        this.recorder = null;
        this.porcupine = null;

        const status = { isListening: false, version: null };
        console.log("📤 [PorcupineService] Sending stop status:", status);
        this.onStatusChanged?.(status);
    }

    getStatus() {
        const status = {
            isListening: this.isListening,
            version: this.porcupine?.version || null,
        };
        return status;
    }
}

module.exports = PorcupineService;