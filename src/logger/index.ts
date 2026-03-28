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

export function phaseLog(
  phase: string,
  message: string,
  data?: Record<string, unknown>,
) {
  logger.info({ phase: `[${phase}]`, ...data }, message);
}
