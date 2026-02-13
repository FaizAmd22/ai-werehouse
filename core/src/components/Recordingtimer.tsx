import { useEffect, useState } from "react";

interface RecordingTimerProps {
  maxDuration: number; // in milliseconds
}

export const RecordingTimer = ({ maxDuration }: RecordingTimerProps) => {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const startTime = Date.now();

    const interval = setInterval(() => {
      const now = Date.now();
      const elapsedMs = now - startTime;
      setElapsed(elapsedMs);

      if (elapsedMs >= maxDuration) {
        clearInterval(interval);
      }
    }, 100);

    return () => clearInterval(interval);
  }, [maxDuration]);

  const progress = Math.min((elapsed / maxDuration) * 100, 100);
  const remainingSeconds = Math.ceil((maxDuration - elapsed) / 1000);
  const isWarning = remainingSeconds <= 3;

  return (
    <div className="w-64">
      {/* Progress bar */}
      <div className="w-full h-2 bg-white/20 rounded-full overflow-hidden">
        <div
          className={`h-full transition-all duration-100 ${
            isWarning ? "bg-red-500" : "bg-white/60"
          }`}
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Timer text */}
      <div
        className={`text-center mt-2 text-sm ${
          isWarning ? "text-red-300 animate-pulse" : "text-white/70"
        }`}
      >
        {remainingSeconds}s tersisa
      </div>
    </div>
  );
};

export default RecordingTimer;
