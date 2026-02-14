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

/// @title DeployV5 — Full stack redeployment with centralized ERC-8004 identity in AgentRegistry
/// @notice Redeploys ALL contracts including AgentRegistry (now has identity integration).
///         Game contracts no longer store agentIds locally — they read from AgentRegistry.
///         Auto-registers agents with ERC-8004 Identity Registry on register().
///
/// Key changes from V4:
///   - AgentRegistry redeployed (adds identityRegistry, centralized agentIds)
///   - Game contracts (RPS, Poker, Auction) no longer have setAgentId/agentIds
///   - Configures identityRegistry on AgentRegistry for auto-registration
///
/// Usage:
///   cd contracts
///   source ../.env
///   forge script script/DeployV5.s.sol:DeployV5 \
///     --rpc-url monad_mainnet --broadcast
///
/// Requires in .env:
///   DEPLOYER_PRIVATE_KEY
///
/// Optional in .env:
///   MARKET_SEED (default 0.01 ether), TREASURY_FUND (default 1 ether)
contract DeployV5 is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");

        // ERC-8004 registries on Monad Mainnet (singletons — loaded from .env)
        address identityRegistry = vm.envAddress("ERC8004_IDENTITY_REGISTRY");
        address reputationRegistry = vm.envAddress("ERC8004_REPUTATION_REGISTRY");

        // Configurable seed/treasury amounts (with defaults)
        uint256 seedAmount = vm.envOr("MARKET_SEED", uint256(0.01 ether));
        uint256 treasuryFund = vm.envOr("TREASURY_FUND", uint256(0.1 ether));

        vm.startBroadcast(deployerKey);

        // 1. Deploy NEW AgentRegistry (with ERC-8004 identity integration)
        AgentRegistry registry = new AgentRegistry();
        console.log("AgentRegistry v5 deployed at:", address(registry));

        // 2. Configure ERC-8004 Identity Registry for auto-registration
        registry.setIdentityRegistry(identityRegistry);
        console.log("IdentityRegistry set:", identityRegistry);

        // 3. Deploy new Escrow (with treasury + auto-market)
        Escrow escrow = new Escrow();
        console.log("Escrow v5 deployed at:", address(escrow));

        // 4. Deploy game contracts pointing to new Escrow + Registry
        RPSGame rpsGame = new RPSGame(address(escrow), address(registry), reputationRegistry);
        console.log("RPSGame deployed at:", address(rpsGame));

        PokerGame pokerGame = new PokerGame(address(escrow), address(registry), reputationRegistry);
        console.log("PokerGame deployed at:", address(pokerGame));

        AuctionGame auctionGame = new AuctionGame(address(escrow), address(registry), reputationRegistry);
        console.log("AuctionGame deployed at:", address(auctionGame));

        // 5. Deploy Tournament (v1)
        Tournament tournament = new Tournament(
            address(escrow),
            address(registry),
            address(rpsGame),
            address(pokerGame),
            address(auctionGame)
        );
        console.log("Tournament deployed at:", address(tournament));

        // 6. Deploy PredictionMarket
        PredictionMarket predictionMarket = new PredictionMarket(address(escrow));
        console.log("PredictionMarket deployed at:", address(predictionMarket));

        // 7. Deploy TournamentV2 (round-robin + double-elim)
        TournamentV2 tournamentV2 = new TournamentV2(
            address(escrow),
            address(registry),
            address(rpsGame),
            address(pokerGame),
            address(auctionGame)
        );
        console.log("TournamentV2 deployed at:", address(tournamentV2));

        // 8. Authorize game contracts in Escrow
        escrow.authorizeContract(address(rpsGame), true);
        escrow.authorizeContract(address(pokerGame), true);
        escrow.authorizeContract(address(auctionGame), true);
        console.log("Escrow authorized all game contracts");

        // 9. Authorize game contracts in AgentRegistry
        registry.authorizeContract(address(rpsGame), true);
        registry.authorizeContract(address(pokerGame), true);
        registry.authorizeContract(address(auctionGame), true);
        console.log("Registry authorized all game contracts");

        // 10. Configure auto-market creation
        escrow.setPredictionMarket(address(predictionMarket));
        escrow.setMarketSeed(seedAmount);
        console.log("Auto-market configured: seed =", seedAmount);

        // 11. Fund treasury for auto-market seed liquidity
        escrow.fundTreasury{value: treasuryFund}();
        console.log("Treasury funded with:", treasuryFund);

        vm.stopBroadcast();

        // ─── Summary ────────────────────────────────────────────────────
        console.log("");
        console.log("========== V5 Deployment Summary ==========");
        console.log("ERC-8004 IdentityReg:     ", identityRegistry);
        console.log("ERC-8004 ReputationReg:   ", reputationRegistry);
        console.log("---");
        console.log("NEW AgentRegistry v5:     ", address(registry));
        console.log("NEW Escrow v5:            ", address(escrow));
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
        console.log("AGENT_REGISTRY_ADDRESS=", address(registry));
        console.log("ESCROW_ADDRESS=", address(escrow));
        console.log("RPS_GAME_ADDRESS=", address(rpsGame));
        console.log("POKER_GAME_ADDRESS=", address(pokerGame));
        console.log("AUCTION_GAME_ADDRESS=", address(auctionGame));
        console.log("TOURNAMENT_ADDRESS=", address(tournament));
        console.log("PREDICTION_MARKET_ADDRESS=", address(predictionMarket));
        console.log("TOURNAMENT_V2_ADDRESS=", address(tournamentV2));
    }
}
