import { phaseLog } from "../logger/index.js";
import { analyzeAsset, governanceReview } from "./llm.js";
import {
  detectAssets,
  attestOnChain,
  bridgeAsset,
  listOnMarketplace,
  getMarketplaceListings,
} from "./tools.js";
import {
  isDryRun,
  getMaxBridgeAmount,
  checkCooldown,
  recordAction,
  validateBridgeAmount,
} from "./guardrails.js";
import { playSound, speak } from "./sounds.js";
import type { Env } from "../types/index.js";

let running = false;
const processedAssets = new Set<string>();

export function stopAgent() {
  running = false;
}

export async function startAgentLoop(env: Env, knownTokens: `0x${string}`[]) {
  running = true;
  let cycle = 0;

  playSound("INIT");
  speak("DEAR agent online. Starting autonomous treasury loop.");
  phaseLog("AGENT", "Starting autonomous treasury agent loop", {
    dryRun: isDryRun(),
    interval: env.AGENT_LOOP_INTERVAL_MS,
    knownTokens: knownTokens.length,
  });

  while (running) {
    cycle++;
    playSound("CYCLE_START");
    phaseLog("AGENT", `--- Cycle ${cycle} ---`);

    try {
      // PHASE 1: DETECT
      phaseLog("DETECT", "Scanning for assets on Privacy Node...");
      const assets = await detectAssets(knownTokens);

      if (assets.length === 0) {
        phaseLog("DETECT", "No assets found, waiting...");
        await sleep(env.AGENT_LOOP_INTERVAL_MS);
        continue;
      }

      playSound("DETECT");
      phaseLog("DETECT", `Found ${assets.length} asset(s)`);
      speak(`Detected ${assets.length} asset${assets.length > 1 ? "s" : ""} on privacy node.`);

      for (const asset of assets) {
        const assetKey = `${asset.tokenAddress}-${asset.balance.toString()}`;

        if (processedAssets.has(assetKey)) {
          phaseLog("DETECT", `Already processed ${asset.symbol}, skipping`);
          continue;
        }

        if (!checkCooldown(asset.tokenAddress)) {
          continue;
        }

        // PHASE 2: ATTEST
        phaseLog("ATTEST", `Analyzing ${asset.symbol} for attestation...`);
        speak(`Analyzing ${asset.symbol} for compliance attestation.`);
        const attestation = await analyzeAsset(asset);
        playSound("ATTEST");
        phaseLog("ATTEST", `Analysis complete`, {
          type: attestation.assetType,
          risk: attestation.riskScore,
          compliance: attestation.complianceStatus,
        });
        speak(`Attestation complete. Risk score: ${attestation.riskScore}. Status: ${attestation.complianceStatus}.`);

        const attestTx = await attestOnChain(attestation, isDryRun());
        if (attestTx) {
          phaseLog("ATTEST", `On-chain attestation: ${attestTx}`);
        }

        // PHASE 3: GOVERN
        phaseLog("GOVERN", `Governance review for ${asset.symbol}...`);
        speak(`Running governance review for ${asset.symbol}.`);
        const decision = await governanceReview(asset, attestation);

        if (decision.approved) {
          playSound("GOVERN_APPROVED");
          speak(`Governance approved. ${asset.symbol} cleared for bridge and listing.`);
        } else {
          playSound("GOVERN_REJECTED");
          speak(`Governance rejected ${asset.symbol}. Reason: ${decision.reasoning.slice(0, 80)}.`);
        }

        phaseLog("GOVERN", `Decision: ${decision.approved ? "APPROVED" : "REJECTED"}`, {
          reasoning: decision.reasoning,
          riskLevel: decision.riskLevel,
          suggestedPrice: decision.suggestedPrice.toString(),
        });

        if (!decision.approved) {
          phaseLog("GOVERN", `REJECTED: ${decision.reasoning}`);
          recordAction(asset.tokenAddress);
          processedAssets.add(assetKey);
          continue;
        }

        // PHASE 4: BRIDGE
        phaseLog("BRIDGE", `Bridging ${asset.symbol} to public chain...`);
        speak(`Initiating cross-chain bridge for ${asset.symbol}.`);
        const bridgeAmount = validateBridgeAmount(asset.balance);
        const bridgeTx = await bridgeAsset(
          asset.tokenAddress as `0x${string}`,
          bridgeAmount,
          isDryRun(),
          getMaxBridgeAmount(),
        );

        if (bridgeTx) {
          playSound("BRIDGE");
          phaseLog("BRIDGE", `Bridge tx: ${bridgeTx}`);
          speak(`Bridge transaction submitted.`);
        }

        // PHASE 5: LIST
        phaseLog("LIST", `Listing ${asset.symbol} on marketplace...`);
        speak(`Listing ${asset.symbol} on public marketplace.`);
        const listTx = await listOnMarketplace(
          asset.tokenAddress as `0x${string}`,
          bridgeAmount,
          decision.suggestedPrice,
          isDryRun(),
        );

        if (listTx) {
          playSound("LIST");
          phaseLog("LIST", `Marketplace tx: ${listTx}`);
          speak(`${asset.symbol} is now listed on the marketplace.`);
        }

        recordAction(asset.tokenAddress);
        processedAssets.add(assetKey);

        phaseLog("AGENT", `Completed full cycle for ${asset.symbol}`, {
          attest: attestTx ?? "skipped",
          bridge: bridgeTx ?? "skipped",
          list: listTx ?? "skipped",
        });
      }

      // PHASE 6: MONITOR
      playSound("MONITOR");
      phaseLog("MONITOR", "Checking marketplace state...");
      const listings = await getMarketplaceListings();
      phaseLog("MONITOR", `Active listings: ${listings.filter((l) => l.active).length}/${listings.length}`);
    } catch (err) {
      playSound("ERROR");
      phaseLog("AGENT", "Cycle error", { error: String(err) });
    }

    phaseLog("AGENT", `Sleeping ${env.AGENT_LOOP_INTERVAL_MS}ms...`);
    await sleep(env.AGENT_LOOP_INTERVAL_MS);
  }

  speak("DEAR agent shutting down.");
  phaseLog("AGENT", "Agent loop stopped");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
