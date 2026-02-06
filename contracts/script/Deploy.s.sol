// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Script.sol";
import "../src/AgentRegistry.sol";
import "../src/Escrow.sol";
import "../src/RPSGame.sol";

/// @title Deploy — Deploy all arena contracts to Monad testnet
/// @notice Deployment order: AgentRegistry → Escrow → RPSGame → authorize cross-refs
contract Deploy is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        vm.startBroadcast(deployerKey);

        // 1. Deploy AgentRegistry
        AgentRegistry registry = new AgentRegistry();
        console.log("AgentRegistry deployed at:", address(registry));

        // 2. Deploy Escrow
        Escrow escrow = new Escrow();
        console.log("Escrow deployed at:", address(escrow));

        // 3. Deploy RPSGame (depends on Escrow + Registry)
        RPSGame rpsGame = new RPSGame(address(escrow), address(registry));
        console.log("RPSGame deployed at:", address(rpsGame));

        // 4. Authorize cross-contract references
        //    - RPSGame needs to call Escrow.settle / settleDraw
        escrow.authorizeContract(address(rpsGame), true);
        console.log("Escrow authorized RPSGame");

        //    - RPSGame needs to call Registry.updateELO / recordMatch
        registry.authorizeContract(address(rpsGame), true);
        console.log("Registry authorized RPSGame");

        vm.stopBroadcast();

        // Summary
        console.log("");
        console.log("=== Deployment Summary ===");
        console.log("AgentRegistry:", address(registry));
        console.log("Escrow:       ", address(escrow));
        console.log("RPSGame:      ", address(rpsGame));
        console.log("==========================");
    }
}
