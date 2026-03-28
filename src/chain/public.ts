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

export function initPublicChain(env: Env) {
  const publicChain = defineChain({
    id: env.PUBLIC_CHAIN_ID,
    name: "Rayls Public Testnet",
    nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
    rpcUrls: {
      default: { http: [env.PUBLIC_CHAIN_RPC_URL] },
    },
  });

  const account = privateKeyToAccount(
    env.DEPLOYER_PRIVATE_KEY as `0x${string}`,
  );

  publicClient = createPublicClient({
    chain: publicChain,
    transport: http(env.PUBLIC_CHAIN_RPC_URL),
  });

  walletClient = createWalletClient({
    account,
    chain: publicChain,
    transport: http(env.PUBLIC_CHAIN_RPC_URL),
  });

  return { publicClient, walletClient, account };
}

export function getPublicClient() {
  return publicClient;
}

export function getPublicWalletClient() {
  return walletClient;
}
