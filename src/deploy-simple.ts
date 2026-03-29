import "dotenv/config";
import {
  createWalletClient,
  createPublicClient,
  http,
  encodeAbiParameters,
  parseAbiParameters,
  encodeFunctionData,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { envSchema } from "./types/index.js";
import { phaseLog } from "./logger/index.js";
import { readFileSync } from "fs";
import solc from "solc";

// Rayls DeploymentProxyRegistry ABI (common Rayls pattern)
const PROXY_REGISTRY_ABI = [
  {
    type: "function",
    name: "deploy",
    inputs: [{ name: "bytecode", type: "bytes" }],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "deployERC20",
    inputs: [
      { name: "name", type: "string" },
      { name: "symbol", type: "string" },
      { name: "initialSupply", type: "uint256" },
    ],
    outputs: [{ name: "", type: "address" }],
    stateMutability: "nonpayable",
  },
] as const;

async function main() {
  const env = envSchema.parse(process.env);

  const account = privateKeyToAccount(env.DEPLOYER_PRIVATE_KEY as `0x${string}`);

  const chain = {
    id: env.PRIVACY_NODE_CHAIN_ID,
    name: "Privacy Node",
    nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [env.PRIVACY_NODE_RPC_URL] } },
  } as const;

  const publicClient = createPublicClient({ chain, transport: http(env.PRIVACY_NODE_RPC_URL) });
  const walletClient = createWalletClient({ account, chain, transport: http(env.PRIVACY_NODE_RPC_URL) });

  const REGISTRY = env.DEPLOYMENT_PROXY_REGISTRY as `0x${string}`;

  phaseLog("DEPLOY", `Deployer address: ${account.address}`);
  phaseLog("DEPLOY", `Proxy registry: ${REGISTRY}`);

  const balance = await publicClient.getBalance({ address: account.address });
  phaseLog("DEPLOY", `Deployer balance: ${balance} wei (gasPrice=0, balance not required)`);

  // Compile the contract
  phaseLog("DEPLOY", "Compiling HackathonToken...");
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

  const output = JSON.parse(solc.compile(JSON.stringify(input)));

  if (output.errors?.some((e: any) => e.severity === "error")) {
    for (const e of output.errors) console.error(e.formattedMessage);
    process.exit(1);
  }

  const contract = output.contracts["HackathonToken.sol"]["HackathonToken"];
  const bytecode = ("0x" + contract.evm.bytecode.object) as `0x${string}`;

  const TOKEN_NAME = "DearAgentToken";
  const TOKEN_SYMBOL = "DEAR";
  const INITIAL_SUPPLY = 1_000_000n * 10n ** 18n;

  const constructorArgs = encodeAbiParameters(
    parseAbiParameters("string, string, uint256"),
    [TOKEN_NAME, TOKEN_SYMBOL, INITIAL_SUPPLY],
  );
  const fullBytecode = (bytecode + constructorArgs.slice(2)) as `0x${string}`;

  // Strategy 1: Deploy via Proxy Registry deploy(bytes)
  phaseLog("DEPLOY", "Attempting deploy via ProxyRegistry.deploy(bytes)...");
  try {
    const data = encodeFunctionData({
      abi: PROXY_REGISTRY_ABI,
      functionName: "deploy",
      args: [fullBytecode],
    });

    const hash = await walletClient.sendTransaction({
      account,
      to: REGISTRY,
      data,
      gasPrice: 0n,
      gas: 5_000_000n,
    });

    phaseLog("DEPLOY", `Tx sent: ${hash}`);
    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    if (receipt.status === "success") {
      // The deployed address is in the return value or logs
      const tokenAddress = receipt.contractAddress ?? receipt.logs?.[0]?.address;
      phaseLog("DEPLOY", `Deployed via registry at: ${tokenAddress}`);
      printSuccess(tokenAddress ?? "check logs");
      return;
    } else {
      phaseLog("DEPLOY", "Strategy 1 reverted, trying direct deployment...");
    }
  } catch (err: any) {
    phaseLog("DEPLOY", `Strategy 1 failed: ${err?.message?.slice(0, 200)}`);
  }

  // Strategy 2: Direct deployment (no registry)
  phaseLog("DEPLOY", "Attempting direct deployment...");
  try {
    const hash = await walletClient.sendTransaction({
      account,
      data: fullBytecode,
      gasPrice: 0n,
      gas: 5_000_000n,
    });

    phaseLog("DEPLOY", `Tx sent: ${hash}`);
    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    if (receipt.status === "success") {
      phaseLog("DEPLOY", `Token deployed at: ${receipt.contractAddress}`);
      printSuccess(receipt.contractAddress ?? "check tx receipt");
      return;
    } else {
      phaseLog("DEPLOY", "Direct deployment also reverted.");
      phaseLog("DEPLOY", "The Privacy Node may require a specific SDK or funded account.");
      phaseLog("DEPLOY", "Contact Rayls hackathon support or use their starter kit to deploy.");
      process.exit(1);
    }
  } catch (err: any) {
    phaseLog("DEPLOY", `Direct deployment failed: ${err?.message?.slice(0, 200)}`);
    process.exit(1);
  }
}

function printSuccess(address: string) {
  console.log(`\n✅ TOKEN_ADDRESS=${address}`);
  console.log(`\nAdd to .env:\nKNOWN_TOKENS=${address}`);
  console.log(`\nRun agent:\nnpm run dev`);
}

main().catch(console.error);
