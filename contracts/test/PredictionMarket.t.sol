// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import "../src/AgentRegistry.sol";
import "../src/Escrow.sol";
import "../src/RPSGame.sol";
import "../src/PredictionMarket.sol";

contract PredictionMarketTest is Test {
    AgentRegistry public registry;
    Escrow public escrow;
    RPSGame public rps;
    PredictionMarket public pm;

    address public owner = address(this);
    address public player1;
    address public player2;
    address public bettor1;
    address public bettor2;

    // Salts for RPS commit-reveal
    bytes32 public salt1 = keccak256("salt1");
    bytes32 public salt2 = keccak256("salt2");

    function setUp() public {
        player1 = makeAddr("player1");
        player2 = makeAddr("player2");
        bettor1 = makeAddr("bettor1");
        bettor2 = makeAddr("bettor2");

        // Deploy contracts
        registry = new AgentRegistry();
        escrow = new Escrow();
        rps = new RPSGame(address(escrow), address(registry), address(0));
        pm = new PredictionMarket(address(escrow));

        // Authorize RPS in Escrow + Registry
        escrow.authorizeContract(address(rps), true);
        registry.authorizeContract(address(rps), true);

        // Fund everyone
        vm.deal(player1, 100 ether);
        vm.deal(player2, 100 ether);
        vm.deal(bettor1, 100 ether);
        vm.deal(bettor2, 100 ether);

        // Register players as agents
        AgentRegistry.GameType[] memory gameTypes = new AgentRegistry.GameType[](1);
        gameTypes[0] = AgentRegistry.GameType.RPS;
        vm.prank(player1);
        registry.register(gameTypes, 0.001 ether, 10 ether);
        vm.prank(player2);
        registry.register(gameTypes, 0.001 ether, 10 ether);
    }

    // ─── Helpers ─────────────────────────────────────────────────────────

    /// @dev Create an active escrow match between player1 and player2 (no auto-market)
    function _createActiveMatch(uint256 wager) internal returns (uint256 matchId) {
        vm.prank(player1);
        matchId = escrow.createMatch{value: wager}(player2, address(rps));
        vm.prank(player2);
        escrow.acceptMatch{value: wager}(matchId);
    }

    /// @dev Create an active escrow match WITH auto-market enabled
    function _createActiveMatchWithAutoMarket(uint256 wager) internal returns (uint256 matchId) {
        // Configure auto-market on escrow
        escrow.setPredictionMarket(address(pm));
        escrow.setMarketSeed(0.1 ether);
        escrow.fundTreasury{value: 10 ether}();

        vm.prank(player1);
        matchId = escrow.createMatch{value: wager}(player2, address(rps));
        vm.prank(player2);
        escrow.acceptMatch{value: wager}(matchId);
    }

    /// @dev Play a full RPS game where player1 wins (Rock vs Scissors)
    function _playRPSPlayer1Wins(uint256 escrowMatchId) internal {
        vm.prank(player1);
        uint256 gameId = rps.createGame(escrowMatchId, 1);

        vm.prank(player1);
        rps.commit(gameId, keccak256(abi.encodePacked(uint8(1), salt1))); // Rock
        vm.prank(player2);
        rps.commit(gameId, keccak256(abi.encodePacked(uint8(3), salt2))); // Scissors

        vm.prank(player1);
        rps.reveal(gameId, RPSGame.Move.Rock, salt1);
        vm.prank(player2);
        rps.reveal(gameId, RPSGame.Move.Scissors, salt2);
    }

    /// @dev Play a full RPS game where player2 wins (Scissors vs Rock)
    function _playRPSPlayer2Wins(uint256 escrowMatchId) internal {
        vm.prank(player1);
        uint256 gameId = rps.createGame(escrowMatchId, 1);

        vm.prank(player1);
        rps.commit(gameId, keccak256(abi.encodePacked(uint8(3), salt1))); // Scissors
        vm.prank(player2);
        rps.commit(gameId, keccak256(abi.encodePacked(uint8(1), salt2))); // Rock

        vm.prank(player1);
        rps.reveal(gameId, RPSGame.Move.Scissors, salt1);
        vm.prank(player2);
        rps.reveal(gameId, RPSGame.Move.Rock, salt2);
    }

    // ─── Market Creation Tests ───────────────────────────────────────────

    function test_createMarket() public {
        uint256 matchId = _createActiveMatch(0.01 ether);

        uint256 marketId = pm.createMarket{value: 1 ether}(matchId);

        PredictionMarket.Market memory m = pm.getMarket(marketId);
        assertEq(m.matchId, matchId);
        assertEq(m.reserveYES, 0.5 ether); // half of seed
        assertEq(m.reserveNO, 0.5 ether);
        assertEq(m.seedLiquidity, 0.5 ether);
        assertEq(m.player1, player1);
        assertEq(m.player2, player2);
        assertFalse(m.resolved);
    }

    function test_createMarket_revertIfNotActive() public {
        // Match is in Created state (not accepted yet)
        vm.prank(player1);
        uint256 matchId = escrow.createMatch{value: 0.01 ether}(player2, address(rps));

        vm.expectRevert("PM: match not Active");
        pm.createMarket{value: 1 ether}(matchId);
    }

    function test_createMarket_revertIfDuplicate() public {
        uint256 matchId = _createActiveMatch(0.01 ether);
        pm.createMarket{value: 1 ether}(matchId);

        vm.expectRevert("PM: market already exists for match");
        pm.createMarket{value: 1 ether}(matchId);
    }

    // ─── Buy/Sell Tests ──────────────────────────────────────────────────

    function test_buyYES_movesPrice() public {
        uint256 matchId = _createActiveMatch(0.01 ether);
        uint256 marketId = pm.createMarket{value: 1 ether}(matchId);

        // Before: prices should be 50/50
        (uint256 yesPriceBefore, uint256 noPriceBefore) = pm.getPrice(marketId);
        assertEq(yesPriceBefore, 0.5e18);
        assertEq(noPriceBefore, 0.5e18);

        // Buy YES tokens
        vm.prank(bettor1);
        pm.buyYES{value: 0.1 ether}(marketId);

        // YES price should increase (more NO reserve relative to total)
        (uint256 yesPriceAfter, uint256 noPriceAfter) = pm.getPrice(marketId);
        assertGt(yesPriceAfter, yesPriceBefore);
        assertLt(noPriceAfter, noPriceBefore);

        // Bettor should have YES tokens
        (uint256 yes, uint256 no) = pm.getUserBalances(marketId, bettor1);
        assertGt(yes, 0);
        assertEq(no, 0);
    }

    function test_buyNO_movesPrice() public {
        uint256 matchId = _createActiveMatch(0.01 ether);
        uint256 marketId = pm.createMarket{value: 1 ether}(matchId);

        // Buy NO tokens
        vm.prank(bettor2);
        pm.buyNO{value: 0.1 ether}(marketId);

        // NO price should increase
        (uint256 yesPrice, uint256 noPrice) = pm.getPrice(marketId);
        assertLt(yesPrice, 0.5e18);
        assertGt(noPrice, 0.5e18);

        // Bettor should have NO tokens
        (uint256 yes, uint256 no) = pm.getUserBalances(marketId, bettor2);
        assertEq(yes, 0);
        assertGt(no, 0);
    }

    function test_constantProduct_preserved() public {
        uint256 matchId = _createActiveMatch(0.01 ether);
        uint256 marketId = pm.createMarket{value: 1 ether}(matchId);

        PredictionMarket.Market memory m = pm.getMarket(marketId);
        uint256 kBefore = m.reserveYES * m.reserveNO;

        // Buy YES
        vm.prank(bettor1);
        pm.buyYES{value: 0.1 ether}(marketId);

        m = pm.getMarket(marketId);
        uint256 kAfter = m.reserveYES * m.reserveNO;

        // k stays approximately the same (integer division can cause slight decrease)
        // Difference should be negligible relative to k
        uint256 diff = kBefore > kAfter ? kBefore - kAfter : kAfter - kBefore;
        assertLt(diff, kBefore / 100); // within 1%
    }

    function test_sellYES() public {
        uint256 matchId = _createActiveMatch(0.01 ether);
        uint256 marketId = pm.createMarket{value: 1 ether}(matchId);

        // Buy YES tokens first
        vm.prank(bettor1);
        pm.buyYES{value: 0.1 ether}(marketId);

        (uint256 tokensBefore, ) = pm.getUserBalances(marketId, bettor1);
        uint256 balanceBefore = bettor1.balance;

        // Sell half
        uint256 sellAmount = tokensBefore / 2;
        vm.prank(bettor1);
        pm.sellYES(marketId, sellAmount);

        (uint256 tokensAfter, ) = pm.getUserBalances(marketId, bettor1);
        assertEq(tokensAfter, tokensBefore - sellAmount);
        assertGt(bettor1.balance, balanceBefore); // got MON back
    }

    function test_buy_revertAfterResolved() public {
        uint256 matchId = _createActiveMatch(0.01 ether);
        uint256 marketId = pm.createMarket{value: 1 ether}(matchId);

        // Settle the match (player1 wins)
        _playRPSPlayer1Wins(matchId);

        // Resolve the market
        pm.resolve(marketId);

        // Buying should fail
        vm.prank(bettor1);
        vm.expectRevert("PM: market resolved");
        pm.buyYES{value: 0.1 ether}(marketId);
    }

    // ─── Resolution Tests ────────────────────────────────────────────────

    function test_resolve_player1Wins() public {
        uint256 matchId = _createActiveMatch(0.01 ether);
        uint256 marketId = pm.createMarket{value: 1 ether}(matchId);

        // Player1 wins RPS
        _playRPSPlayer1Wins(matchId);

        // Verify Escrow recorded the winner
        assertEq(escrow.winners(matchId), player1);

        // Resolve market
        pm.resolve(marketId);

        PredictionMarket.Market memory m = pm.getMarket(marketId);
        assertTrue(m.resolved);
        assertEq(m.winner, player1);
    }

    function test_resolve_player2Wins() public {
        uint256 matchId = _createActiveMatch(0.01 ether);
        uint256 marketId = pm.createMarket{value: 1 ether}(matchId);

        // Player2 wins RPS
        _playRPSPlayer2Wins(matchId);

        assertEq(escrow.winners(matchId), player2);

        pm.resolve(marketId);

        PredictionMarket.Market memory m = pm.getMarket(marketId);
        assertTrue(m.resolved);
        assertEq(m.winner, player2);
    }

    function test_resolve_revertIfNotSettled() public {
        uint256 matchId = _createActiveMatch(0.01 ether);
        uint256 marketId = pm.createMarket{value: 1 ether}(matchId);

        // Match still active, no winner
        vm.expectRevert("PM: match not settled or was draw");
        pm.resolve(marketId);
    }

    function test_resolve_revertIfDoubleResolve() public {
        uint256 matchId = _createActiveMatch(0.01 ether);
        uint256 marketId = pm.createMarket{value: 1 ether}(matchId);
        _playRPSPlayer1Wins(matchId);

        pm.resolve(marketId);

        vm.expectRevert("PM: already resolved");
        pm.resolve(marketId);
    }

    // ─── Redemption Tests ────────────────────────────────────────────────

    function test_redeem_winnerGetsPool() public {
        uint256 matchId = _createActiveMatch(0.01 ether);
        uint256 marketId = pm.createMarket{value: 1 ether}(matchId);

        // Bettor1 buys YES, bettor2 buys NO
        vm.prank(bettor1);
        pm.buyYES{value: 0.5 ether}(marketId);
        vm.prank(bettor2);
        pm.buyNO{value: 0.5 ether}(marketId);

        // Player1 wins
        _playRPSPlayer1Wins(matchId);
        pm.resolve(marketId);

        // Bettor1 (YES holder) should be able to redeem
        uint256 balanceBefore = bettor1.balance;
        vm.prank(bettor1);
        pm.redeem(marketId);

        assertGt(bettor1.balance, balanceBefore);

        // Bettor2 (NO holder) should NOT be able to redeem
        vm.prank(bettor2);
        vm.expectRevert("PM: no winning tokens");
        pm.redeem(marketId);
    }

    function test_redeem_revertIfNotResolved() public {
        uint256 matchId = _createActiveMatch(0.01 ether);
        uint256 marketId = pm.createMarket{value: 1 ether}(matchId);

        vm.prank(bettor1);
        pm.buyYES{value: 0.1 ether}(marketId);

        vm.prank(bettor1);
        vm.expectRevert("PM: not resolved");
        pm.redeem(marketId);
    }

    // ─── Full Lifecycle Test ─────────────────────────────────────────────

    function test_fullLifecycle() public {
        // 1. Create match
        uint256 matchId = _createActiveMatch(0.01 ether);

        // 2. Create prediction market
        uint256 marketId = pm.createMarket{value: 2 ether}(matchId);

        // 3. Bettors place bets
        vm.prank(bettor1);
        pm.buyYES{value: 1 ether}(marketId); // betting on player1
        vm.prank(bettor2);
        pm.buyNO{value: 1 ether}(marketId);  // betting on player2

        // 4. Verify prices moved
        (uint256 yesPrice, uint256 noPrice) = pm.getPrice(marketId);
        // Both bought equal amounts, so prices should be roughly equal
        // (slight deviation due to order of buys)
        assertGt(yesPrice, 0);
        assertGt(noPrice, 0);

        // 5. Player1 wins the match
        _playRPSPlayer1Wins(matchId);

        // 6. Resolve market (anyone can call)
        pm.resolve(marketId);

        // 7. Winner redeems
        uint256 bettor1Before = bettor1.balance;
        vm.prank(bettor1);
        pm.redeem(marketId);
        assertGt(bettor1.balance, bettor1Before);

        // 8. Loser cannot redeem
        vm.prank(bettor2);
        vm.expectRevert("PM: no winning tokens");
        pm.redeem(marketId);
    }

    // ─── Auto-Market Tests ────────────────────────────────────────────────

    function test_autoCreatedMarket_bettingWorks() public {
        // Accept match with auto-market — market auto-created by Escrow
        uint256 matchId = _createActiveMatchWithAutoMarket(0.01 ether);

        // Market should exist
        assertTrue(pm.marketExists(matchId));
        uint256 marketId = pm.matchToMarket(matchId);

        // Bettors can buy tokens on the auto-created market
        vm.prank(bettor1);
        pm.buyYES{value: 0.5 ether}(marketId);

        vm.prank(bettor2);
        pm.buyNO{value: 0.5 ether}(marketId);

        // Verify tokens distributed
        (uint256 yes1, ) = pm.getUserBalances(marketId, bettor1);
        (, uint256 no2) = pm.getUserBalances(marketId, bettor2);
        assertGt(yes1, 0);
        assertGt(no2, 0);
    }

    function test_autoCreatedMarket_fullLifecycle() public {
        // 1. Accept match — auto-creates market
        uint256 matchId = _createActiveMatchWithAutoMarket(0.01 ether);
        uint256 marketId = pm.matchToMarket(matchId);

        // 2. Bettors place bets
        vm.prank(bettor1);
        pm.buyYES{value: 1 ether}(marketId);
        vm.prank(bettor2);
        pm.buyNO{value: 1 ether}(marketId);

        // 3. Player1 wins the match (auto-resolves market via Escrow)
        _playRPSPlayer1Wins(matchId);

        // 4. Market should be auto-resolved
        PredictionMarket.Market memory m = pm.getMarket(marketId);
        assertTrue(m.resolved);
        assertEq(m.winner, player1);

        // 5. Winner redeems
        uint256 bettor1Before = bettor1.balance;
        vm.prank(bettor1);
        pm.redeem(marketId);
        assertGt(bettor1.balance, bettor1Before);

        // 6. Loser cannot redeem
        vm.prank(bettor2);
        vm.expectRevert("PM: no winning tokens");
        pm.redeem(marketId);
    }

    function test_autoCreatedMarket_drawLifecycle() public {
        // Accept match with auto-market
        uint256 matchId = _createActiveMatchWithAutoMarket(0.01 ether);
        uint256 marketId = pm.matchToMarket(matchId);

        // Place bets
        vm.prank(bettor1);
        pm.buyYES{value: 0.5 ether}(marketId);
        vm.prank(bettor2);
        pm.buyNO{value: 0.5 ether}(marketId);

        // Settle as draw via game contract (auto-resolves market as draw)
        vm.prank(address(rps));
        escrow.settleDraw(matchId);

        // Market should be auto-resolved as draw
        PredictionMarket.Market memory m = pm.getMarket(marketId);
        assertTrue(m.resolved);
        assertEq(m.winner, address(0));

        // Both bettors should be able to redeem proportionally
        uint256 b1Before = bettor1.balance;
        vm.prank(bettor1);
        pm.redeem(marketId);
        assertGt(bettor1.balance, b1Before);

        uint256 b2Before = bettor2.balance;
        vm.prank(bettor2);
        pm.redeem(marketId);
        assertGt(bettor2.balance, b2Before);
    }
}
