# ssv-mainnet-fork

Local toolkit for running an Ethereum mainnet fork, deploying a Safe, funding it with SSV, setting Safe-based token allowance, and checking run readiness before executing registration flows in other repos.

This repo is designed for practical local testing workflows where a non-payable contract consumes ERC20 tokens via allowance.

## What This Repo Does

- Forks Ethereum mainnet with Hardhat 3.
- Deploys a Safe multisig to the fork.
- Funds the Safe with SSV using whale impersonation on local fork nodes.
- Sets `SSV_TOKEN` allowance from the Safe to `SSV_CONTRACT` through a Safe transaction.
- Prints a full readiness/status report (balances, owner check, allowance check).

## Requirements

- Node.js 22+
- npm 10+
- Mainnet RPC URL (Alchemy/Infura/etc.) for forking

## Install

```bash
npm install
cp .env.example .env
```

## Start Local Mainnet Fork

Run this in a dedicated terminal and keep it running:

```bash
set -a; source .env; set +a
npx hardhat node --fork "$MAINNET_RPC_URL" --chain-id 1 --port 8545
```

All scripts that target `localhostFork` or `RPC_ENDPOINT=http://127.0.0.1:8545` assume this node is running.

## Key Files

| File | Purpose |
| --- | --- |
| `hardhat.config.ts` | Hardhat networks and plugin config (`mainnetFork`, `localhostFork`). |
| `scripts/deploySafe.ts` | Deploys a Safe using owners derived from private keys in `.env`. |
| `scripts/fundSafeSsv.ts` | Funds `SAFE_ADDRESS` with SSV by impersonating `SSV_WHALE` on a local fork node. |
| `scripts/setSsvAllowance.ts` | Creates and executes Safe tx: `SSV_TOKEN.approve(SSV_CONTRACT, amount)`. |
| `scripts/checkSsvStatus.ts` | Prints chain, Safe/signer balances, ownership, threshold, and allowance health. |
| `.env.example` | Complete environment template for all scripts. |
| `tsconfig.json` | TypeScript compiler settings. |
| `package.json` | Dependencies and project metadata. |

## Networks

- `mainnetFork`: in-memory fork created by Hardhat for each run.
- `localhostFork`: connects to an already running node at `http://127.0.0.1:8545`.

If you need persistent local state across multiple commands, run your own local fork node and use `localhostFork`.

## Environment Variables

| Variable | Required | Used By | Description |
| --- | --- | --- | --- |
| `MAINNET_RPC_URL` | Yes | `hardhat.config.ts` | Upstream Ethereum mainnet RPC URL for forking. |
| `OWNER1_PK` | Yes | `deploySafe.ts`, fallback in others | Safe owner private key. |
| `OWNER2_PK` | Yes | `deploySafe.ts` | Second Safe owner private key. |
| `SAFE_THRESHOLD` | No | `deploySafe.ts` | Safe threshold, defaults to `2`. |
| `RPC_ENDPOINT` | Recommended | `fundSafeSsv.ts` | JSON-RPC endpoint for local fork interactions, defaults to `http://127.0.0.1:8545`. |
| `SAFE_ADDRESS` | Yes (except deploy) | Funding/allowance/status scripts | Safe address deployed on the target fork node. |
| `SSV_CONTRACT` | Yes | Funding/allowance/status scripts | Contract that will consume SSV allowance. |
| `SSV_TOKEN` | Strongly recommended | Funding/allowance/status scripts | SSV ERC20 token contract. |
| `SSV_WHALE` | Yes for funding | `fundSafeSsv.ts` | Address to impersonate for transferring SSV in local fork mode. |
| `SSV_FUND_AMOUNT` | No | `fundSafeSsv.ts` | Human-readable SSV amount to transfer to Safe. |
| `SAFE_APPROVER_PK` | Recommended | `setSsvAllowance.ts`, `checkSsvStatus.ts` | Safe owner key used for signing/approving Safe txs. |
| `SSV_ALLOWANCE_AMOUNT` | No | `setSsvAllowance.ts`, `checkSsvStatus.ts` | Human-readable target SSV allowance, defaults to `1000000000`. |

## Script Reference

### 1) Deploy Safe

```bash
npx hardhat run --network mainnetFork scripts/deploySafe.ts
```

or against persistent local node:

```bash
npx hardhat run --network localhostFork scripts/deploySafe.ts
```

Behavior:
- Derives owner addresses from `OWNER1_PK` and `OWNER2_PK`.
- Validates threshold.
- Deploys and prints Safe address.

### 2) Fund Safe With SSV

```bash
node scripts/fundSafeSsv.ts
```

Behavior:
- Impersonates `SSV_WHALE` on local fork.
- Resolves token from `SSV_TOKEN` (preferred) or `SSV_CONTRACT.token()`.
- Transfers `SSV_FUND_AMOUNT` SSV to `SAFE_ADDRESS`.

### 3) Set Safe Allowance For SSV Contract

```bash
npx hardhat run --network localhostFork scripts/setSsvAllowance.ts
```

Behavior:
- Creates Safe tx that calls `approve(SSV_CONTRACT, SSV_ALLOWANCE_AMOUNT)` on `SSV_TOKEN`.
- Signs and approves with `SAFE_APPROVER_PK` (or `OWNER1_PK` fallback).
- Executes if approvals meet threshold.
- Prints updated allowance.

If Safe threshold is greater than 1, run again with another Safe owner key in `SAFE_APPROVER_PK` until approvals meet threshold.

### 4) Check Runtime Status

```bash
npx hardhat run --network localhostFork scripts/checkSsvStatus.ts
```

Outputs:
- Chain ID
- Safe address
- signer address from env private key
- signer ownership status in Safe
- Safe threshold
- Safe and signer ETH balances
- Safe and signer SSV balances
- current allowance and optional target check (`OK` / `LOW`)

## Recommended Local Workflow

1. Start local fork node.
2. Deploy Safe.
3. Fund Safe with SSV.
4. Set allowance from Safe to `SSV_CONTRACT`.
5. Run status check.
6. Execute your external registration script.

## Validation Commands

```bash
npx tsc --noEmit
npx hardhat compile
```

## Troubleshooting

- `SafeProxy contract is not deployed on the current network`
  - `SAFE_ADDRESS` is not deployed on the RPC node you are using.
  - Verify `RPC_ENDPOINT` and redeploy Safe to that same node if needed.

- `invalid account` during impersonation
  - Use `JsonRpcSigner` path in this repo and ensure endpoint is Hardhat-compatible.

- `Failed to read token() from SSV_CONTRACT`
  - Set `SSV_TOKEN` explicitly in `.env`.

- Allowance still too low
  - Confirm script ran on same node as your target workflow.
  - Re-run allowance script with enough Safe owner approvals.

## Security Notes

- `.env` is ignored by git. Keep real keys only in local env files.
- Use dedicated testing keys for local fork workflows.
- Do not reuse local testing private keys in production.
