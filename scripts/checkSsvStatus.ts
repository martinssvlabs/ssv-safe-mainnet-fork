import { network } from "hardhat";
import { Contract, Wallet, formatEther, formatUnits, parseUnits } from "ethers";
import "dotenv/config";

const ERC20_ABI = [
  "function decimals() view returns (uint8)",
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address owner,address spender) view returns (uint256)",
];

const SAFE_ABI = [
  "function getOwners() view returns (address[])",
  "function getThreshold() view returns (uint256)",
];

async function main() {
  const safeAddress = process.env.SAFE_ADDRESS;
  const ssvToken = process.env.SSV_TOKEN;
  const ssvContract = process.env.SSV_CONTRACT;
  const checkPk =
    process.env.SAFE_APPROVER_PK ?? process.env.OWNER1_PK ?? process.env.PRIVATE_KEY;

  if (!safeAddress) throw new Error("Missing SAFE_ADDRESS");
  if (!ssvToken) throw new Error("Missing SSV_TOKEN");
  if (!ssvContract) throw new Error("Missing SSV_CONTRACT");
  if (!checkPk) {
    throw new Error("Missing private key (SAFE_APPROVER_PK, OWNER1_PK, or PRIVATE_KEY)");
  }

  const { ethers } = await network.connect();
  const provider = ethers.provider;
  const signer = new Wallet(checkPk, provider);
  const signerAddress = await signer.getAddress();
  const networkInfo = await provider.getNetwork();

  const token = new Contract(ssvToken, ERC20_ABI, provider);
  const safe = new Contract(safeAddress, SAFE_ABI, provider);
  const decimals = Number(await token.decimals());

  const [
    safeTokenBalance,
    signerTokenBalance,
    safeEthBalance,
    signerEthBalance,
    allowance,
    owners,
    threshold,
  ] = await Promise.all([
    token.balanceOf(safeAddress),
    token.balanceOf(signerAddress),
    provider.getBalance(safeAddress),
    provider.getBalance(signerAddress),
    token.allowance(safeAddress, ssvContract),
    safe.getOwners(),
    safe.getThreshold(),
  ]);

  const ownerSet = new Set((owners as string[]).map((o) => o.toLowerCase()));
  const isOwner = ownerSet.has(signerAddress.toLowerCase());

  console.log(`Chain ID: ${networkInfo.chainId.toString()}`);
  console.log(`Safe: ${safeAddress}`);
  console.log(`Signer from env PK: ${signerAddress}`);
  console.log(`Signer is Safe owner: ${isOwner}`);
  console.log(`Safe threshold: ${threshold.toString()}`);
  console.log("");
  console.log(`Safe ETH balance: ${formatEther(safeEthBalance)} ETH`);
  console.log(`Signer ETH balance: ${formatEther(signerEthBalance)} ETH`);
  console.log(`Safe SSV balance: ${formatUnits(safeTokenBalance, decimals)} SSV`);
  console.log(`Signer SSV balance: ${formatUnits(signerTokenBalance, decimals)} SSV`);
  console.log(
    `Safe -> SSV_CONTRACT allowance: ${formatUnits(allowance, decimals)} SSV`
  );

  if (process.env.SSV_ALLOWANCE_AMOUNT) {
    const targetAllowance = parseUnits(process.env.SSV_ALLOWANCE_AMOUNT, decimals);
    const ok = allowance >= targetAllowance;
    console.log(
      `Target allowance (SSV_ALLOWANCE_AMOUNT): ${process.env.SSV_ALLOWANCE_AMOUNT} SSV`
    );
    console.log(`Allowance check: ${ok ? "OK" : "LOW"}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
