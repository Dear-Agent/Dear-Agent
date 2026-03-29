import "dotenv/config";
import { readFileSync } from "fs";
import { encodeAbiParameters, parseAbiParameters } from "viem";
import { envSchema } from "./types/index.js";
import { initPrivacyNode } from "./chain/privacy.js";
import { phaseLog } from "./logger/index.js";

async function main() {
  const env = envSchema.parse(process.env);
  const { publicClient, walletClient, account } = initPrivacyNode(env);

  phaseLog("DEPLOY", `Deployer address: ${account.address}`);

  const balance = await publicClient.getBalance({ address: account.address });
  phaseLog("DEPLOY", `Deployer balance: ${balance}`);

  // Load Forge-compiled bytecode
  const artifact = JSON.parse(
    readFileSync("contracts/out/HackathonToken.sol/HackathonToken.json", "utf8"),
  );
  const bytecode = artifact.bytecode.object as `0x${string}`;

  // Encode constructor args
  const constructorArgs = encodeAbiParameters(
    parseAbiParameters("string, string, uint256"),
    ["HackathonToken", "HKT", 1_000_000n * 10n ** 18n],
  );

  const deployData = (bytecode + constructorArgs.slice(2)) as `0x${string}`;

  phaseLog("DEPLOY", "Deploying HackathonToken on Privacy Node...");

  const hash = await walletClient.sendTransaction({
    account,
    data: deployData,
    gasPrice: 0n,
    gas: 5_000_000n,
  });

  phaseLog("DEPLOY", `Deploy tx: ${hash}`);

  const receipt = await publicClient.waitForTransactionReceipt({ hash });

  if (receipt.status === "success") {
    phaseLog("DEPLOY", `Token deployed successfully at: ${receipt.contractAddress}`, {
      block: receipt.blockNumber.toString(),
    });
  } else {
    phaseLog("DEPLOY", `Deploy REVERTED at: ${receipt.contractAddress}`, {
      status: receipt.status,
    });
  }

  console.log(`\nTOKEN_ADDRESS=${receipt.contractAddress}`);
  console.log(`\nRun agent with:\nKNOWN_TOKENS=${receipt.contractAddress} npx tsx src/index.ts`);
}

main().catch(console.error);
