/**
 * setup.ts — Full onboarding + deploy script for Rayls Hackathon
 *
 * Steps:
 *   1. Call backend onboarding API → get a funded registered wallet
 *   2. Operator-approve the wallet (enables bridging)
 *   3. Query registry for Endpoint address
 *   4. Deploy HackathonToken on Privacy Node
 *   5. Register token via backend API
 *   6. Print env vars to add to .env
 */
import "dotenv/config";
import {
  createWalletClient,
  createPublicClient,
  http,
  defineChain,
  encodeAbiParameters,
  parseAbiParameters,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { readFileSync } from "fs";
import solc from "solc";

const BACKEND_URL = process.env.BACKEND_URL!;
const USER_AUTH_KEY = process.env.USER_AUTH_KEY!;
const OPERATOR_AUTH_KEY = process.env.OPERATOR_AUTH_KEY!;
const PRIVACY_NODE_RPC_URL = process.env.PRIVACY_NODE_RPC_URL!;
const PRIVACY_NODE_CHAIN_ID = Number(process.env.PRIVACY_NODE_CHAIN_ID!);
const DEPLOYMENT_PROXY_REGISTRY = process.env.DEPLOYMENT_PROXY_REGISTRY as `0x${string}`;

const privacyChain = defineChain({
  id: PRIVACY_NODE_CHAIN_ID,
  name: "Rayls Privacy Node",
  nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [PRIVACY_NODE_RPC_URL] } },
});

const REGISTRY_ABI = [
  {
    type: "function",
    name: "getContract",
    inputs: [{ name: "name", type: "string" }],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getAllContracts",
    inputs: [],
    outputs: [
      { name: "names", type: "string[]" },
      { name: "addresses", type: "address[]" },
    ],
    stateMutability: "view",
  },
] as const;

const CONTRACT_FACTORY_ABI = [
  {
    type: "function",
    name: "deploy",
    inputs: [{ name: "bytecode", type: "bytes" }],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "deployContract",
    inputs: [{ name: "bytecode", type: "bytes" }],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "nonpayable",
  },
] as const;

async function step1_onboard(): Promise<{ privateKey: string; address: string }> {
  console.log("\n[STEP 1] Onboarding wallet via backend API...");

  // Try with empty body first, then with explicit JSON body
  let res = await fetch(`${BACKEND_URL}/api/user/onboarding`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${USER_AUTH_KEY}` },
  });

  if (!res.ok) {
    res = await fetch(`${BACKEND_URL}/api/user/onboarding`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${USER_AUTH_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Onboarding failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  console.log("Onboarding response:", JSON.stringify(data, null, 2));

  // Try different field names from the response
  const privateKey: string =
    data.private_chain_private_key ??
    data.privateKey ??
    data.private_key ??
    data.deployer_private_key ??
    data.wallet?.privateKey;

  const address: string =
    data.private_chain_address ??
    data.address ??
    data.wallet?.address;

  if (!privateKey) {
    console.log("Full response:", data);
    throw new Error("Could not find private key in onboarding response");
  }

  console.log(`Got wallet address: ${address}`);
  return { privateKey, address };
}

async function step2_approveWallet(address: string): Promise<void> {
  console.log(`\n[STEP 2] Operator-approving wallet ${address}...`);
  const res = await fetch(`${BACKEND_URL}/api/operator/onboarding/status`, {
    method: "PATCH",
    headers: {
      "Authorization": `Bearer ${OPERATOR_AUTH_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ address, new_status: 1 }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.warn(`Operator approval warning: ${res.status} ${text}`);
  } else {
    const data = await res.json().catch(() => ({}));
    console.log("Operator approval:", JSON.stringify(data));
  }
}

async function step3_getEndpoint(publicClient: any): Promise<string> {
  console.log("\n[STEP 3] Querying registry for infrastructure addresses...");
  try {
    const [names, addresses] = await publicClient.readContract({
      address: DEPLOYMENT_PROXY_REGISTRY,
      abi: REGISTRY_ABI,
      functionName: "getAllContracts",
    }) as [string[], string[]];

    console.log("Registry contracts:");
    names.forEach((n: string, i: number) => console.log(`  ${n} => ${addresses[i]}`));

    const endpointIdx = names.findIndex((n: string) => n === "Endpoint");
    return endpointIdx >= 0 ? addresses[endpointIdx] : "";
  } catch (err) {
    console.warn("Could not query registry:", err);
    return "";
  }
}

