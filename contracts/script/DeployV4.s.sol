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

/// @title DeployV4 — Full stack redeployment with auto-market prediction markets
/// @notice Deploys new Escrow (with treasury + auto-market), all game contracts,
///         Tournament, PredictionMarket, and TournamentV2 in one script.
///         Configures auto-market creation on match acceptance.
///         Keeps existing AgentRegistry and ERC-8004 registries.
///
/// Usage:
///   cd contracts
///   source ../.env
///   forge script script/DeployV4.s.sol:DeployV4 \
///     --rpc-url monad_mainnet --broadcast
///
/// Requires in .env:
///   DEPLOYER_PRIVATE_KEY, AGENT_REGISTRY_ADDRESS
///
/// Optional in .env:
///   MARKET_SEED (default 0.01 ether), TREASURY_FUND (default 1 ether)
contract DeployV4 is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");

        // Existing contracts we KEEP (no Escrow dependency that needs changing)
        address registryAddr = vm.envAddress("AGENT_REGISTRY_ADDRESS");

        // ERC-8004 Reputation Registry singleton on Monad Mainnet
        address reputationRegistry = 0x8004BAa17C55a88189AE136b182e5fdA19dE9b63;

        // Configurable seed/treasury amounts (with defaults)
        uint256 seedAmount = vm.envOr("MARKET_SEED", uint256(0.01 ether));
        uint256 treasuryFund = vm.envOr("TREASURY_FUND", uint256(1 ether));

        vm.startBroadcast(deployerKey);

        AgentRegistry registry = AgentRegistry(registryAddr);

        // 1. Deploy new Escrow (v4 — with treasury + auto-market)
        Escrow escrow = new Escrow();
        console.log("Escrow v4 deployed at:", address(escrow));

        // 2. Deploy game contracts pointing to new Escrow
        RPSGame rpsGame = new RPSGame(address(escrow), registryAddr, reputationRegistry);
        console.log("RPSGame deployed at:", address(rpsGame));

        PokerGame pokerGame = new PokerGame(address(escrow), registryAddr, reputationRegistry);
        console.log("PokerGame deployed at:", address(pokerGame));

        AuctionGame auctionGame = new AuctionGame(address(escrow), registryAddr, reputationRegistry);
        console.log("AuctionGame deployed at:", address(auctionGame));

        // 3. Deploy Tournament (v1)
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

        // 8. Configure auto-market creation
        escrow.setPredictionMarket(address(predictionMarket));
        escrow.setMarketSeed(seedAmount);
        console.log("Auto-market configured: seed =", seedAmount);

        // 9. Fund treasury for auto-market seed liquidity
        escrow.fundTreasury{value: treasuryFund}();
        console.log("Treasury funded with:", treasuryFund);

        vm.stopBroadcast();

        // ─── Summary ────────────────────────────────────────────────────
        console.log("");
        console.log("========== V4 Deployment Summary ==========");
        console.log("Existing AgentRegistry:   ", registryAddr);
        console.log("Existing ReputationReg:   ", reputationRegistry);
        console.log("---");
        console.log("NEW Escrow v4:            ", address(escrow));
        console.log("NEW RPSGame:              ", address(rpsGame));
        console.log("NEW PokerGame:            ", address(pokerGame));
        console.log("NEW AuctionGame:          ", address(auctionGame));
        console.log("NEW Tournament:           ", address(tournament));
        console.log("NEW PredictionMarket:     ", address(predictionMarket));
        console.log("NEW TournamentV2:         ", address(tournamentV2));
        console.log("---");
        console.log("Market Seed:              ", seedAmount);
        console.log("Treasury Funded:          ", treasuryFund);
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
