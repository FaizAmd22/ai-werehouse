// voiceCommands.ts
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

export const VOICE_COMMANDS: Record<
    string,
    { keywords: string[]; segment: VideoSegment; dialogText?: string }
> = {
    nguap: {
        keywords: ["nguap", "mengantuk", "capek", "lelah", "ngantuk"],
        segment: ACTIVITIES.nguap,
        dialogText: "Wah sepertinya Anda mengantuk ya. Mungkin perlu istirahat sebentar?",
    },
    kacamata: {
        keywords: ["kacamata", "benerin kacamata", "glasses"],
        segment: ACTIVITIES.kacamata,
        dialogText: "Baik, saya benerin kacamata dulu ya.",
    },
    jam: {
        keywords: ["jam", "cek jam", "lihat jam", "jam berapa"],
        segment: ACTIVITIES.jam,
        dialogText: `Sekarang pukul ${new Date().toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
        })}.`,
    },
    tengok: {
        keywords: ["tengok", "lihat bawah", "menunduk", "cek bawah"],
        segment: ACTIVITIES.tengok,
        dialogText: "Baik, saya lihat ke bawah dulu.",
    },
};