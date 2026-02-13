/**
 * ERC-8004 Agent Registration Script
 *
 * Registers the Molteee Fighter agent on the Monad Testnet Identity Registry.
 * Steps:
 *   1. Upload registration.json to IPFS via Pinata
 *   2. Mint agent NFT on Identity Registry (0x8004A818...)
 *   3. Set agent wallet
 *   4. Output agentId for use in RPSGame.setAgentId()
 */

import dotenv from "dotenv";
import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

// Monad Testnet configuration
const CHAIN_CONFIG = {
  chainId: 10143,
  rpcUrl: process.env.RPC_URL || "https://testnet-rpc.monad.xyz",
  identityRegistry: "0x8004A818BFB912233c491871b3d84c89A494BD9e",
  reputationRegistry: "0x8004B663056A597Dffe9eCcC1965A193B7388713",
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  // Validate required env vars
  const privateKey = process.env.PRIVATE_KEY;
  const pinataJwt = process.env.PINATA_JWT;

  if (!privateKey) {
    console.error("ERROR: PRIVATE_KEY not set in .env");
    process.exit(1);
  }
  if (!pinataJwt) {
    console.error("ERROR: PINATA_JWT not set in .env");
    process.exit(1);
  }

  // Connect to Monad Testnet
  const provider = new ethers.JsonRpcProvider(CHAIN_CONFIG.rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);
  console.log(`Wallet address: ${wallet.address}`);

  // Check balance
  const balance = await provider.getBalance(wallet.address);
  console.log(`Balance: ${ethers.formatEther(balance)} MON`);
  if (balance === 0n) {
    console.error("ERROR: Wallet has no MON. Get testnet tokens from https://testnet.monad.xyz/");
    process.exit(1);
  }

  // Load registration metadata
  const registrationPath = path.join(__dirname, "..", "registration.json");
  const registration = JSON.parse(fs.readFileSync(registrationPath, "utf8"));

  // NOTE: Do NOT set agentWallet in off-chain metadata (deprecated per ERC-8004 spec).
  // Agent wallet is set on-chain via setAgentWallet() after registration.

  console.log("\n--- Registration Metadata ---");
  console.log(`Name: ${registration.name}`);
  console.log(`Description: ${registration.description}`);
  console.log(`Trust Models: ${registration.supportedTrust.join(", ")}`);

  // Upload to IPFS via Pinata
  console.log("\nUploading registration.json to IPFS...");
  const pinataRes = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${pinataJwt}`,
    },
    body: JSON.stringify({
      pinataContent: registration,
      pinataMetadata: { name: "molteee-fighter-registration" },
    }),
  });

  if (!pinataRes.ok) {
    console.error("Pinata upload failed:", await pinataRes.text());
    process.exit(1);
  }

  const pinataData = (await pinataRes.json()) as { IpfsHash: string };
  const ipfsHash = pinataData.IpfsHash;
  const agentURI = `ipfs://${ipfsHash}`;
  console.log(`Uploaded to IPFS: ${agentURI}`);
  console.log(`View at: https://gateway.pinata.cloud/ipfs/${ipfsHash}`);

  // Register on Identity Registry
  console.log("\nRegistering on ERC-8004 Identity Registry...");

  // Minimal Identity Registry ABI for registration
  const identityABI = [
    "function register(string calldata agentURI) external returns (uint256)",
    "function setAgentWallet(uint256 agentId, address wallet) external",
    "function balanceOf(address owner) external view returns (uint256)",
  ];

  const identityRegistry = new ethers.Contract(
    CHAIN_CONFIG.identityRegistry,
    identityABI,
    wallet
  );

  // Mint agent NFT
  const tx = await identityRegistry.register(agentURI);
  console.log(`Registration tx: ${tx.hash}`);
  const receipt = await tx.wait();
  console.log(`Confirmed in block: ${receipt.blockNumber}`);

  // Extract agentId from Transfer event (ERC-721 mint)
  // Transfer(address(0), to, tokenId)
  const transferTopic = ethers.id("Transfer(address,address,uint256)");
  const transferLog = receipt.logs.find(
    (log: ethers.Log) => log.topics[0] === transferTopic
  );

  let agentId: string;
  if (transferLog && transferLog.topics.length >= 4) {
    agentId = BigInt(transferLog.topics[3]).toString();
  } else {
    // Fallback: check balance
    const balance = await identityRegistry.balanceOf(wallet.address);
    agentId = balance.toString();
  }

  // Set agent wallet on-chain (the correct way per ERC-8004 spec)
  console.log(`\nSetting agent wallet on-chain...`);
  const setWalletTx = await identityRegistry.setAgentWallet(agentId, wallet.address);
  console.log(`setAgentWallet tx: ${setWalletTx.hash}`);
  await setWalletTx.wait();
  console.log(`Agent wallet set on-chain.`);

  console.log(`\nAgent registered successfully!`);
  console.log(`Agent ID: ${agentId}`);
  console.log(`View on 8004scan: https://testnet.8004scan.io/agents/monad-testnet/${agentId}`);
  console.log(
    `\nIMPORTANT: Use this agentId in RPSGame.setAgentId(${wallet.address}, ${agentId})`
  );
}

main().catch((err) => {
  console.error("Registration failed:", err);
  process.exit(1);
});
