// scripts/fund-safe-ssv.ts
import {
  JsonRpcProvider,
  JsonRpcSigner,
  Contract,
  parseUnits,
  formatUnits,
} from "ethers";
import * as dotenv from "dotenv";

dotenv.config();

const SSV_NETWORK_ABI = [
  "function token() view returns (address)",
];

const ERC20_ABI = [
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
  "function transfer(address,uint256) returns (bool)",
];

async function main() {
  const rpc = process.env.RPC_ENDPOINT || "http://127.0.0.1:8545";
  const safe = process.env.SAFE_ADDRESS;
  const ssvNetwork = process.env.SSV_CONTRACT;
  const ssvTokenFromEnv = process.env.SSV_TOKEN;
  const whale = process.env.SSV_WHALE;
  const amountHuman = process.env.SSV_FUND_AMOUNT || "1000000";

  if (!safe) throw new Error("Missing SAFE_ADDRESS");
  if (!ssvNetwork) throw new Error("Missing SSV_CONTRACT");
  if (!whale) throw new Error("Missing SSV_WHALE");

  const provider = new JsonRpcProvider(rpc);

  // Hardhat JSON-RPC methods
  await provider.send("hardhat_impersonateAccount", [whale]);
  await provider.send("hardhat_setBalance", [whale, "0x56BC75E2D63100000"]); // 100 ETH

  let tokenAddress: string;
  if (ssvTokenFromEnv) {
    tokenAddress = ssvTokenFromEnv;
  } else {
    const networkContract = new Contract(ssvNetwork, SSV_NETWORK_ABI, provider);
    try {
      tokenAddress = (await networkContract.token()) as string;
    } catch (error) {
      throw new Error(
        "Failed to read token() from SSV_CONTRACT. Set SSV_TOKEN explicitly in .env for this network/contract version."
      );
    }
  }

  const token = new Contract(tokenAddress, ERC20_ABI, provider);
  const decimals = Number(await token.decimals());

  const signer = new JsonRpcSigner(provider, whale);
  const tokenWithSigner = new Contract(tokenAddress, ERC20_ABI, signer);
  const amount = parseUnits(amountHuman, decimals);

  const whaleBal = await token.balanceOf(whale);
  if (whaleBal < amount) {
    throw new Error(
      `Whale balance too low. Has ${formatUnits(whaleBal, decimals)}, needs ${amountHuman}`
    );
  }

  const tx = await tokenWithSigner.transfer(safe, amount);
  await tx.wait();

  const safeBal = await token.balanceOf(safe);
  console.log("Token:", tokenAddress);
  console.log("Transferred:", amountHuman);
  console.log("Safe balance:", formatUnits(safeBal, decimals));

  await provider.send("hardhat_stopImpersonatingAccount", [whale]);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
