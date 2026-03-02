import { network } from "hardhat";
import { EthersAdapter, SafeFactory } from "@safe-global/protocol-kit";

const { ethers } = await network.connect();

async function main() {
  const [deployer] = await ethers.getSigners();

  // 1. Initialize Ethers Adapter
  const ethAdapter = new EthersAdapter({
    // Hardhat's ESM ethers types and protocol-kit CJS types are runtime-compatible.
    ethers: ethers as any,
    signerOrProvider: deployer as any,
  });

  // 2. Initialize Safe Factory
  const safeFactory = await SafeFactory.create({ ethAdapter });

  // 3. Define owners from env private keys and threshold
  const ownerPrivateKeys = [process.env.OWNER1_PK, process.env.OWNER2_PK].filter(
    (pk): pk is string => Boolean(pk),
  );
  if (ownerPrivateKeys.length < 2) {
    throw new Error("Set OWNER1_PK and OWNER2_PK in .env");
  }

  const owners = ownerPrivateKeys.map((pk) => new ethers.Wallet(pk).address);
  const threshold = Number(process.env.SAFE_THRESHOLD ?? 2);
  console.log(`Safe's threshold is ${threshold}`)
  if (!Number.isInteger(threshold) || threshold < 1 || threshold > owners.length) {
    throw new Error(`Invalid SAFE_THRESHOLD=${threshold}. Must be 1..${owners.length}`);
  }

  // 4. Deploy Safe
  const safeAccountConfig = {
    owners,
    threshold,
  };
  
  console.log("Deploying Safe...");
  const safeSdk = await safeFactory.deploySafe({ safeAccountConfig });
  const safeAddress = await safeSdk.getAddress();
  
  console.log(`Safe deployed at: ${safeAddress}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
