// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Script.sol";
import "../src/AgentRegistry.sol";
import "../src/Escrow.sol";
import "../src/PokerGame.sol";
import "../src/AuctionGame.sol";

/// @title DeployNewGames — Deploy PokerGame + AuctionGame to Monad testnet
/// @notice Uses existing AgentRegistry + Escrow deployments. Only deploys new game contracts.
///
/// Usage:
///   forge script script/DeployNewGames.s.sol:DeployNewGames \
///     --rpc-url monad_testnet --broadcast --verify
///
/// Requires .env:
///   DEPLOYER_PRIVATE_KEY, AGENT_REGISTRY_ADDRESS, ESCROW_ADDRESS
contract DeployNewGames is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");

        // Existing deployed contract addresses
        address registryAddr = vm.envAddress("AGENT_REGISTRY_ADDRESS");
        address escrowAddr = vm.envAddress("ESCROW_ADDRESS");

        // ERC-8004 Reputation Registry singleton on Monad Testnet
        address reputationRegistry = 0x8004B663056A597Dffe9eCcC1965A193B7388713;

        vm.startBroadcast(deployerKey);

        AgentRegistry registry = AgentRegistry(registryAddr);
        Escrow escrow = Escrow(escrowAddr);

        // 1. Deploy PokerGame
        PokerGame pokerGame = new PokerGame(escrowAddr, registryAddr, reputationRegistry);
        console.log("PokerGame deployed at:", address(pokerGame));

        // 2. Deploy AuctionGame
        AuctionGame auctionGame = new AuctionGame(escrowAddr, registryAddr, reputationRegistry);
        console.log("AuctionGame deployed at:", address(auctionGame));

        // 3. Authorize both new game contracts in Escrow
        escrow.authorizeContract(address(pokerGame), true);
        console.log("Escrow authorized PokerGame");

        escrow.authorizeContract(address(auctionGame), true);
        console.log("Escrow authorized AuctionGame");

        // 4. Authorize both in AgentRegistry
        registry.authorizeContract(address(pokerGame), true);
        console.log("Registry authorized PokerGame");

        registry.authorizeContract(address(auctionGame), true);
        console.log("Registry authorized AuctionGame");

        vm.stopBroadcast();

        // Summary
        console.log("");
        console.log("=== New Games Deployment Summary ===");
        console.log("Existing AgentRegistry:  ", registryAddr);
        console.log("Existing Escrow:         ", escrowAddr);
        console.log("PokerGame:               ", address(pokerGame));
        console.log("AuctionGame:             ", address(auctionGame));
        console.log("ReputationRegistry:      ", reputationRegistry);
        console.log("====================================");
        console.log("");
        console.log("Add to .env:");
        console.log("POKER_GAME_ADDRESS=", address(pokerGame));
        console.log("AUCTION_GAME_ADDRESS=", address(auctionGame));
    }
}
