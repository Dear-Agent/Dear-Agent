/**
 * Capture agent logs as a JSON timeline for Remotion.
 *
 * Usage: KNOWN_TOKENS=0x34b40ba... npx tsx demo/capture-logs.ts
 * Output: demo/timeline.json
 *
 * Each entry has a relative timestamp (ms from start) so Remotion
 * can render lines at the exact right moment.
 */
import "dotenv/config";
import { writeFileSync } from "fs";

interface TimelineEntry {
  t: number;         // ms from start
  phase: string;     // INIT, DETECT, ATTEST, GOVERN, BRIDGE, LIST, MONITOR
  message: string;
  data?: Record<string, unknown>;
  type: "status" | "success" | "error" | "decision" | "tx" | "banner";
}

const timeline: TimelineEntry[] = [];
const start = Date.now();

function classifyType(phase: string, message: string): TimelineEntry["type"] {
  if (message.includes("REJECTED") || message.includes("failed") || message.includes("error")) return "error";
  if (message.includes("APPROVED") || message.includes("complete") || message.includes("deployed") || message.includes("Found")) return "success";
  if (message.includes("Decision") || message.includes("review")) return "decision";
  if (message.includes("tx:") || message.includes("DRY RUN")) return "tx";
  return "status";
}

function record(phase: string, message: string, data?: Record<string, unknown>) {
  const entry: TimelineEntry = {
    t: Date.now() - start,
    phase,
    message,
    data,
    type: classifyType(phase, message),
  };
  timeline.push(entry);

  // Also print to terminal for monitoring
  const color = phase === "AGENT" ? "\x1b[38;2;198;168;75m" : "\x1b[38;2;184;134;58m";
  console.log(`${color}[${phase}]\x1b[0m ${message}`);
}

// Override phaseLog to capture
// We dynamically patch the logger module
const originalLog = await import("../src/logger/index.js");
const origPhaseLog = originalLog.phaseLog;

// Monkey-patch phaseLog globally
(originalLog as any).phaseLog = (phase: string, message: string, data?: Record<string, unknown>) => {
  record(phase, message, data);
};

// Now import and run the agent
const { envSchema } = await import("../src/types/index.js");
const { initPrivacyNode } = await import("../src/chain/privacy.js");
const { initPublicChain } = await import("../src/chain/public.js");
const { ADDRESSES } = await import("../src/chain/contracts.js");
const { setModel } = await import("../src/agent/llm.js");
const { initGuardrails } = await import("../src/agent/guardrails.js");
const { startAgentLoop, stopAgent } = await import("../src/agent/loop.js");

// Add banner entry
timeline.push({
  t: 0,
  phase: "BANNER",
  message: "DEAR",
  type: "banner",
});

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
if (env.DRY_RUN) record("INIT", "DRY RUN MODE");

// Auto-stop after 1 cycle
let cycleCount = 0;
const origStartLoop = startAgentLoop;

// Save on exit
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

// Run the agent loop
try {
  await startAgentLoop(env, knownTokens);
} catch {
  // stopped
}
save();
