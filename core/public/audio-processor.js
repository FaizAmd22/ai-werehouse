class PCMProcessor extends AudioWorkletProcessor {
    process(inputs) {
        const input = inputs[0];
        if (input && input[0]) {
            const inputData = input[0];

            const pcmData = new Int16Array(inputData.length);
            for (let i = 0; i < inputData.length; i++) {
                const s = Math.max(-1, Math.min(1, inputData[i]));
                pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
            }

            this.port.postMessage(pcmData.buffer);
        }
        return true;
    }
}

registerProcessor("pcm-processor", PCMProcessor);
