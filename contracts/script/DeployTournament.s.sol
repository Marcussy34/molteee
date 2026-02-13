// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Script.sol";
import "../src/Tournament.sol";

/// @title DeployTournament — Deploy Tournament contract to Monad testnet
/// @notice Uses existing contract deployments. Tournament only reads Escrow state,
///         so it does NOT need authorization in Escrow or Registry.
///
/// Usage:
///   cd contracts && forge script script/DeployTournament.s.sol:DeployTournament \
///     --rpc-url $MONAD_RPC_URL --broadcast
///
/// Requires .env:
///   DEPLOYER_PRIVATE_KEY, ESCROW_ADDRESS, AGENT_REGISTRY_ADDRESS,
///   RPS_GAME_ADDRESS, POKER_GAME_ADDRESS, AUCTION_GAME_ADDRESS
contract DeployTournament is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");

        // Existing deployed contract addresses
        address escrowAddr = vm.envAddress("ESCROW_ADDRESS");
        address registryAddr = vm.envAddress("AGENT_REGISTRY_ADDRESS");
        address rpsAddr = vm.envAddress("RPS_GAME_ADDRESS");
        address pokerAddr = vm.envAddress("POKER_GAME_ADDRESS");
        address auctionAddr = vm.envAddress("AUCTION_GAME_ADDRESS");

        vm.startBroadcast(deployerKey);

        // Deploy Tournament — no authorization needed (read-only escrow access)
        Tournament tourney = new Tournament(
            escrowAddr,
            registryAddr,
            rpsAddr,
            pokerAddr,
            auctionAddr
        );
        console.log("Tournament deployed at:", address(tourney));

        vm.stopBroadcast();

        // Summary
        console.log("");
        console.log("=== Tournament Deployment Summary ===");
        console.log("Existing Escrow:         ", escrowAddr);
        console.log("Existing Registry:       ", registryAddr);
        console.log("Existing RPSGame:        ", rpsAddr);
        console.log("Existing PokerGame:      ", pokerAddr);
        console.log("Existing AuctionGame:    ", auctionAddr);
        console.log("Tournament:              ", address(tourney));
        console.log("=====================================");
        console.log("");
        console.log("Add to .env:");
        console.log("TOURNAMENT_ADDRESS=", address(tourney));
    }
}
