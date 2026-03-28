import { z } from "zod";

export const envSchema = z.object({
  PRIVACY_NODE_RPC_URL: z.string().url(),
  DEPLOYMENT_PROXY_REGISTRY: z.string().startsWith("0x"),
  PRIVACY_NODE_CHAIN_ID: z.coerce.number(),
  PUBLIC_CHAIN_RPC_URL: z.string().url(),
  PUBLIC_CHAIN_ID: z.coerce.number(),
  BACKEND_URL: z.string().url(),
  USER_AUTH_KEY: z.string().min(1),
  OPERATOR_AUTH_KEY: z.string().min(1),
  DEPLOYER_PRIVATE_KEY: z.string().startsWith("0x"),
  USER_PRIVATE_KEY: z.string().startsWith("0x"),
  OLLAMA_MODEL: z.string().default("deepseek-r1:14b"),
  DRY_RUN: z.coerce.boolean().default(true),
  MAX_BRIDGE_AMOUNT: z.coerce.number().default(10000),
  AGENT_LOOP_INTERVAL_MS: z.coerce.number().default(30000),
});

export type Env = z.infer<typeof envSchema>;

export interface DetectedAsset {
  tokenAddress: string;
  name: string;
  symbol: string;
  balance: bigint;
  decimals: number;
}

export interface AttestationData {
  tokenAddress: string;
  issuer: string;
  assetType: string;
  riskScore: number;
  complianceStatus: string;
  metadata: string;
}

export interface GovernanceDecision {
  approved: boolean;
  reasoning: string;
  suggestedPrice: bigint;
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
}

export interface MarketplaceListing {
  tokenAddress: string;
  seller: string;
  price: bigint;
  active: boolean;
}

export type AgentPhase =
  | "DETECT"
  | "ATTEST"
  | "GOVERN"
  | "BRIDGE"
  | "LIST"
  | "MONITOR"
  | "IDLE";
