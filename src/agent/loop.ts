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
import type { Env } from "../types/index.js";

let running = false;
const processedAssets = new Set<string>();

export function stopAgent() {
  running = false;
}

export async function startAgentLoop(env: Env, knownTokens: `0x${string}`[]) {
  running = true;
  let cycle = 0;

  phaseLog("AGENT", "Starting autonomous treasury agent loop", {
    dryRun: isDryRun(),
    interval: env.AGENT_LOOP_INTERVAL_MS,
    knownTokens: knownTokens.length,
  });

  while (running) {
    cycle++;
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

      phaseLog("DETECT", `Found ${assets.length} asset(s)`);

      for (const asset of assets) {
        const assetKey = `${asset.tokenAddress}-${asset.balance.toString()}`;

        // Skip already processed assets (same address + same balance)
        if (processedAssets.has(assetKey)) {
          phaseLog("DETECT", `Already processed ${asset.symbol}, skipping`);
          continue;
        }

        // Cooldown check
        if (!checkCooldown(asset.tokenAddress)) {
          continue;
        }

        // PHASE 2: ATTEST
        phaseLog("ATTEST", `Analyzing ${asset.symbol} for attestation...`);
        const attestation = await analyzeAsset(asset);
        phaseLog("ATTEST", `Analysis complete`, {
          type: attestation.assetType,
          risk: attestation.riskScore,
          compliance: attestation.complianceStatus,
        });

        const attestTx = await attestOnChain(attestation, isDryRun());
        if (attestTx) {
          phaseLog("ATTEST", `On-chain attestation: ${attestTx}`);
        }

        // PHASE 3: GOVERN
        phaseLog("GOVERN", `Governance review for ${asset.symbol}...`);
        const decision = await governanceReview(asset, attestation);
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
        const bridgeAmount = validateBridgeAmount(asset.balance);
        const bridgeTx = await bridgeAsset(
          asset.tokenAddress as `0x${string}`,
          bridgeAmount,
          isDryRun(),
          getMaxBridgeAmount(),
        );

        if (bridgeTx) {
          phaseLog("BRIDGE", `Bridge tx: ${bridgeTx}`);
        }

        // PHASE 5: LIST
        phaseLog("LIST", `Listing ${asset.symbol} on marketplace...`);
        const listTx = await listOnMarketplace(
          asset.tokenAddress as `0x${string}`,
          bridgeAmount,
          decision.suggestedPrice,
          isDryRun(),
        );

        if (listTx) {
          phaseLog("LIST", `Marketplace tx: ${listTx}`);
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
      phaseLog("MONITOR", "Checking marketplace state...");
      const listings = await getMarketplaceListings();
      phaseLog("MONITOR", `Active listings: ${listings.filter((l) => l.active).length}/${listings.length}`);
    } catch (err) {
      phaseLog("AGENT", "Cycle error", { error: String(err) });
    }

    phaseLog("AGENT", `Sleeping ${env.AGENT_LOOP_INTERVAL_MS}ms...`);
    await sleep(env.AGENT_LOOP_INTERVAL_MS);
  }

  phaseLog("AGENT", "Agent loop stopped");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
