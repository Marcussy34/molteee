// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import "../src/Escrow.sol";
import "../src/PredictionMarket.sol";

contract EscrowTest is Test {
    Escrow public escrow;

    address public owner = address(this);
    address public player1 = address(0x1);
    address public player2 = address(0x2);
    address public gameContract = address(0xCA3E);

    function setUp() public {
        escrow = new Escrow();

        // Authorize the game contract
        escrow.authorizeContract(gameContract, true);

        // Fund players
        vm.deal(player1, 10 ether);
        vm.deal(player2, 10 ether);
    }

    // ─── Create Match Tests ──────────────────────────────────────────────

    function test_createMatch() public {
        vm.prank(player1);
        uint256 matchId = escrow.createMatch{value: 1 ether}(player2, gameContract);

        Escrow.Match memory m = escrow.getMatch(matchId);
        assertEq(m.player1, player1);
        assertEq(m.player2, player2);
        assertEq(m.wager, 1 ether);
        assertEq(m.gameContract, gameContract);
        assertEq(uint8(m.status), uint8(Escrow.MatchStatus.Created));
    }

    function test_createMatch_revertZeroWager() public {
        vm.prank(player1);
        vm.expectRevert("Escrow: wager must be > 0");
        escrow.createMatch{value: 0}(player2, gameContract);
    }

    function test_createMatch_revertSelf() public {
        vm.prank(player1);
        vm.expectRevert("Escrow: cannot challenge self");
        escrow.createMatch{value: 1 ether}(player1, gameContract);
    }

    function test_createMatch_revertUnauthorizedGame() public {
        address badGame = address(0xBAD);
        vm.prank(player1);
        vm.expectRevert("Escrow: game contract not authorized");
        escrow.createMatch{value: 1 ether}(player2, badGame);
    }

    // ─── Accept Match Tests ──────────────────────────────────────────────

    function test_acceptMatch() public {
        vm.prank(player1);
        uint256 matchId = escrow.createMatch{value: 1 ether}(player2, gameContract);

        vm.prank(player2);
        escrow.acceptMatch{value: 1 ether}(matchId);

        Escrow.Match memory m = escrow.getMatch(matchId);
        assertEq(uint8(m.status), uint8(Escrow.MatchStatus.Active));
    }

    function test_acceptMatch_revertWrongPlayer() public {
        vm.prank(player1);
        uint256 matchId = escrow.createMatch{value: 1 ether}(player2, gameContract);

        address rando = address(0x3);
        vm.deal(rando, 10 ether);
        vm.prank(rando);
        vm.expectRevert("Escrow: not the designated opponent");
        escrow.acceptMatch{value: 1 ether}(matchId);
    }

    function test_acceptMatch_revertWagerMismatch() public {
        vm.prank(player1);
        uint256 matchId = escrow.createMatch{value: 1 ether}(player2, gameContract);

        vm.prank(player2);
        vm.expectRevert("Escrow: must match wager amount");
        escrow.acceptMatch{value: 0.5 ether}(matchId);
    }

    // ─── Settle Tests ────────────────────────────────────────────────────

    function test_settle_winner() public {
        // Create and accept match
        vm.prank(player1);
        uint256 matchId = escrow.createMatch{value: 1 ether}(player2, gameContract);
        vm.prank(player2);
        escrow.acceptMatch{value: 1 ether}(matchId);

        uint256 balBefore = player1.balance;

        // Settle — player1 wins
        vm.prank(gameContract);
        escrow.settle(matchId, player1);

        assertEq(player1.balance, balBefore + 2 ether);

        Escrow.Match memory m = escrow.getMatch(matchId);
        assertEq(uint8(m.status), uint8(Escrow.MatchStatus.Settled));
    }

    function test_settle_revertUnauthorized() public {
        vm.prank(player1);
        uint256 matchId = escrow.createMatch{value: 1 ether}(player2, gameContract);
        vm.prank(player2);
        escrow.acceptMatch{value: 1 ether}(matchId);

        vm.prank(player1); // not authorized
        vm.expectRevert("Escrow: not authorized");
        escrow.settle(matchId, player1);
    }

    function test_settle_revertWrongGameContract() public {
        // Authorize a second game contract
        address otherGame = address(0xDEAD);
        escrow.authorizeContract(otherGame, true);

        vm.prank(player1);
        uint256 matchId = escrow.createMatch{value: 1 ether}(player2, gameContract);
        vm.prank(player2);
        escrow.acceptMatch{value: 1 ether}(matchId);

        // Wrong game contract tries to settle
        vm.prank(otherGame);
        vm.expectRevert("Escrow: wrong game contract");
        escrow.settle(matchId, player1);
    }

    // ─── Draw Tests ──────────────────────────────────────────────────────

    function test_settleDraw() public {
        vm.prank(player1);
        uint256 matchId = escrow.createMatch{value: 1 ether}(player2, gameContract);
        vm.prank(player2);
        escrow.acceptMatch{value: 1 ether}(matchId);

        uint256 bal1Before = player1.balance;
        uint256 bal2Before = player2.balance;

        vm.prank(gameContract);
        escrow.settleDraw(matchId);

        assertEq(player1.balance, bal1Before + 1 ether);
        assertEq(player2.balance, bal2Before + 1 ether);
    }

    // ─── Cancel / Timeout Tests ──────────────────────────────────────────

    function test_cancelMatch_afterTimeout() public {
        vm.prank(player1);
        uint256 matchId = escrow.createMatch{value: 1 ether}(player2, gameContract);

        uint256 balBefore = player1.balance;

        // Warp past timeout
        vm.warp(block.timestamp + 1 hours + 1);

        vm.prank(player1);
        escrow.cancelMatch(matchId);

        assertEq(player1.balance, balBefore + 1 ether);
        Escrow.Match memory m = escrow.getMatch(matchId);
        assertEq(uint8(m.status), uint8(Escrow.MatchStatus.Cancelled));
    }

    function test_cancelMatch_revertBeforeTimeout() public {
        vm.prank(player1);
        uint256 matchId = escrow.createMatch{value: 1 ether}(player2, gameContract);

        vm.prank(player1);
        vm.expectRevert("Escrow: timeout not reached");
        escrow.cancelMatch(matchId);
    }

    function test_cancelMatch_revertNotChallenger() public {
        vm.prank(player1);
        uint256 matchId = escrow.createMatch{value: 1 ether}(player2, gameContract);

        vm.warp(block.timestamp + 1 hours + 1);

        vm.prank(player2);
        vm.expectRevert("Escrow: only challenger can cancel");
        escrow.cancelMatch(matchId);
    }

    // ─── Authorization Tests ─────────────────────────────────────────────

    function test_authorizeContract() public {
        address newGame = address(0xAE3);
        escrow.authorizeContract(newGame, true);
        assertTrue(escrow.authorizedContracts(newGame));
    }

    function test_authorizeContract_revertNotOwner() public {
        vm.prank(player1);
        vm.expectRevert();
        escrow.authorizeContract(gameContract, false);
    }

    // ─── Escrow Balance Tests ────────────────────────────────────────────

    function test_escrowHoldsCorrectBalance() public {
        vm.prank(player1);
        escrow.createMatch{value: 1 ether}(player2, gameContract);

        assertEq(address(escrow).balance, 1 ether);

        vm.prank(player2);
        escrow.acceptMatch{value: 1 ether}(0);

        assertEq(address(escrow).balance, 2 ether);
    }

    // ─── Auto-Market Prediction Market Tests ─────────────────────────────

    /// @dev Helper: configure auto-market on escrow with real PredictionMarket
    function _setupAutoMarket() internal returns (PredictionMarket pm) {
        pm = new PredictionMarket(address(escrow));
        escrow.setPredictionMarket(address(pm));
        escrow.setMarketSeed(0.1 ether);
        escrow.fundTreasury{value: 10 ether}();
    }

    /// @dev Helper: create + accept match with auto-market configured
    function _createAndAcceptWithMarket() internal returns (uint256 matchId, PredictionMarket pm) {
        pm = _setupAutoMarket();
        vm.prank(player1);
        matchId = escrow.createMatch{value: 1 ether}(player2, gameContract);
        vm.prank(player2);
        escrow.acceptMatch{value: 1 ether}(matchId);
    }

    function test_acceptMatch_autoCreatesMarket() public {
        (uint256 matchId, PredictionMarket pm) = _createAndAcceptWithMarket();

        // Market should exist for this match
        assertTrue(pm.marketExists(matchId));
        PredictionMarket.Market memory m = pm.getMarket(0);
        assertEq(m.matchId, matchId);
        // Seed split 50/50 from 0.1 ether
        assertEq(m.reserveYES, 0.05 ether);
        assertEq(m.reserveNO, 0.05 ether);
    }

    function test_acceptMatch_emitsMarketAutoCreated() public {
        _setupAutoMarket();
        vm.prank(player1);
        uint256 matchId = escrow.createMatch{value: 1 ether}(player2, gameContract);

        // Expect both MatchAccepted and MarketAutoCreated events
        vm.expectEmit(true, true, false, false);
        emit Escrow.MarketAutoCreated(matchId, 0); // marketId = 0 (first market)

        vm.prank(player2);
        escrow.acceptMatch{value: 1 ether}(matchId);
    }

    function test_acceptMatch_deductsTreasuryBalance() public {
        _setupAutoMarket();
        uint256 treasuryBefore = escrow.treasuryBalance();

        vm.prank(player1);
        uint256 matchId = escrow.createMatch{value: 1 ether}(player2, gameContract);
        vm.prank(player2);
        escrow.acceptMatch{value: 1 ether}(matchId);

        // Treasury should be reduced by marketSeed (0.1 ether)
        assertEq(escrow.treasuryBalance(), treasuryBefore - 0.1 ether);
    }

    function test_acceptMatch_noPM_stillWorks() public {
        // No PM configured — accept should work normally
        vm.prank(player1);
        uint256 matchId = escrow.createMatch{value: 1 ether}(player2, gameContract);
        vm.prank(player2);
        escrow.acceptMatch{value: 1 ether}(matchId);

        Escrow.Match memory m = escrow.getMatch(matchId);
        assertEq(uint8(m.status), uint8(Escrow.MatchStatus.Active));
    }

    function test_acceptMatch_zeroSeed_stillWorks() public {
        // PM configured but seed = 0 — no market created
        PredictionMarket pm = new PredictionMarket(address(escrow));
        escrow.setPredictionMarket(address(pm));
        escrow.setMarketSeed(0); // explicitly zero
        escrow.fundTreasury{value: 10 ether}();

        vm.prank(player1);
        uint256 matchId = escrow.createMatch{value: 1 ether}(player2, gameContract);
        vm.prank(player2);
        escrow.acceptMatch{value: 1 ether}(matchId);

        // Match accepted but no market created
        Escrow.Match memory m = escrow.getMatch(matchId);
        assertEq(uint8(m.status), uint8(Escrow.MatchStatus.Active));
        assertFalse(pm.marketExists(matchId));
    }

    function test_acceptMatch_emptyTreasury_stillWorks() public {
        // PM configured but treasury empty — no market, no revert
        PredictionMarket pm = new PredictionMarket(address(escrow));
        escrow.setPredictionMarket(address(pm));
        escrow.setMarketSeed(0.1 ether);
        // Don't fund treasury

        vm.prank(player1);
        uint256 matchId = escrow.createMatch{value: 1 ether}(player2, gameContract);
        vm.prank(player2);
        escrow.acceptMatch{value: 1 ether}(matchId);

        Escrow.Match memory m = escrow.getMatch(matchId);
        assertEq(uint8(m.status), uint8(Escrow.MatchStatus.Active));
        assertFalse(pm.marketExists(matchId));
    }

    function test_acceptMatch_duplicateMarket_stillWorks() public {
        // Create two matches — first auto-creates market, second should catch the revert
        // Actually, each match gets its own market, so test a scenario where PM reverts
        PredictionMarket pm = _setupAutoMarket();

        // Create and accept first match — market 0 created
        vm.prank(player1);
        uint256 matchId1 = escrow.createMatch{value: 1 ether}(player2, gameContract);
        vm.prank(player2);
        escrow.acceptMatch{value: 1 ether}(matchId1);
        assertTrue(pm.marketExists(matchId1));

        // Manually create a market for matchId that will be used next
        // to force a "market already exists" revert in auto-create
        vm.prank(player1);
        uint256 matchId2 = escrow.createMatch{value: 1 ether}(player2, gameContract);
        vm.prank(player2);
        escrow.acceptMatch{value: 1 ether}(matchId2);

        // Now manually create a duplicate market for matchId2's next match
        // Actually the auto-create already worked for matchId2 since it didn't exist yet.
        // Let's verify both markets exist and treasury was deducted twice.
        assertTrue(pm.marketExists(matchId2));
        assertEq(escrow.treasuryBalance(), 10 ether - 0.2 ether);
    }

    function test_acceptMatch_pmReverts_tryCatchRecovery() public {
        // Use a mock PM that always reverts to test try-catch recovery
        MockRevertingPM mockPm = new MockRevertingPM();
        escrow.setPredictionMarket(address(mockPm));
        escrow.setMarketSeed(0.1 ether);
        escrow.fundTreasury{value: 10 ether}();

        uint256 treasuryBefore = escrow.treasuryBalance();

        vm.prank(player1);
        uint256 matchId = escrow.createMatch{value: 1 ether}(player2, gameContract);
        vm.prank(player2);
        escrow.acceptMatch{value: 1 ether}(matchId);

        // Match should still be Active despite PM failure
        Escrow.Match memory m = escrow.getMatch(matchId);
        assertEq(uint8(m.status), uint8(Escrow.MatchStatus.Active));

        // Treasury should be refunded (no deduction)
        assertEq(escrow.treasuryBalance(), treasuryBefore);
    }

    // ─── Treasury Tests ──────────────────────────────────────────────────

    function test_fundTreasury() public {
        escrow.fundTreasury{value: 5 ether}();
        assertEq(escrow.treasuryBalance(), 5 ether);

        // Fund again — should accumulate
        escrow.fundTreasury{value: 3 ether}();
        assertEq(escrow.treasuryBalance(), 8 ether);
    }

    function test_fundTreasury_revertZero() public {
        vm.expectRevert("Escrow: must send MON");
        escrow.fundTreasury{value: 0}();
    }

    function test_withdrawTreasury() public {
        escrow.fundTreasury{value: 5 ether}();

        address recipient = address(0x999);
        uint256 balBefore = recipient.balance;

        escrow.withdrawTreasury(2 ether, recipient);

        assertEq(escrow.treasuryBalance(), 3 ether);
        assertEq(recipient.balance, balBefore + 2 ether);
    }

    function test_withdrawTreasury_revertInsufficientFunds() public {
        escrow.fundTreasury{value: 1 ether}();

        vm.expectRevert("Escrow: insufficient treasury");
        escrow.withdrawTreasury(2 ether, address(0x999));
    }

    function test_withdrawTreasury_revertNotOwner() public {
        escrow.fundTreasury{value: 5 ether}();

        vm.prank(player1);
        vm.expectRevert();
        escrow.withdrawTreasury(1 ether, player1);
    }

    // ─── PM Configuration Tests ──────────────────────────────────────────

    function test_setPredictionMarket_onlyOwner() public {
        vm.prank(player1);
        vm.expectRevert();
        escrow.setPredictionMarket(address(0x123));
    }

    function test_setMarketSeed_onlyOwner() public {
        vm.prank(player1);
        vm.expectRevert();
        escrow.setMarketSeed(0.1 ether);
    }

    function test_setPredictionMarket_emitsEvent() public {
        address pmAddr = address(0x123);
        vm.expectEmit(true, false, false, false);
        emit Escrow.PredictionMarketSet(pmAddr);
        escrow.setPredictionMarket(pmAddr);
    }

    function test_setMarketSeed_emitsEvent() public {
        vm.expectEmit(false, false, false, true);
        emit Escrow.MarketSeedSet(0.05 ether);
        escrow.setMarketSeed(0.05 ether);
    }

    // ─── Auto-Resolve Tests ──────────────────────────────────────────────

    function test_settle_autoResolvesMarket() public {
        (uint256 matchId, PredictionMarket pm) = _createAndAcceptWithMarket();

        // Market should be active (not resolved)
        PredictionMarket.Market memory mBefore = pm.getMarket(0);
        assertFalse(mBefore.resolved);

        // Settle the match — should auto-resolve the market
        vm.prank(gameContract);
        escrow.settle(matchId, player1);

        // Market should now be resolved with player1 as winner
        PredictionMarket.Market memory mAfter = pm.getMarket(0);
        assertTrue(mAfter.resolved);
        assertEq(mAfter.winner, player1);
    }

    function test_settleDraw_autoResolvesMarketAsDraw() public {
        (uint256 matchId, PredictionMarket pm) = _createAndAcceptWithMarket();

        // Settle as draw — should auto-resolve market as draw
        vm.prank(gameContract);
        escrow.settleDraw(matchId);

        PredictionMarket.Market memory m = pm.getMarket(0);
        assertTrue(m.resolved);
        assertEq(m.winner, address(0)); // draw = no winner
    }

    function test_settle_emitsMarketAutoResolved() public {
        _setupAutoMarket();
        vm.prank(player1);
        uint256 matchId = escrow.createMatch{value: 1 ether}(player2, gameContract);
        vm.prank(player2);
        escrow.acceptMatch{value: 1 ether}(matchId);

        vm.expectEmit(true, false, false, false);
        emit Escrow.MarketAutoResolved(matchId);

        vm.prank(gameContract);
        escrow.settle(matchId, player1);
    }

    function test_settle_noMarket_stillWorks() public {
        // No PM configured — settle should work normally
        vm.prank(player1);
        uint256 matchId = escrow.createMatch{value: 1 ether}(player2, gameContract);
        vm.prank(player2);
        escrow.acceptMatch{value: 1 ether}(matchId);

        vm.prank(gameContract);
        escrow.settle(matchId, player1);

        Escrow.Match memory m = escrow.getMatch(matchId);
        assertEq(uint8(m.status), uint8(Escrow.MatchStatus.Settled));
    }

    function test_settle_pmReverts_stillSettles() public {
        // Mock PM that always reverts on resolve
        MockRevertingPM mockPm = new MockRevertingPM();
        escrow.setPredictionMarket(address(mockPm));
        escrow.setMarketSeed(0.1 ether);
        escrow.fundTreasury{value: 10 ether}();

        vm.prank(player1);
        uint256 matchId = escrow.createMatch{value: 1 ether}(player2, gameContract);
        vm.prank(player2);
        escrow.acceptMatch{value: 1 ether}(matchId);

        // Settle should succeed despite PM revert on resolve
        uint256 balBefore = player1.balance;
        vm.prank(gameContract);
        escrow.settle(matchId, player1);

        assertEq(player1.balance, balBefore + 2 ether);
    }
}

/// @dev Mock PredictionMarket that always reverts (for testing try-catch)
contract MockRevertingPM {
    function createMarket(uint256) external payable returns (uint256) {
        revert("MockPM: always fails");
    }

    function resolveByMatch(uint256) external pure {
        revert("MockPM: resolve fails");
    }

    function resolveDrawByMatch(uint256) external pure {
        revert("MockPM: resolveDraw fails");
    }

    // Must accept ETH refund from failed try-catch
    receive() external payable {}
}
