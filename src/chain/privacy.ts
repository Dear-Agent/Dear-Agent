import {
  createPublicClient,
  createWalletClient,
  http,
  defineChain,
  type PublicClient,
  type WalletClient,
  type Transport,
  type Chain,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import type { Env } from "../types/index.js";

let publicClient: PublicClient<Transport, Chain>;
let walletClient: WalletClient<Transport, Chain>;

export function initPrivacyNode(env: Env) {
  const privacyChain = defineChain({
    id: env.PRIVACY_NODE_CHAIN_ID,
    name: "Rayls Privacy Node 5",
    nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
    rpcUrls: {
      default: { http: [env.PRIVACY_NODE_RPC_URL] },
    },
  });

  const account = privateKeyToAccount(
    env.DEPLOYER_PRIVATE_KEY as `0x${string}`,
  );

  publicClient = createPublicClient({
    chain: privacyChain,
    transport: http(env.PRIVACY_NODE_RPC_URL),
  });

  walletClient = createWalletClient({
    account,
    chain: privacyChain,
    transport: http(env.PRIVACY_NODE_RPC_URL),
  });

  return { publicClient, walletClient, account };
}

export function getPrivacyPublicClient() {
  return publicClient;
}

export function getPrivacyWalletClient() {
  return walletClient;
}
