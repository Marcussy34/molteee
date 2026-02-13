// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Script.sol";
import "../src/AgentRegistry.sol";
import "../src/Escrow.sol";
import "../src/RPSGame.sol";
import "../src/PokerGame.sol";
import "../src/AuctionGame.sol";
import "../src/Tournament.sol";
import "../src/PredictionMarket.sol";
import "../src/TournamentV2.sol";

/// @title DeployV3 — Full stack redeployment with Escrow v3 (winners mapping)
/// @notice Deploys new Escrow (with winners mapping), all game contracts, Tournament,
///         PredictionMarket, and TournamentV2 in one script.
///         Keeps existing AgentRegistry and ERC-8004 registries.
///
/// Usage:
///   cd contracts
///   source ../.env
///   forge script script/DeployV3.s.sol:DeployV3 \
///     --rpc-url monad_testnet --broadcast
///
/// Requires in .env:
///   DEPLOYER_PRIVATE_KEY, AGENT_REGISTRY_ADDRESS
contract DeployV3 is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");

        // Existing contracts we KEEP (no Escrow dependency that needs changing)
        address registryAddr = vm.envAddress("AGENT_REGISTRY_ADDRESS");

        // ERC-8004 Reputation Registry singleton on Monad Testnet
        address reputationRegistry = 0x8004B663056A597Dffe9eCcC1965A193B7388713;

        vm.startBroadcast(deployerKey);

        AgentRegistry registry = AgentRegistry(registryAddr);

        // 1. Deploy new Escrow (v3 — with winners mapping)
        Escrow escrow = new Escrow();
        console.log("Escrow v3 deployed at:", address(escrow));

        // 2. Deploy game contracts pointing to new Escrow
        RPSGame rpsGame = new RPSGame(address(escrow), registryAddr, reputationRegistry);
        console.log("RPSGame deployed at:", address(rpsGame));

        PokerGame pokerGame = new PokerGame(address(escrow), registryAddr, reputationRegistry);
        console.log("PokerGame deployed at:", address(pokerGame));

        AuctionGame auctionGame = new AuctionGame(address(escrow), registryAddr, reputationRegistry);
        console.log("AuctionGame deployed at:", address(auctionGame));

        // 3. Deploy Tournament (v1 — same contract, new deployment pointing to new Escrow)
        Tournament tournament = new Tournament(
            address(escrow),
            registryAddr,
            address(rpsGame),
            address(pokerGame),
            address(auctionGame)
        );
        console.log("Tournament deployed at:", address(tournament));

        // 4. Deploy PredictionMarket (reads escrow.winners() for trustless resolution)
        PredictionMarket predictionMarket = new PredictionMarket(address(escrow));
        console.log("PredictionMarket deployed at:", address(predictionMarket));

        // 5. Deploy TournamentV2 (round-robin + double-elim)
        TournamentV2 tournamentV2 = new TournamentV2(
            address(escrow),
            registryAddr,
            address(rpsGame),
            address(pokerGame),
            address(auctionGame)
        );
        console.log("TournamentV2 deployed at:", address(tournamentV2));

        // 6. Authorize game contracts in new Escrow
        escrow.authorizeContract(address(rpsGame), true);
        escrow.authorizeContract(address(pokerGame), true);
        escrow.authorizeContract(address(auctionGame), true);
        console.log("Escrow authorized all game contracts");

        // 7. Authorize game contracts in existing AgentRegistry
        registry.authorizeContract(address(rpsGame), true);
        registry.authorizeContract(address(pokerGame), true);
        registry.authorizeContract(address(auctionGame), true);
        console.log("Registry authorized all game contracts");

        vm.stopBroadcast();

        // ─── Summary ────────────────────────────────────────────────────
        console.log("");
        console.log("========== V3 Deployment Summary ==========");
        console.log("Existing AgentRegistry:   ", registryAddr);
        console.log("Existing ReputationReg:   ", reputationRegistry);
        console.log("---");
        console.log("NEW Escrow v3:            ", address(escrow));
        console.log("NEW RPSGame:              ", address(rpsGame));
        console.log("NEW PokerGame:            ", address(pokerGame));
        console.log("NEW AuctionGame:          ", address(auctionGame));
        console.log("NEW Tournament:           ", address(tournament));
        console.log("NEW PredictionMarket:     ", address(predictionMarket));
        console.log("NEW TournamentV2:         ", address(tournamentV2));
        console.log("============================================");
        console.log("");
        console.log("Update .env with:");
        console.log("ESCROW_ADDRESS=", address(escrow));
        console.log("RPS_GAME_ADDRESS=", address(rpsGame));
        console.log("POKER_GAME_ADDRESS=", address(pokerGame));
        console.log("AUCTION_GAME_ADDRESS=", address(auctionGame));
        console.log("TOURNAMENT_ADDRESS=", address(tournament));
        console.log("PREDICTION_MARKET_ADDRESS=", address(predictionMarket));
        console.log("TOURNAMENT_V2_ADDRESS=", address(tournamentV2));
    }
}
