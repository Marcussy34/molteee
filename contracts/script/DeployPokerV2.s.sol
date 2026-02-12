// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Script.sol";
import "../src/AgentRegistry.sol";
import "../src/Escrow.sol";
import "../src/PokerGameV2.sol";

/// @title DeployPokerV2 — Deploy Budget Poker to Monad testnet
/// @notice Uses existing Escrow + AgentRegistry. Only deploys PokerGameV2 and authorizes it.
///
/// Usage:
///   cd contracts
///   source ../.env
///   forge script script/DeployPokerV2.s.sol:DeployPokerV2 \
///     --rpc-url monad_testnet --broadcast
///
/// Requires in .env:
///   DEPLOYER_PRIVATE_KEY
///   AGENT_REGISTRY_ADDRESS (or uses hardcoded V5 address)
///   ESCROW_ADDRESS (or uses hardcoded V5 address)
contract DeployPokerV2 is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");

        // V5 deployment addresses (fallback if env vars not set)
        address registryAddr = vm.envOr("AGENT_REGISTRY_ADDRESS", address(0x218b5f1254e77E08f2fF9ee4b4a0EC8a3fe5d101));
        address escrowAddr = vm.envOr("ESCROW_ADDRESS", address(0x3F07E6302459eDb555FDeCDefE2817f0fe5DCa7E));

        // ERC-8004 Reputation Registry singleton on Monad Testnet
        address reputationRegistry = 0x8004B663056A597Dffe9eCcC1965A193B7388713;

        vm.startBroadcast(deployerKey);

        AgentRegistry registry = AgentRegistry(registryAddr);
        Escrow escrow = Escrow(escrowAddr);

        // 1. Deploy PokerGameV2 (Budget Poker)
        PokerGameV2 pokerV2 = new PokerGameV2(escrowAddr, registryAddr, reputationRegistry);
        console.log("PokerGameV2 deployed at:", address(pokerV2));

        // 2. Authorize in Escrow (so it can settle matches)
        escrow.authorizeContract(address(pokerV2), true);
        console.log("Escrow authorized PokerGameV2");

        // 3. Authorize in AgentRegistry (so it can update ELO + record matches)
        registry.authorizeContract(address(pokerV2), true);
        console.log("Registry authorized PokerGameV2");

        vm.stopBroadcast();

        // Summary
        console.log("");
        console.log("=== PokerGameV2 Deployment Summary ===");
        console.log("Existing AgentRegistry: ", registryAddr);
        console.log("Existing Escrow:        ", escrowAddr);
        console.log("ReputationRegistry:     ", reputationRegistry);
        console.log("NEW PokerGameV2:        ", address(pokerV2));
        console.log("======================================");
        console.log("");
        console.log("Update packages/arena-tools/src/config.ts:");
        console.log("  PokerGameV2: \"", address(pokerV2), "\"");
    }
}
