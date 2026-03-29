import pino from "pino";

export const logger = pino({
  transport: {
    target: "pino/file",
    options: { destination: 1 },
  },
  formatters: {
    level(label) {
      return { level: label.toUpperCase() };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

// ANSI colors mapped to the Romantic oil painting palette
// Deep warm tones that look great on dark terminals
const COLORS: Record<string, string> = {
  INIT:             "\x1b[38;2;198;168;75m",   // aged gold #C6A84B
  DETECT:           "\x1b[38;2;184;134;58m",   // warm amber #B8863A
  ATTEST:           "\x1b[38;2;107;50;34m",    // burnt sienna #6B3222
  GOVERN:           "\x1b[38;2;198;168;75m",   // aged gold #C6A84B
  BRIDGE:           "\x1b[38;2;44;58;42m",     // forest green #2C3A2A
  LIST:             "\x1b[38;2;184;134;58m",    // warm amber #B8863A
  MONITOR:          "\x1b[38;2;58;37;24m",     // deep umber #3A2518
  AGENT:            "\x1b[38;2;198;168;75m",   // aged gold #C6A84B
  LLM:              "\x1b[38;2;107;50;34m",    // burnt sienna #6B3222
  GUARDRAILS:       "\x1b[38;2;44;58;42m",     // forest green #2C3A2A
  ERROR:            "\x1b[38;2;180;60;40m",    // muted red
  FATAL:            "\x1b[38;2;180;60;40m",    // muted red
  DEPLOY:           "\x1b[38;2;198;168;75m",   // aged gold
};

const RESET = "\x1b[0m";
const DIM = "\x1b[2m";
const BOLD = "\x1b[1m";
const GOLD = "\x1b[38;2;198;168;75m";
const UMBER = "\x1b[38;2;90;65;45m";

function timestamp(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
}

export function phaseLog(
  phase: string,
  message: string,
  data?: Record<string, unknown>,
) {
  const color = COLORS[phase] ?? GOLD;
  const ts = `${DIM}${UMBER}${timestamp()}${RESET}`;
  const tag = `${BOLD}${color}[${phase}]${RESET}`;
  const msg = `${color}${message}${RESET}`;

  let line = `${ts} ${tag} ${msg}`;

  if (data && Object.keys(data).length > 0) {
    const details = Object.entries(data)
      .map(([k, v]) => {
        const val = typeof v === "string" ? v : JSON.stringify(v);
        return `${DIM}${UMBER}${k}=${RESET}${DIM}${val}${RESET}`;
      })
      .join(" ");
    line += `\n     ${details}`;
  }

  console.log(line);

  // Also log structured JSON for file output / debugging
  logger.info({ phase: `[${phase}]`, ...data }, message);
}
