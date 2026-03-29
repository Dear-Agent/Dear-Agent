import { phaseLog } from "../logger/index.js";
import type { DetectedAsset, AttestationData, GovernanceDecision } from "../types/index.js";

const OLLAMA_BASE = "http://localhost:11434/v1/chat/completions";

const SYSTEM_PROMPT = `You are DEAR, an autonomous institutional treasury compliance agent.
You analyze tokenized assets for risk, compliance, and market viability.
You make governance decisions: APPROVE or REJECT assets for cross-chain bridging and marketplace listing.
IMPORTANT: Do NOT think or reason. Output ONLY the raw JSON object. No explanation, no markdown, no wrapping.`;

let model = "deepseek-r1:14b";

export function setModel(m: string) {
  model = m;
}

async function chat(userPrompt: string): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120_000);

  try {
    const res = await fetch(OLLAMA_BASE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 512,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`Ollama HTTP ${res.status}: ${await res.text()}`);
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content ?? "";
    // Strip <think>...</think> tags from deepseek-r1 responses
    return content.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
  } finally {
    clearTimeout(timeout);
  }
}

export async function analyzeAsset(
  asset: DetectedAsset,
): Promise<AttestationData> {
  const prompt = `Analyze this tokenized asset for attestation.
Asset: ${JSON.stringify({ address: asset.tokenAddress, name: asset.name, symbol: asset.symbol, balance: asset.balance.toString(), decimals: asset.decimals })}

Respond with JSON only:
{"assetType": "BOND|EQUITY|COMMODITY|STABLECOIN|OTHER", "riskScore": 1-100, "complianceStatus": "COMPLIANT|NEEDS_REVIEW|NON_COMPLIANT", "metadata": "brief analysis"}`;

  phaseLog("LLM", "Analyzing asset for attestation", {
    token: asset.symbol,
  });

  const raw = await chat(prompt);

  try {
    const parsed = JSON.parse(extractJson(raw));
    return {
      tokenAddress: asset.tokenAddress,
      issuer: "",
      assetType: parsed.assetType ?? "OTHER",
      riskScore: parsed.riskScore ?? 50,
      complianceStatus: parsed.complianceStatus ?? "NEEDS_REVIEW",
      metadata: parsed.metadata ?? raw,
    };
  } catch {
    phaseLog("LLM", "Failed to parse LLM response, using defaults", {
      raw,
    });
    return {
      tokenAddress: asset.tokenAddress,
      issuer: "",
      assetType: "OTHER",
      riskScore: 50,
      complianceStatus: "NEEDS_REVIEW",
      metadata: `LLM analysis: ${raw.slice(0, 200)}`,
    };
  }
}

export async function governanceReview(
  asset: DetectedAsset,
  attestation: AttestationData,
): Promise<GovernanceDecision> {
  const prompt = `You are the governance committee. Review this asset for cross-chain bridge and marketplace listing.

Asset: ${asset.symbol} (${asset.name}) at ${asset.tokenAddress}
Balance: ${asset.balance.toString()}
Attestation: type=${attestation.assetType}, risk=${attestation.riskScore}/100, compliance=${attestation.complianceStatus}

Rules:
- REJECT if riskScore > 80 or complianceStatus is NON_COMPLIANT
- APPROVE if riskScore <= 80 and compliance is COMPLIANT or NEEDS_REVIEW
- Suggest a price in wei (use 1000000000000000000 = 1 ETH as baseline)

Respond with JSON only:
{"approved": true|false, "reasoning": "...", "suggestedPrice": "number_as_string", "riskLevel": "LOW|MEDIUM|HIGH|CRITICAL"}`;

  phaseLog("LLM", "Governance review", { token: asset.symbol });

  const raw = await chat(prompt);

  try {
    const parsed = JSON.parse(extractJson(raw));
    return {
      approved: parsed.approved ?? false,
      reasoning: parsed.reasoning ?? "No reasoning provided",
      suggestedPrice: BigInt(parsed.suggestedPrice ?? "1000000000000000000"),
      riskLevel: parsed.riskLevel ?? "MEDIUM",
    };
  } catch {
    phaseLog("LLM", "Failed to parse governance response, defaulting to REJECT", { raw });
    return {
      approved: false,
      reasoning: `Parse error. Raw: ${raw.slice(0, 200)}`,
      suggestedPrice: 0n,
      riskLevel: "HIGH",
    };
  }
}

function extractJson(text: string): string {
  const match = text.match(/\{[\s\S]*\}/);
  return match ? match[0] : text;
}
