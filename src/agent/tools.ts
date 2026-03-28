import { parseAbiItem, formatUnits } from "viem";
import {
  getPrivacyPublicClient,
  getPrivacyWalletClient,
} from "../chain/privacy.js";
import { getPublicClient, getPublicWalletClient } from "../chain/public.js";
import {
  HACKATHON_TOKEN_ABI,
  ATTESTATION_ABI,
  MARKETPLACE_ABI,
  ADDRESSES,
} from "../chain/contracts.js";
import { phaseLog } from "../logger/index.js";
import type { DetectedAsset, AttestationData } from "../types/index.js";

export async function detectAssets(
  knownTokens: `0x${string}`[],
): Promise<DetectedAsset[]> {
  const client = getPrivacyPublicClient();
  const wallet = getPrivacyWalletClient();
  const account = wallet.account!;
  const assets: DetectedAsset[] = [];

  for (const tokenAddr of knownTokens) {
    try {
      const [name, symbol, decimals, balance] = await Promise.all([
        client.readContract({
          address: tokenAddr,
          abi: HACKATHON_TOKEN_ABI,
          functionName: "name",
        }) as Promise<string>,
        client.readContract({
          address: tokenAddr,
          abi: HACKATHON_TOKEN_ABI,
          functionName: "symbol",
        }) as Promise<string>,
        client.readContract({
          address: tokenAddr,
          abi: HACKATHON_TOKEN_ABI,
          functionName: "decimals",
        }) as Promise<number>,
        client.readContract({
          address: tokenAddr,
          abi: HACKATHON_TOKEN_ABI,
          functionName: "balanceOf",
          args: [account.address],
        }) as Promise<bigint>,
      ]);

      if (balance > 0n) {
        assets.push({
          tokenAddress: tokenAddr,
          name,
          symbol,
          balance,
          decimals,
        });
        phaseLog("DETECT", `Found ${symbol}: ${formatUnits(balance, decimals)}`, {
          address: tokenAddr,
        });
      }
    } catch (err) {
      phaseLog("DETECT", `Failed to read token ${tokenAddr}`, {
        error: String(err),
      });
    }
  }

  // Also scan for Transfer events to discover new tokens
  try {
    const transferEvent = parseAbiItem(
      "event Transfer(address indexed from, address indexed to, uint256 value)",
    );
    const latestBlock = await client.getBlockNumber();
    const fromBlock = latestBlock > 10000n ? latestBlock - 10000n : 0n;
    const logs = await client.getLogs({
      event: transferEvent,
      args: { to: account.address },
      fromBlock,
      toBlock: "latest",
    });

    const discoveredAddresses = new Set(
      logs.map((l) => l.address.toLowerCase()),
    );

    for (const addr of discoveredAddresses) {
      const hex = addr as `0x${string}`;
      if (knownTokens.some((k) => k.toLowerCase() === addr)) continue;

      try {
        const [name, symbol, decimals, balance] = await Promise.all([
          client.readContract({
            address: hex,
            abi: HACKATHON_TOKEN_ABI,
            functionName: "name",
          }) as Promise<string>,
          client.readContract({
            address: hex,
            abi: HACKATHON_TOKEN_ABI,
            functionName: "symbol",
          }) as Promise<string>,
          client.readContract({
            address: hex,
            abi: HACKATHON_TOKEN_ABI,
            functionName: "decimals",
          }) as Promise<number>,
          client.readContract({
            address: hex,
            abi: HACKATHON_TOKEN_ABI,
            functionName: "balanceOf",
            args: [account.address],
          }) as Promise<bigint>,
        ]);

        if (balance > 0n) {
          assets.push({
            tokenAddress: hex,
            name,
            symbol,
            balance,
            decimals,
          });
          phaseLog("DETECT", `Discovered ${symbol}: ${formatUnits(balance, decimals)}`, {
            address: hex,
          });
        }
      } catch {
        // Not an ERC20, skip
      }
    }
  } catch (err) {
    phaseLog("DETECT", "Event scan failed, using known tokens only", {
      error: String(err),
    });
  }

  return assets;
}

