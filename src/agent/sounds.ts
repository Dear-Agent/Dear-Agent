import { exec } from "child_process";
import { platform } from "os";

const isMac = platform() === "darwin";

// macOS system sounds (available on any Mac, no need to bundle)
const MAC_SOUNDS_DIR = "/System/Library/Sounds";
const PHASE_SOUNDS: Record<string, string> = {
  INIT: "Submarine.aiff",
  DETECT: "Pop.aiff",
  ATTEST: "Morse.aiff",
  GOVERN_APPROVED: "Hero.aiff",
  GOVERN_REJECTED: "Basso.aiff",
  BRIDGE: "Glass.aiff",
  LIST: "Ping.aiff",
  MONITOR: "Tink.aiff",
  ERROR: "Funk.aiff",
  CYCLE_START: "Bottle.aiff",
};

export function playSound(phase: string) {
  const file = PHASE_SOUNDS[phase];
  if (!file) return;

  if (isMac) {
    exec(`afplay "${MAC_SOUNDS_DIR}/${file}" &`, () => {});
  } else {
    // Terminal bell fallback for Linux/Windows
    process.stdout.write("\x07");
  }
}

export function speak(text: string) {
  const sanitized = text.replace(/["`$]/g, "").slice(0, 200);

  if (isMac) {
    exec(`say -r 180 '${sanitized.replace(/'/g, "'\\''")}' &`, () => {});
  }
  // No TTS fallback on other platforms -- sounds still play via bell
}
