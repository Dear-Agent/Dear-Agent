import "dotenv/config";
import { readFileSync } from "fs";
import { envSchema } from "./types/index.js";
import { initPrivacyNode } from "./chain/privacy.js";
import { phaseLog } from "./logger/index.js";

async function main() {
  const env = envSchema.parse(process.env);
  const { publicClient, walletClient, account } = initPrivacyNode(env);

  phaseLog("DEPLOY", `Deployer: ${account.address}`);
  phaseLog("DEPLOY", `Privacy Node RPC: ${env.PRIVACY_NODE_RPC_URL}`);

  const balance = await publicClient.getBalance({ address: account.address });
  phaseLog("DEPLOY", `Balance: ${balance} wei`);

  // Deploy Attestation contract
  phaseLog("DEPLOY", "Deploying Attestation...");
  const attestArtifact = JSON.parse(
    readFileSync("contracts/out/Attestation.sol/Attestation.json", "utf8"),
  );
  const attestHash = await walletClient.sendTransaction({
    account,
    data: attestArtifact.bytecode.object as `0x${string}`,
    gasPrice: 0n,
    gas: 3_000_000n,
  });
  phaseLog("DEPLOY", `Attestation tx: ${attestHash}`);
  const attestReceipt = await publicClient.waitForTransactionReceipt({ hash: attestHash });

  if (attestReceipt.status !== "success") {
    phaseLog("DEPLOY", "Attestation deploy REVERTED");
    process.exit(1);
  }
  phaseLog("DEPLOY", `Attestation deployed: ${attestReceipt.contractAddress}`);

  // Deploy Marketplace contract
  phaseLog("DEPLOY", "Deploying Marketplace...");
  const marketArtifact = JSON.parse(
    readFileSync("contracts/out/Marketplace.sol/Marketplace.json", "utf8"),
  );
  const marketHash = await walletClient.sendTransaction({
    account,
    data: marketArtifact.bytecode.object as `0x${string}`,
    gasPrice: 0n,
    gas: 3_000_000n,
  });
  phaseLog("DEPLOY", `Marketplace tx: ${marketHash}`);
  const marketReceipt = await publicClient.waitForTransactionReceipt({ hash: marketHash });

  if (marketReceipt.status !== "success") {
    phaseLog("DEPLOY", "Marketplace deploy REVERTED");
    process.exit(1);
  }
  phaseLog("DEPLOY", `Marketplace deployed: ${marketReceipt.contractAddress}`);

  console.log(`\n# Add to .env:`);
  console.log(`ATTESTATION_ADDRESS=${attestReceipt.contractAddress}`);
  console.log(`MARKETPLACE_ADDRESS=${marketReceipt.contractAddress}`);
  console.log(`\n# Run agent with:`);
  console.log(`KNOWN_TOKENS=0xd0141e899a65c95a556fe2b27e5982a6de7fdd7a npm start`);
}

main().catch(console.error);
