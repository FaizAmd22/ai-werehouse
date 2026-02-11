/* eslint-disable react-hooks/exhaustive-deps */
import React, { useEffect, useRef, useState } from "react";

export interface VideoSegment {
  start: number;
  end: number;
}

interface VideoPlayerProps {
  segment?: VideoSegment | null;
  onReady: () => void;
  onSegmentEnd?: () => void;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({
  segment,
  onReady,
  onSegmentEnd,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isReady, setIsReady] = useState(false);
  const activeSegmentRef = useRef<VideoSegment | null>(null);

  const forcePlay = async () => {
    const video = videoRef.current;
    if (!video) return;
    try {
      await video.play();
    } catch (err) {
      console.warn("🔁 Retry play failed:", err);
    }
  };

  const playSegment = async (seg?: VideoSegment | null) => {
    const video = videoRef.current;
    if (!video || !isReady || !seg) return;

    activeSegmentRef.current = seg;
    video.currentTime = seg.start;
    await forcePlay();
  };

  // 🎥 Ready
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleCanPlay = () => {
      if (!isReady) {
        setIsReady(true);
        onReady();
        forcePlay();
      }
    };

    video.addEventListener("canplay", handleCanPlay);
    return () => video.removeEventListener("canplay", handleCanPlay);
  }, [isReady, onReady]);

  // 🎬 Segment change
  useEffect(() => {
    if (!isReady || !segment) return;

    const current = activeSegmentRef.current;
    if (
      current &&
      current.start === segment.start &&
      current.end === segment.end
    ) {
      return;
    }

    playSegment(segment);
  }, [segment, isReady]);

  // ⏱️ Segment watcher
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !isReady) return;

    const onTimeUpdate = () => {
      const seg = activeSegmentRef.current;
      if (!seg) return;

      if (video.currentTime >= seg.end - 0.05) {
        onSegmentEnd?.();
      }
    };

    video.addEventListener("timeupdate", onTimeUpdate);
    return () => video.removeEventListener("timeupdate", onTimeUpdate);
  }, [isReady, onSegmentEnd]);

  return (
    <div className="w-full h-screen">
      {/* <video
        ref={videoRef}
        className="w-full h-full object-contain"
        src={new URL("../assets/videos/avatar.mp4", import.meta.url).href}
        muted
        autoPlay
        loop
        playsInline
        preload="auto"
      /> */}

      {/* Development */}
      <video
        ref={videoRef}
        className="w-full h-full object-contain pointer-events-none"
        src="/assets/videos/avatar.mp4"
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        onCanPlay={forcePlay}
      />
    </div>
  );
};

export default VideoPlayer;
