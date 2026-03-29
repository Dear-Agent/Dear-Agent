/**
 * Capture agent logs as a JSON timeline for Remotion.
 *
 * Usage: KNOWN_TOKENS=0xd014... npx tsx demo/capture-logs.ts
 * Output: demo/timeline.json
 *
 * Runs one full agent cycle with real on-chain transactions,
 * captures every log entry with relative timestamps, then saves.
 */
import "dotenv/config";
import { writeFileSync } from "fs";

interface TimelineEntry {
  t: number;
  phase: string;
  message: string;
  data?: Record<string, unknown>;
  type: "status" | "success" | "error" | "decision" | "tx" | "banner";
}

const timeline: TimelineEntry[] = [];
const start = Date.now();

function classifyType(phase: string, message: string): TimelineEntry["type"] {
  if (message.includes("REJECTED") || message.includes("failed") || message.includes("error")) return "error";
  if (message.includes("APPROVED") || message.includes("complete") || message.includes("deployed") || message.includes("Found") || message.includes("LIVE MODE")) return "success";
  if (message.includes("Decision") || message.includes("review")) return "decision";
  if (message.includes("tx:") || message.includes("recorded") || message.includes("Listed on") || message.includes("attestation")) return "tx";
  return "status";
}

function record(phase: string, message: string, data?: Record<string, unknown>) {
  timeline.push({
    t: Date.now() - start,
    phase,
    message,
    data,
    type: classifyType(phase, message),
  });
  const color = phase === "AGENT" ? "\x1b[38;2;198;168;75m" : "\x1b[38;2;184;134;58m";
  console.log(`${color}[${phase}]\x1b[0m ${message}`);
}

function save() {
  const output = {
    meta: {
      totalDurationMs: Date.now() - start,
      entryCount: timeline.length,
      capturedAt: new Date().toISOString(),
    },
    palette: {
      gold: "#C6A84B",
      sienna: "#6B3222",
      amber: "#B8863A",
      green: "#2C3A2A",
      umber: "#3A2518",
      charcoal: "#1C1C1C",
    },
    timeline,
  };

  writeFileSync("demo/timeline.json", JSON.stringify(output, null, 2));
  console.log(`\n\x1b[38;2;198;168;75mSaved ${timeline.length} entries to demo/timeline.json\x1b[0m`);
  console.log(`\x1b[38;2;184;134;58mTotal duration: ${((Date.now() - start) / 1000).toFixed(1)}s\x1b[0m`);
}

// Import agent modules
const { envSchema } = await import("../src/types/index.js");
const { initPrivacyNode } = await import("../src/chain/privacy.js");
const { initPublicChain } = await import("../src/chain/public.js");
const { setModel } = await import("../src/agent/llm.js");
const { initGuardrails } = await import("../src/agent/guardrails.js");
const { startAgentLoop, stopAgent } = await import("../src/agent/loop.js");

// Monkey-patch phaseLog to capture all output, auto-stop after 1 cycle
const originalLog = await import("../src/logger/index.js");
(originalLog as any).phaseLog = (phase: string, message: string, data?: Record<string, unknown>) => {
  record(phase, message, data);
  if (message.startsWith("Completed full cycle")) {
    record("AGENT", "Capture complete.");
    stopAgent();
    save();
    process.exit(0);
  }
};

// Banner
timeline.push({ t: 0, phase: "BANNER", message: "DEAR", type: "banner" });

record("INIT", "DEAR - Autonomous Institutional Treasury Agent");
record("INIT", "Validating environment...");

const env = envSchema.parse(process.env);
setModel(env.OLLAMA_MODEL);
record("INIT", `LLM model: ${env.OLLAMA_MODEL}`);

initGuardrails({
  maxBridgeAmount: env.MAX_BRIDGE_AMOUNT,
  dryRun: env.DRY_RUN,
  cooldownMs: 10_000,
});

record("INIT", "Connecting to Privacy Node...");
const privacy = initPrivacyNode(env);
try {
  const block = await privacy.publicClient.getBlockNumber();
  record("INIT", `Privacy Node connected, block: ${block}`);
} catch {
  record("INIT", "Privacy Node offline, continuing...");
}

record("INIT", "Connecting to Public Chain...");
const pub = initPublicChain(env);
try {
  const block = await pub.publicClient.getBlockNumber();
  record("INIT", `Public Chain connected, block: ${block}`);
} catch {
  record("INIT", "Public Chain offline, continuing...");
}

const knownTokens: `0x${string}`[] = [];
const extra = process.env.KNOWN_TOKENS;
if (extra) {
  for (const t of extra.split(",")) {
    const trimmed = t.trim();
    if (trimmed.startsWith("0x")) knownTokens.push(trimmed as `0x${string}`);
  }
}

record("INIT", `Known tokens: ${knownTokens.length}`);
if (env.DRY_RUN) {
  record("INIT", "DRY RUN MODE");
} else {
  record("INIT", "LIVE MODE - real on-chain transactions");
}

process.on("SIGINT", () => {
  stopAgent();
  save();
  process.exit(0);
});

process.on("SIGTERM", () => {
  stopAgent();
  save();
  process.exit(0);
});

// Run one full cycle then auto-save
try {
  await startAgentLoop(env, knownTokens);
} catch {
  // stopped
}
save();
