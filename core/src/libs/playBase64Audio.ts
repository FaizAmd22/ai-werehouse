export const playBase64Audio = (
    base64Audio: string,
    onEnded?: () => void,
    onError?: (error: unknown) => void
  ) => {
    const audioData = Uint8Array.from(atob(base64Audio), (c) =>
      c.charCodeAt(0)
    ).buffer;
  
    const audioContext = new AudioContext();
  
    audioContext
      .decodeAudioData(audioData)
      .then((decodedData) => {
        const source = audioContext.createBufferSource();
        source.buffer = decodedData;
        source.connect(audioContext.destination);
  
        source.onended = () => {
          audioContext.close();
          if (onEnded) onEnded();
        };
  
        source.start(0);
      })
      .catch((err) => {
        console.error("Error decoding audio data:", err);
        audioContext.close();
        if (onError) onError(err);
      });
  
    return () => {
      audioContext.close();
    };
  };