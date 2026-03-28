import "dotenv/config";
import { envSchema } from "./types/index.js";
import { phaseLog } from "./logger/index.js";
import { initPrivacyNode } from "./chain/privacy.js";
import { initPublicChain } from "./chain/public.js";
import { ADDRESSES } from "./chain/contracts.js";
import { setModel } from "./agent/llm.js";
import { initGuardrails } from "./agent/guardrails.js";
import { startAgentLoop, stopAgent } from "./agent/loop.js";

async function main() {
  phaseLog("INIT", "DEAR - Autonomous Institutional Treasury Agent");
  phaseLog("INIT", "Validating environment...");

  const env = envSchema.parse(process.env);

  // Configure LLM
  setModel(env.OLLAMA_MODEL);
  phaseLog("INIT", `LLM model: ${env.OLLAMA_MODEL}`);

  // Initialize guardrails
  initGuardrails({
    maxBridgeAmount: env.MAX_BRIDGE_AMOUNT,
    dryRun: env.DRY_RUN,
    cooldownMs: 10_000,
  });

  // Connect to Privacy Node
  phaseLog("INIT", "Connecting to Privacy Node...");
  const privacy = initPrivacyNode(env);
  try {
    const privacyBlock = await privacy.publicClient.getBlockNumber();
    phaseLog("INIT", `Privacy Node connected, block: ${privacyBlock}`);
  } catch (err) {
    phaseLog("INIT", `Privacy Node connection failed: ${err}`);
    phaseLog("INIT", "Continuing in offline mode...");
  }

  // Connect to Public Chain
  phaseLog("INIT", "Connecting to Public Chain...");
  const pub = initPublicChain(env);
  try {
    const publicBlock = await pub.publicClient.getBlockNumber();
    phaseLog("INIT", `Public Chain connected, block: ${publicBlock}`);
  } catch (err) {
    phaseLog("INIT", `Public Chain connection failed: ${err}`);
    phaseLog("INIT", "Continuing in offline mode...");
  }

  // Set contract addresses from env or CLI args
  const tokenArg = process.argv[2];
  const attestArg = process.argv[3];
  const marketArg = process.argv[4];

  if (tokenArg) ADDRESSES.hackathonToken = tokenArg as `0x${string}`;
  if (attestArg) ADDRESSES.attestation = attestArg as `0x${string}`;
  if (marketArg) ADDRESSES.marketplace = marketArg as `0x${string}`;

  // Build known tokens list
  const knownTokens: `0x${string}`[] = [];
  if (ADDRESSES.hackathonToken) knownTokens.push(ADDRESSES.hackathonToken);

  // Allow extra tokens via KNOWN_TOKENS env var (comma-separated)
  const extraTokens = process.env.KNOWN_TOKENS;
  if (extraTokens) {
    for (const t of extraTokens.split(",")) {
      const trimmed = t.trim();
      if (trimmed.startsWith("0x")) knownTokens.push(trimmed as `0x${string}`);
    }
  }

  phaseLog("INIT", `Known tokens: ${knownTokens.length}`, {
    tokens: knownTokens,
  });

  if (env.DRY_RUN) {
    phaseLog("INIT", "DRY RUN MODE - no on-chain transactions will be sent");
  }

  // Graceful shutdown
  process.on("SIGINT", () => {
    phaseLog("AGENT", "Shutting down...");
    stopAgent();
  });
  process.on("SIGTERM", () => {
    phaseLog("AGENT", "Shutting down...");
    stopAgent();
  });

  // Start the agent loop
  await startAgentLoop(env, knownTokens);
}

main().catch((err) => {
  phaseLog("FATAL", `Unhandled error: ${err}`);
  process.exit(1);
});
