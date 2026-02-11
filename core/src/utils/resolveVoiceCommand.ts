// resolveVoiceCommand.ts
import type { VideoSegment } from "../components/VideoPlayer";
import { VOICE_COMMANDS, ACTIVITIES } from "./voiceCommands";

export type ResolveResult = {
  segment: VideoSegment;
  action?: "GREETING";
  dialogText?: string;
};

export function resolveVoiceCommand(text: string): ResolveResult {
  const lower = text.toLowerCase().trim();

  // Check for specific commands
  for (const key in VOICE_COMMANDS) {
    const cmd = VOICE_COMMANDS[key];
    if (cmd.keywords.some((k) => lower.includes(k))) {
      return {
        segment: cmd.segment,
        dialogText: cmd.dialogText,
      };
    }
  }

  // Default: no command recognized
  return {
    segment: ACTIVITIES.default,
    dialogText: undefined, // Will trigger "tidak mengerti" message
  };
}