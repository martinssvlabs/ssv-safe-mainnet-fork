import { defineConfig } from "hardhat/config";
import hardhatEthers from "@nomicfoundation/hardhat-ethers";
import "dotenv/config";

export default defineConfig({
  plugins: [hardhatEthers],
  solidity: { version: "0.8.28" },
  networks: {
    // This config defines how the simulated fork runs
    mainnetFork: {
      type: "edr-simulated",
      chainId: 1, // make the local fork identify as Ethereum mainnet
      forking: {
        url: process.env.MAINNET_RPC_URL as string,
        // optional but recommended for reproducibility
        // blockNumber: 20_000_000,
      },
    },

    // This config is used to CONNECT over HTTP to a running node
    localhostFork: {
      type: "http",
      chainId: 1,
      url: "http://127.0.0.1:8545",
    },
  },
});
