import type { VideoSegment } from "../components/VideoPlayer";

export const ACTIVITIES: Record<string, VideoSegment> = {
    nguap: { start: 1, end: 6 }, // 5 detik
    tengok: { start: 6, end: 10 }, // 4 detik
    kedip: { start: 10, end: 12 }, // 2 detik
    kacamata: { start: 11, end: 16 }, // 5 detik
    jam: { start: 16, end: 23 }, // 7 detik
    rambut: { start: 33, end: 40 }, // 7 detik
    bicara: { start: 49, end: 54 }, // 5 detik
};