export async function attestOnChain(
  attestation: AttestationData,
  dryRun: boolean,
): Promise<string | null> {
  if (!ADDRESSES.attestation) {
    phaseLog("ATTEST", "No attestation contract deployed, skipping on-chain attestation");
    return null;
  }

  if (dryRun) {
    phaseLog("ATTEST", "DRY RUN - would attest on-chain", {
      token: attestation.tokenAddress,
      riskScore: attestation.riskScore,
    });
    return "dry-run-tx";
  }

  const client = getPublicWalletClient();
  const account = client.account!;
  try {
    const hash = await client.writeContract({
      account,
      address: ADDRESSES.attestation,
      abi: ATTESTATION_ABI,
      functionName: "attest",
      args: [
        attestation.tokenAddress as `0x${string}`,
        attestation.assetType,
        BigInt(attestation.riskScore),
        attestation.complianceStatus,
        attestation.metadata,
      ],
    });

    phaseLog("ATTEST", `Attestation tx: ${hash}`, {
      token: attestation.tokenAddress,
    });
    return hash;
  } catch (err) {
    phaseLog("ATTEST", "Attestation tx failed", { error: String(err) });
    return null;
  }
}

export async function bridgeAsset(
  tokenAddress: `0x${string}`,
  amount: bigint,
  dryRun: boolean,
  maxAmount: bigint,
): Promise<string | null> {
  if (amount > maxAmount) {
    phaseLog("BRIDGE", `Amount ${amount} exceeds max ${maxAmount}, capping`);
    amount = maxAmount;
  }

  if (dryRun) {
    phaseLog("BRIDGE", "DRY RUN - would bridge asset", {
      token: tokenAddress,
      amount: amount.toString(),
    });
    return "dry-run-bridge-tx";
  }

  // Bridge via Rayls backend API
  try {
    const backendUrl = process.env.BACKEND_URL;
    const res = await fetch(`${backendUrl}/api/bridge`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPERATOR_AUTH_KEY}`,
      },
      body: JSON.stringify({
        tokenAddress,
        amount: amount.toString(),
        sourceChainId: Number(process.env.PRIVACY_NODE_CHAIN_ID),
        targetChainId: Number(process.env.PUBLIC_CHAIN_ID),
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      phaseLog("BRIDGE", `Bridge API error: ${res.status}`, { body: text });
      return null;
    }

    const data = await res.json();
    phaseLog("BRIDGE", `Bridge initiated: ${data.txHash ?? "pending"}`, {
      token: tokenAddress,
    });
    return data.txHash ?? "pending";
  } catch (err) {
    phaseLog("BRIDGE", "Bridge failed", { error: String(err) });
    return null;
  }
}

export async function listOnMarketplace(
  tokenAddress: `0x${string}`,
  amount: bigint,
  pricePerUnit: bigint,
  dryRun: boolean,
): Promise<string | null> {
  if (!ADDRESSES.marketplace) {
    phaseLog("LIST", "No marketplace contract deployed, skipping listing");
    return null;
  }

  if (dryRun) {
    phaseLog("LIST", "DRY RUN - would list on marketplace", {
      token: tokenAddress,
      amount: amount.toString(),
      price: pricePerUnit.toString(),
    });
    return "dry-run-list-tx";
  }

  const client = getPublicWalletClient();
  const account = client.account!;
  try {
    const hash = await client.writeContract({
      account,
      address: ADDRESSES.marketplace,
      abi: MARKETPLACE_ABI,
      functionName: "list",
      args: [tokenAddress, amount, pricePerUnit],
    });

    phaseLog("LIST", `Listed on marketplace: ${hash}`, {
      token: tokenAddress,
    });
    return hash;
  } catch (err) {
    phaseLog("LIST", "Marketplace listing failed", { error: String(err) });
    return null;
  }
}

export async function getMarketplaceListings(): Promise<
  Array<{
    id: number;
    seller: string;
    tokenAddress: string;
    amount: bigint;
    price: bigint;
    active: boolean;
  }>
> {
  if (!ADDRESSES.marketplace) return [];

  const client = getPublicClient();
  try {
    const count = (await client.readContract({
      address: ADDRESSES.marketplace,
      abi: MARKETPLACE_ABI,
      functionName: "listingCount",
    })) as bigint;

    const listings = [];
    for (let i = 0; i < Number(count); i++) {
      const listing = (await client.readContract({
        address: ADDRESSES.marketplace,
        abi: MARKETPLACE_ABI,
        functionName: "getListing",
        args: [BigInt(i)],
      })) as {
        seller: string;
        tokenAddress: string;
        amount: bigint;
        pricePerUnit: bigint;
        active: boolean;
      };

      listings.push({
        id: i,
        seller: listing.seller,
        tokenAddress: listing.tokenAddress,
        amount: listing.amount,
        price: listing.pricePerUnit,
        active: listing.active,
      });
    }

    return listings;
  } catch (err) {
    phaseLog("MONITOR", "Failed to read marketplace", {
      error: String(err),
    });
    return [];
  }
}
