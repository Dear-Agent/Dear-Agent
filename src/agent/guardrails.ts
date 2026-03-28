import { phaseLog } from "../logger/index.js";

interface GuardrailConfig {
  maxBridgeAmount: bigint;
  dryRun: boolean;
  cooldownMs: number;
}

let config: GuardrailConfig = {
  maxBridgeAmount: 10000n * 10n ** 18n,
  dryRun: true,
  cooldownMs: 10_000,
};

const lastAction = new Map<string, number>();

export function initGuardrails(opts: {
  maxBridgeAmount: number;
  dryRun: boolean;
  cooldownMs?: number;
}) {
  config = {
    maxBridgeAmount: BigInt(opts.maxBridgeAmount) * 10n ** 18n,
    dryRun: opts.dryRun,
    cooldownMs: opts.cooldownMs ?? 10_000,
  };

  phaseLog("GUARDRAILS", "Initialized", {
    maxBridgeAmount: config.maxBridgeAmount.toString(),
    dryRun: config.dryRun,
    cooldownMs: config.cooldownMs,
  });
}

export function isDryRun(): boolean {
  return config.dryRun;
}

export function getMaxBridgeAmount(): bigint {
  return config.maxBridgeAmount;
}

export function checkCooldown(actionKey: string): boolean {
  const last = lastAction.get(actionKey);
  if (last && Date.now() - last < config.cooldownMs) {
    phaseLog("GUARDRAILS", `Cooldown active for ${actionKey}`, {
      remainingMs: config.cooldownMs - (Date.now() - last),
    });
    return false;
  }
  return true;
}

export function recordAction(actionKey: string) {
  lastAction.set(actionKey, Date.now());
}

export function validateBridgeAmount(amount: bigint): bigint {
  if (amount > config.maxBridgeAmount) {
    phaseLog("GUARDRAILS", "Bridge amount capped", {
      requested: amount.toString(),
      max: config.maxBridgeAmount.toString(),
    });
    return config.maxBridgeAmount;
  }
  return amount;
}
