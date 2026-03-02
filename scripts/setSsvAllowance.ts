import { network } from "hardhat";
import Safe, { EthersAdapter } from "@safe-global/protocol-kit";
import { Contract, Wallet, formatUnits, parseUnits } from "ethers";
import "dotenv/config";

const SafeSdk = ((Safe as any)?.default ?? Safe) as {
  create: (config: { ethAdapter: unknown; safeAddress: string }) => Promise<any>;
};

const ERC20_ABI = [
  "function decimals() view returns (uint8)",
  "function allowance(address owner,address spender) view returns (uint256)",
  "function approve(address spender,uint256 amount) returns (bool)",
];

async function main() {
  const safeAddress = process.env.SAFE_ADDRESS;
  const ssvToken = process.env.SSV_TOKEN;
  const ssvContract = process.env.SSV_CONTRACT;
  const allowanceHuman = process.env.SSV_ALLOWANCE_AMOUNT ?? "1000000000";
  const approverPk = process.env.SAFE_APPROVER_PK ?? process.env.OWNER1_PK;

  if (!safeAddress) throw new Error("Missing SAFE_ADDRESS");
  if (!ssvToken) throw new Error("Missing SSV_TOKEN");
  if (!ssvContract) throw new Error("Missing SSV_CONTRACT");
  if (!approverPk) {
    throw new Error("Missing SAFE_APPROVER_PK (or OWNER1_PK fallback)");
  }

  const { ethers } = await network.connect();
  const provider = ethers.provider;
  const approver = new Wallet(approverPk, provider);

  const ethAdapter = new EthersAdapter({
    // Hardhat's ESM ethers types and protocol-kit CJS types are runtime-compatible.
    ethers: ethers as any,
    signerOrProvider: approver as any,
  });

  const safeSdk = await SafeSdk.create({
    ethAdapter,
    safeAddress,
  });

  const approverAddress = await approver.getAddress();
  const isOwner = await safeSdk.isOwner(approverAddress);
  if (!isOwner) {
    throw new Error(`Approver ${approverAddress} is not an owner of Safe ${safeAddress}`);
  }

  const token = new Contract(ssvToken, ERC20_ABI, provider);
  const decimals = Number(await token.decimals());
  const allowanceAmount = parseUnits(allowanceHuman, decimals);

  const currentAllowance = await token.allowance(safeAddress, ssvContract);
  console.log(`Current allowance: ${formatUnits(currentAllowance, decimals)} SSV`);
  console.log(`Target allowance:  ${formatUnits(allowanceAmount, decimals)} SSV`);

  const approveData = token.interface.encodeFunctionData("approve", [
    ssvContract,
    allowanceAmount,
  ]);

  const safeTx = await safeSdk.createTransaction({
    transactions: [
      {
        to: ssvToken,
        value: "0",
        data: approveData,
      },
    ],
  });

  const safeTxHash = await safeSdk.getTransactionHash(safeTx);
  const signedTx = await safeSdk.signTransaction(safeTx);
  await safeSdk.approveTransactionHash(safeTxHash);

  const threshold = await safeSdk.getThreshold();
  const ownersWhoApproved = await safeSdk.getOwnersWhoApprovedTx(safeTxHash);
  console.log(`Safe tx hash:      ${safeTxHash}`);
  console.log(`Approvals:         ${ownersWhoApproved.length}/${threshold}`);

  if (ownersWhoApproved.length < threshold) {
    console.log("Not enough approvals to execute yet.");
    console.log(
      "Re-run this script with another owner key via SAFE_APPROVER_PK to add approvals."
    );
    return;
  }

  console.log("Executing Safe transaction...");
  const executeTxResponse = await safeSdk.executeTransaction(signedTx);
  await executeTxResponse.transactionResponse?.wait();

  const updatedAllowance = await token.allowance(safeAddress, ssvContract);
  console.log(`Execution tx hash: ${executeTxResponse.hash}`);
  console.log(`Updated allowance: ${formatUnits(updatedAllowance, decimals)} SSV`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
