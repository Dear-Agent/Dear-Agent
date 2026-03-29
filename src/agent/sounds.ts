import { exec } from "child_process";

const SOUNDS_DIR = "/System/Library/Sounds";

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
  exec(`afplay "${SOUNDS_DIR}/${file}" &`, () => {});
}

export function speak(text: string) {
  const sanitized = text.replace(/"/g, '\\"').slice(0, 200);
  exec(`say -r 180 "${sanitized}" &`, () => {});
}