async function step4_deploy(walletClient: any, publicClient: any, deployerAddress: string): Promise<string> {
  console.log("\n[STEP 4] Compiling HackathonToken...");

  const source = readFileSync("contracts/src/HackathonToken.sol", "utf8");
  const input = {
    language: "Solidity",
    sources: { "HackathonToken.sol": { content: source } },
    settings: {
      outputSelection: { "*": { "*": ["abi", "evm.bytecode"] } },
      evmVersion: "paris",
      optimizer: { enabled: true, runs: 50 },
    },
  };

  const compiled = JSON.parse(solc.compile(JSON.stringify(input)));
  if (compiled.errors?.some((e: any) => e.severity === "error")) {
    compiled.errors.forEach((e: any) => console.error(e.formattedMessage));
    throw new Error("Compilation failed");
  }

  const contract = compiled.contracts["HackathonToken.sol"]["HackathonToken"];
  const bytecode = ("0x" + contract.evm.bytecode.object) as `0x${string}`;

  const TOKEN_NAME = "DearAgentToken";
  const TOKEN_SYMBOL = "DEAR";
  const INITIAL_SUPPLY = 1_000_000n * 10n ** 18n;

  const constructorArgs = encodeAbiParameters(
    parseAbiParameters("string, string, uint256"),
    [TOKEN_NAME, TOKEN_SYMBOL, INITIAL_SUPPLY],
  );

  const fullBytecode = (bytecode + constructorArgs.slice(2)) as `0x${string}`;
  const account = walletClient.account;

  // Get ContractFactory address from registry
  let contractFactoryAddr: `0x${string}` | null = null;
  try {
    contractFactoryAddr = await publicClient.readContract({
      address: DEPLOYMENT_PROXY_REGISTRY,
      abi: REGISTRY_ABI,
      functionName: "getContract",
      args: ["ContractFactory"],
    }) as `0x${string}`;
    console.log(`ContractFactory: ${contractFactoryAddr}`);
  } catch (err) {
    console.warn("Could not get ContractFactory from registry");
  }

  // Strategy A: Deploy via ContractFactory
  if (contractFactoryAddr && contractFactoryAddr !== "0x0000000000000000000000000000000000000000") {
    console.log("Trying ContractFactory.deploy(bytes)...");
    for (const fnName of ["deploy", "deployContract"] as const) {
      try {
        const { encodeFunctionData } = await import("viem");
        const data = encodeFunctionData({
          abi: CONTRACT_FACTORY_ABI,
          functionName: fnName,
          args: [fullBytecode],
        });
        const hash = await walletClient.sendTransaction({
          account,
          to: contractFactoryAddr,
          data,
          gasPrice: 0n,
          gas: 6_000_000n,
        });
        console.log(`Tx (${fnName}): ${hash}`);
        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        if (receipt.status === "success") {
          const addr = receipt.contractAddress ?? receipt.logs?.[0]?.address;
          console.log(`Token deployed via ContractFactory at: ${addr}`);
          return addr!;
        }
        console.log(`${fnName} reverted, trying next...`);
      } catch (err: any) {
        console.warn(`${fnName} error: ${err?.message?.slice(0, 150)}`);
      }
    }
  }

  // Strategy B: Direct deployment
  console.log("Trying direct deployment...");
  const hash = await walletClient.sendTransaction({
    account,
    data: fullBytecode,
    gasPrice: 0n,
    gas: 5_000_000n,
  });
  console.log(`Deploy tx: ${hash}`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  if (receipt.status !== "success") {
    throw new Error(`All deployment strategies failed. Last tx: ${hash}`);
  }

  console.log(`Token deployed at: ${receipt.contractAddress}`);
  return receipt.contractAddress!;
}

async function step5_registerToken(tokenAddress: string): Promise<void> {
  console.log(`\n[STEP 5] Registering token with backend...`);
  const res = await fetch(`${BACKEND_URL}/api/user/tokens`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${USER_AUTH_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: "DearAgentToken",
      symbol: "DEAR",
      address: tokenAddress,
      standard: 1, // ERC20
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.warn(`Token registration warning: ${res.status} ${text}`);
  } else {
    console.log("Token registered with backend.");
  }

  // Operator activate token
  const res2 = await fetch(`${BACKEND_URL}/api/operator/tokens/status`, {
    method: "PATCH",
    headers: {
      "Authorization": `Bearer ${OPERATOR_AUTH_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ address: tokenAddress, status: 1 }),
  });

  if (!res2.ok) {
    const text = await res2.text();
    console.warn(`Token activation warning: ${res2.status} ${text}`);
  } else {
    console.log("Token activated by operator.");
  }
}

async function main() {
  console.log("=== DEAR Agent Setup ===\n");

  // Step 1: Onboard wallet
  let privateKey: string;
  let walletAddress: string;
  try {
    const result = await step1_onboard();
    privateKey = result.privateKey.startsWith("0x") ? result.privateKey : `0x${result.privateKey}`;
    walletAddress = result.address;
  } catch (err: any) {
    console.warn(`Onboarding API failed: ${err.message}`);
    console.warn("Falling back to DEPLOYER_PRIVATE_KEY from .env...");
    privateKey = process.env.DEPLOYER_PRIVATE_KEY!;
    const account = privateKeyToAccount(privateKey as `0x${string}`);
    walletAddress = account.address;
  }

  const account = privateKeyToAccount(privateKey as `0x${string}`);
  const publicClient = createPublicClient({ chain: privacyChain, transport: http(PRIVACY_NODE_RPC_URL) });
  const walletClient = createWalletClient({ account, chain: privacyChain, transport: http(PRIVACY_NODE_RPC_URL) });

  console.log(`Using wallet: ${account.address}`);
  const balance = await publicClient.getBalance({ address: account.address });
  console.log(`Balance: ${balance} wei`);

  // Step 2: Approve wallet
  await step2_approveWallet(walletAddress);

  // Step 3: Query registry
  await step3_getEndpoint(publicClient);

  // Step 4: Deploy token
  const tokenAddress = await step4_deploy(walletClient, publicClient, account.address);

  // Step 5: Register token
  await step5_registerToken(tokenAddress);

  // Final output
  console.log("\n========================================");
  console.log("✅ Setup complete! Add to your .env:");
  console.log("========================================");
  console.log(`DEPLOYER_PRIVATE_KEY=${privateKey}`);
  console.log(`USER_PRIVATE_KEY=${privateKey}`);
  console.log(`KNOWN_TOKENS=${tokenAddress}`);
  console.log("\nThen run: npm run dev");
}

main().catch((err) => {
  console.error("Setup failed:", err);
  process.exit(1);
});
