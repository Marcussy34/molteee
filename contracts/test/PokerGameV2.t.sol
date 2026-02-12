// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import "../src/AgentRegistry.sol";
import "../src/Escrow.sol";
import "../src/PokerGameV2.sol";
import "../src/interfaces/IReputationRegistry.sol";

/// @dev Mock ERC-8004 Reputation Registry for testing
contract MockReputationRegistryV2 is IReputationRegistry {
    struct FeedbackCall {
        uint256 agentId;
        int128 value;
        string tag1;
        string tag2;
    }

    FeedbackCall[] public feedbackCalls;

    function giveFeedback(
        uint256 agentId,
        int128 value,
        uint8,
        string calldata tag1,
        string calldata tag2,
        string calldata,
        string calldata,
        bytes32
    ) external override {
        feedbackCalls.push(FeedbackCall(agentId, value, tag1, tag2));
    }

    function feedbackCount() external view returns (uint256) {
        return feedbackCalls.length;
    }

    function getFeedback(uint256 index) external view returns (FeedbackCall memory) {
        return feedbackCalls[index];
    }
}

contract PokerGameV2Test is Test {
    AgentRegistry public registry;
    Escrow public escrow;
    PokerGameV2 public poker;
    MockReputationRegistryV2 public mockReputation;

    address public owner = address(this);
    address public player1;
    address public player2;

    // Salts for commit-reveal
    bytes32 public salt1 = keccak256("budgetsalt1");
    bytes32 public salt2 = keccak256("budgetsalt2");

    function setUp() public {
        player1 = makeAddr("player1");
        player2 = makeAddr("player2");

        registry = new AgentRegistry();
        escrow = new Escrow();
        mockReputation = new MockReputationRegistryV2();
        poker = new PokerGameV2(address(escrow), address(registry), address(mockReputation));

        // Authorize poker game contract
        escrow.authorizeContract(address(poker), true);
        registry.authorizeContract(address(poker), true);

        // Fund players generously
        vm.deal(player1, 100 ether);
        vm.deal(player2, 100 ether);

        // Register both agents for Poker
        AgentRegistry.GameType[] memory gameTypes = new AgentRegistry.GameType[](1);
        gameTypes[0] = AgentRegistry.GameType.Poker;

        vm.prank(player1);
        registry.register(gameTypes, 0.001 ether, 10 ether);
        vm.prank(player2);
        registry.register(gameTypes, 0.001 ether, 10 ether);
    }

    // ─── Helpers ─────────────────────────────────────────────────────────

    /// @dev Create an active escrow match for poker
    function _createActiveEscrow(uint256 wager) internal returns (uint256 matchId) {
        vm.prank(player1);
        matchId = escrow.createMatch{value: wager}(player2, address(poker));
        vm.prank(player2);
        escrow.acceptMatch{value: wager}(matchId);
    }

    /// @dev Create a poker game and return gameId
    function _createGame(uint256 wager) internal returns (uint256 gameId) {
        uint256 matchId = _createActiveEscrow(wager);
        vm.prank(player1);
        gameId = poker.createGame(matchId);
    }

    /// @dev Compute hand commit hash
    function _handHash(uint8 handValue, bytes32 salt) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(handValue, salt));
    }

    /// @dev Both players commit hands for the current round
    function _commitBothHands(uint256 gameId, uint8 hand1, uint8 hand2) internal {
        vm.prank(player1);
        poker.commitHand(gameId, _handHash(hand1, salt1));
        vm.prank(player2);
        poker.commitHand(gameId, _handHash(hand2, salt2));
    }

    /// @dev Both players check (passes betting round)
    function _bothCheck(uint256 gameId) internal {
        vm.prank(player1);
        poker.takeAction(gameId, PokerGameV2.Action.Check);
        vm.prank(player2);
        poker.takeAction(gameId, PokerGameV2.Action.Check);
    }

    /// @dev Both players reveal hands for the current round
    function _revealBothHands(uint256 gameId, uint8 hand1, uint8 hand2) internal {
        vm.prank(player1);
        poker.revealHand(gameId, hand1, salt1);
        vm.prank(player2);
        poker.revealHand(gameId, hand2, salt2);
    }

    /// @dev Play a complete round: commit, check, check, reveal
    function _playRound(uint256 gameId, uint8 hand1, uint8 hand2) internal {
        _commitBothHands(gameId, hand1, hand2);
        _bothCheck(gameId);
        _bothCheck(gameId);
        _revealBothHands(gameId, hand1, hand2);
    }

    // ─── Game Creation Tests ─────────────────────────────────────────────

    function test_createGame() public {
        uint256 gameId = _createGame(1 ether);

        PokerGameV2.GameView memory g = poker.getGame(gameId);

        assertEq(g.player1, player1);
        assertEq(g.player2, player2);
        assertEq(g.totalRounds, 3);
        assertEq(g.currentRound, 0);
        assertEq(g.p1Score, 0);
        assertEq(g.p2Score, 0);
        assertEq(g.startingBudget, 150);
        assertEq(g.p1Budget, 150);
        assertEq(g.p2Budget, 150);
        assertEq(uint8(g.phase), uint8(PokerGameV2.GamePhase.Commit));
        assertFalse(g.settled);
    }

    // ─── Budget Constraint Tests ────────────────────────────────────────

    function test_budgetDeductedOnReveal() public {
        uint256 gameId = _createGame(1 ether);

        // Round 1: play with hand values 60, 40
        _playRound(gameId, 60, 40);

        // Check budgets: p1 spent 60, p2 spent 40
        PokerGameV2.GameView memory g = poker.getGame(gameId);
        assertEq(g.p1Budget, 90); // 150 - 60
        assertEq(g.p2Budget, 110); // 150 - 40
        assertEq(g.p1Score, 1); // p1 won round 1 (60 > 40)
    }

    function test_budgetConstraint_rejectExceedsBudget() public {
        uint256 gameId = _createGame(1 ether);

        // Round 1: p1 spends 80, p2 spends 30
        _playRound(gameId, 80, 30);

        // Round 2: p1 has 70 left, but needs 1 for round 3.
        // So max for round 2 = 70 - 1 = 69
        _commitBothHands(gameId, 70, 30); // p1 commits 70 (exceeds 69)
        _bothCheck(gameId);
        _bothCheck(gameId);

        // p1 tries to reveal 70 but that exceeds budget (70 remaining, 1 round left = max 69)
        vm.prank(player1);
        vm.expectRevert("PokerV2: exceeds budget");
        poker.revealHand(gameId, 70, salt1);
    }

    function test_budgetConstraint_lastRound_canUseAll() public {
        uint256 gameId = _createGame(1 ether);

        // Round 1: p1 spends 50, p2 spends 50 (draw)
        _playRound(gameId, 50, 50);

        // Round 2: p1 spends 50, p2 spends 50 (draw)
        _playRound(gameId, 50, 50);

        // Round 3 (last): p1 has 50 left, 0 rounds after = can use all 50
        _commitBothHands(gameId, 50, 50);
        _bothCheck(gameId);
        _bothCheck(gameId);

        // Both can reveal 50 — no future rounds to reserve for
        vm.prank(player1);
        poker.revealHand(gameId, 50, salt1);
        vm.prank(player2);
        poker.revealHand(gameId, 50, salt2);

        // All 3 rounds drawn — overall draw
        PokerGameV2.GameView memory g = poker.getGame(gameId);
        assertTrue(g.settled);
    }

    // ─── Multi-Round Tests ──────────────────────────────────────────────

    function test_fullGame_player1Wins2_0() public {
        uint256 gameId = _createGame(1 ether);

        uint256 p1BalBefore = player1.balance;

        // Round 1: p1 wins (70 > 30)
        _playRound(gameId, 70, 30);

        PokerGameV2.GameView memory g1 = poker.getGame(gameId);
        assertEq(g1.p1Score, 1);
        assertEq(g1.p2Score, 0);
        assertEq(g1.currentRound, 1);
        assertFalse(g1.settled);

        // Round 2: p1 wins (60 > 40) → 2-0 → game over
        _playRound(gameId, 60, 40);

        PokerGameV2.GameView memory g2 = poker.getGame(gameId);
        assertEq(g2.p1Score, 2);
        assertEq(g2.p2Score, 0);
        assertTrue(g2.settled);

        // Player1 gets both wagers (2 ETH)
        assertEq(player1.balance, p1BalBefore + 2 ether);
    }

    function test_fullGame_player2Wins2_1() public {
        uint256 gameId = _createGame(1 ether);

        uint256 p2BalBefore = player2.balance;

        // Round 1: p1 wins (70 > 30)
        _playRound(gameId, 70, 30);

        // Round 2: p2 wins (20 < 80). Budgets after: p1=60, p2=40
        _playRound(gameId, 20, 80);

        PokerGameV2.GameView memory g2 = poker.getGame(gameId);
        assertEq(g2.p1Score, 1);
        assertEq(g2.p2Score, 1);
        assertFalse(g2.settled);

        // Round 3 (last): p2 wins (30 < 35) → 1-2 → p2 wins
        // p1 has 60 budget, p2 has 40. Both within limits.
        _playRound(gameId, 30, 35);

        PokerGameV2.GameView memory g3 = poker.getGame(gameId);
        assertTrue(g3.settled);
        assertEq(g3.p2Score, 2);

        assertEq(player2.balance, p2BalBefore + 2 ether);
    }

    function test_fullGame_overallDraw() public {
        uint256 gameId = _createGame(1 ether);

        uint256 p1BalBefore = player1.balance;
        uint256 p2BalBefore = player2.balance;

        // All 3 rounds are draws
        _playRound(gameId, 50, 50);
        _playRound(gameId, 50, 50);
        _playRound(gameId, 50, 50);

        PokerGameV2.GameView memory g = poker.getGame(gameId);
        assertTrue(g.settled);
        assertEq(g.p1Score, 0);
        assertEq(g.p2Score, 0);

        // Both refunded
        assertEq(player1.balance, p1BalBefore + 1 ether);
        assertEq(player2.balance, p2BalBefore + 1 ether);
    }

    // ─── Fold Tests ─────────────────────────────────────────────────────

    function test_fold_roundGoesToOpponent_budgetPreserved() public {
        uint256 gameId = _createGame(1 ether);

        // Commit for round 1
        _commitBothHands(gameId, 20, 80);

        // Player1 folds during betting — opponent wins the round
        vm.prank(player1);
        poker.takeAction(gameId, PokerGameV2.Action.Fold);

        PokerGameV2.GameView memory g = poker.getGame(gameId);
        assertEq(g.p1Score, 0);
        assertEq(g.p2Score, 1);
        // Budgets preserved — no reveal happened
        assertEq(g.p1Budget, 150);
        assertEq(g.p2Budget, 150);
        assertEq(g.currentRound, 1); // Advanced to round 2
        assertFalse(g.settled); // Game continues — need 2 wins
    }

    function test_fold_twoFolds_opponentWinsMatch() public {
        uint256 gameId = _createGame(1 ether);

        uint256 p2BalBefore = player2.balance;

        // Round 1: p1 folds
        _commitBothHands(gameId, 10, 90);
        vm.prank(player1);
        poker.takeAction(gameId, PokerGameV2.Action.Fold);

        // Round 2: p1 folds again → 0-2 → p2 wins
        _commitBothHands(gameId, 10, 90);
        vm.prank(player1);
        poker.takeAction(gameId, PokerGameV2.Action.Fold);

        PokerGameV2.GameView memory g = poker.getGame(gameId);
        assertTrue(g.settled);
        assertEq(g.p2Score, 2);

        assertEq(player2.balance, p2BalBefore + 2 ether);
    }

    // ─── Betting Across Rounds Tests ────────────────────────────────────

    function test_extraBets_accumulateAcrossRounds() public {
        uint256 gameId = _createGame(1 ether);

        // Round 1: Player1 bets 0.3, Player2 calls — p1 wins (70 > 30)
        _commitBothHands(gameId, 70, 30);
        vm.prank(player1);
        poker.takeAction{value: 0.3 ether}(gameId, PokerGameV2.Action.Bet);
        vm.prank(player2);
        poker.takeAction{value: 0.3 ether}(gameId, PokerGameV2.Action.Call);
        _bothCheck(gameId); // betting round 2: both check
        _revealBothHands(gameId, 70, 30);

        PokerGameV2.GameView memory g1 = poker.getGame(gameId);
        assertEq(g1.p1ExtraBets, 0.3 ether);
        assertEq(g1.p2ExtraBets, 0.3 ether);

        // Round 2: Player1 bets 0.5, Player2 calls — p1 wins (60 > 20) → 2-0
        uint256 p1BalBefore = player1.balance;

        _commitBothHands(gameId, 60, 20);
        vm.prank(player1);
        poker.takeAction{value: 0.5 ether}(gameId, PokerGameV2.Action.Bet);
        vm.prank(player2);
        poker.takeAction{value: 0.5 ether}(gameId, PokerGameV2.Action.Call);
        _bothCheck(gameId);
        _revealBothHands(gameId, 60, 20);

        PokerGameV2.GameView memory g2 = poker.getGame(gameId);
        assertTrue(g2.settled);
        // Total extra bets: p1=0.8, p2=0.8 = 1.6 total → winner gets all
        assertEq(g2.p1ExtraBets, 0.8 ether);
        assertEq(g2.p2ExtraBets, 0.8 ether);

        // p1 spent 0.5 in round 2 bet, then received 2 ETH (escrow) + 1.6 ETH (all extra bets)
        // Net from p1BalBefore: -0.5 + 2.0 + 1.6 = 3.1 ETH
        assertEq(player1.balance, p1BalBefore + 3.1 ether);
    }

    // ─── Draw Round Tests ───────────────────────────────────────────────

    function test_drawRound_noScoreChange() public {
        uint256 gameId = _createGame(1 ether);

        // Round 1: draw (50 == 50)
        _playRound(gameId, 50, 50);

        PokerGameV2.GameView memory g = poker.getGame(gameId);
        assertEq(g.p1Score, 0);
        assertEq(g.p2Score, 0);
        assertEq(g.currentRound, 1);
        assertFalse(g.settled);
    }

    // ─── Commit Phase Tests ─────────────────────────────────────────────

    function test_commitHand() public {
        uint256 gameId = _createGame(1 ether);

        vm.prank(player1);
        poker.commitHand(gameId, _handHash(75, salt1));

        PokerGameV2.GameView memory g = poker.getGame(gameId);
        assertEq(uint8(g.phase), uint8(PokerGameV2.GamePhase.Commit));
        assertTrue(g.p1Committed);
        assertFalse(g.p2Committed);
    }

    function test_bothCommit_advancesToBetting() public {
        uint256 gameId = _createGame(1 ether);
        _commitBothHands(gameId, 75, 50);

        PokerGameV2.GameView memory g = poker.getGame(gameId);
        assertEq(uint8(g.phase), uint8(PokerGameV2.GamePhase.BettingRound1));
    }

    function test_commit_revertDoubleCommit() public {
        uint256 gameId = _createGame(1 ether);

        vm.prank(player1);
        poker.commitHand(gameId, _handHash(75, salt1));

        vm.prank(player1);
        vm.expectRevert("PokerV2: already committed");
        poker.commitHand(gameId, _handHash(80, salt1));
    }

    // ─── Betting Round Tests ────────────────────────────────────────────

    function test_checkCheck_advancesRound() public {
        uint256 gameId = _createGame(1 ether);
        _commitBothHands(gameId, 75, 50);

        _bothCheck(gameId);

        PokerGameV2.GameView memory g = poker.getGame(gameId);
        assertEq(uint8(g.phase), uint8(PokerGameV2.GamePhase.BettingRound2));
    }

    function test_betCall_advancesRound() public {
        uint256 gameId = _createGame(1 ether);
        _commitBothHands(gameId, 75, 50);

        vm.prank(player1);
        poker.takeAction{value: 0.5 ether}(gameId, PokerGameV2.Action.Bet);

        vm.prank(player2);
        poker.takeAction{value: 0.5 ether}(gameId, PokerGameV2.Action.Call);

        PokerGameV2.GameView memory g = poker.getGame(gameId);
        assertEq(uint8(g.phase), uint8(PokerGameV2.GamePhase.BettingRound2));
    }

    function test_bet_revertNotYourTurn() public {
        uint256 gameId = _createGame(1 ether);
        _commitBothHands(gameId, 75, 50);

        vm.prank(player2);
        vm.expectRevert("PokerV2: not your turn");
        poker.takeAction{value: 0.5 ether}(gameId, PokerGameV2.Action.Bet);
    }

    function test_bet_revertTooLarge() public {
        uint256 gameId = _createGame(1 ether);
        _commitBothHands(gameId, 75, 50);

        vm.prank(player1);
        vm.expectRevert("PokerV2: bet too large");
        poker.takeAction{value: 3 ether}(gameId, PokerGameV2.Action.Bet);
    }

    function test_raise_works() public {
        uint256 gameId = _createGame(1 ether);
        _commitBothHands(gameId, 75, 50);

        vm.prank(player1);
        poker.takeAction{value: 0.3 ether}(gameId, PokerGameV2.Action.Bet);

        vm.prank(player2);
        poker.takeAction{value: 0.6 ether}(gameId, PokerGameV2.Action.Raise);

        vm.prank(player1);
        poker.takeAction{value: 0.6 ether}(gameId, PokerGameV2.Action.Call);

        PokerGameV2.GameView memory g = poker.getGame(gameId);
        assertEq(uint8(g.phase), uint8(PokerGameV2.GamePhase.BettingRound2));
    }

    function test_check_revertWithActiveBet() public {
        uint256 gameId = _createGame(1 ether);
        _commitBothHands(gameId, 75, 50);

        vm.prank(player1);
        poker.takeAction{value: 0.5 ether}(gameId, PokerGameV2.Action.Bet);

        vm.prank(player2);
        vm.expectRevert("PokerV2: cannot check with active bet");
        poker.takeAction(gameId, PokerGameV2.Action.Check);
    }

    // ─── Showdown Tests ─────────────────────────────────────────────────

    function test_reveal_revertHashMismatch() public {
        uint256 gameId = _createGame(1 ether);
        _commitBothHands(gameId, 75, 50);
        _bothCheck(gameId);
        _bothCheck(gameId);

        vm.prank(player1);
        vm.expectRevert("PokerV2: hash mismatch");
        poker.revealHand(gameId, 99, salt1);
    }

    function test_reveal_revertInvalidHandValue() public {
        uint256 gameId = _createGame(1 ether);

        // Commit hand value 0 (invalid)
        bytes32 badHash = keccak256(abi.encodePacked(uint8(0), salt1));
        vm.prank(player1);
        poker.commitHand(gameId, badHash);
        vm.prank(player2);
        poker.commitHand(gameId, _handHash(50, salt2));

        _bothCheck(gameId);
        _bothCheck(gameId);

        vm.prank(player1);
        vm.expectRevert("PokerV2: hand must be 1-100");
        poker.revealHand(gameId, 0, salt1);
    }

    // ─── Timeout Tests ──────────────────────────────────────────────────

    function test_timeout_commitPhase() public {
        uint256 gameId = _createGame(1 ether);

        // Only player1 commits
        vm.prank(player1);
        poker.commitHand(gameId, _handHash(75, salt1));

        vm.warp(block.timestamp + 5 minutes + 1);

        uint256 p1BalBefore = player1.balance;

        vm.prank(player1);
        poker.claimTimeout(gameId);

        PokerGameV2.GameView memory g = poker.getGame(gameId);
        assertTrue(g.settled);
        assertEq(player1.balance, p1BalBefore + 2 ether);
    }

    function test_timeout_bettingPhase() public {
        uint256 gameId = _createGame(1 ether);
        _commitBothHands(gameId, 75, 50);

        // Player1's turn — they don't act
        vm.warp(block.timestamp + 5 minutes + 1);

        uint256 p2BalBefore = player2.balance;

        vm.prank(player2);
        poker.claimTimeout(gameId);

        PokerGameV2.GameView memory g = poker.getGame(gameId);
        assertTrue(g.settled);
        assertEq(player2.balance, p2BalBefore + 2 ether);
    }

    function test_timeout_showdownPhase() public {
        uint256 gameId = _createGame(1 ether);
        _commitBothHands(gameId, 75, 50);
        _bothCheck(gameId);
        _bothCheck(gameId);

        // Only player1 reveals
        vm.prank(player1);
        poker.revealHand(gameId, 75, salt1);

        vm.warp(block.timestamp + 5 minutes + 1);

        uint256 p1BalBefore = player1.balance;

        vm.prank(player1);
        poker.claimTimeout(gameId);

        PokerGameV2.GameView memory g = poker.getGame(gameId);
        assertTrue(g.settled);
        assertEq(player1.balance, p1BalBefore + 2 ether);
    }

    // ─── ELO & Match History Tests ──────────────────────────────────────

    function test_eloUpdateAfterBudgetPoker() public {
        uint256 gameId = _createGame(1 ether);

        // Player1 wins 2-0
        _playRound(gameId, 70, 30);
        _playRound(gameId, 60, 20);

        uint256 p1Elo = registry.elo(player1, AgentRegistry.GameType.Poker);
        uint256 p2Elo = registry.elo(player2, AgentRegistry.GameType.Poker);

        assertGt(p1Elo, 1000);
        assertLt(p2Elo, 1000);
    }

    function test_matchRecordAfterBudgetPoker() public {
        uint256 gameId = _createGame(1 ether);

        _playRound(gameId, 70, 30);
        _playRound(gameId, 60, 20);

        assertEq(registry.getMatchCount(player1), 1);
        assertEq(registry.getMatchCount(player2), 1);

        AgentRegistry.MatchRecord[] memory p1History = registry.getMatchHistory(player1);
        assertTrue(p1History[0].won);
        assertEq(uint8(p1History[0].gameType), uint8(AgentRegistry.GameType.Poker));
    }

    // ─── Reputation Tests ───────────────────────────────────────────────

    function test_reputationFeedback() public {
        registry.setAgentIdFor(player1, 100);
        registry.setAgentIdFor(player2, 200);

        uint256 gameId = _createGame(1 ether);
        _playRound(gameId, 70, 30);
        _playRound(gameId, 60, 20);

        assertEq(mockReputation.feedbackCount(), 2);

        MockReputationRegistryV2.FeedbackCall memory winFeedback = mockReputation.getFeedback(0);
        assertEq(winFeedback.agentId, 100);
        assertEq(winFeedback.value, int128(1));
        assertEq(keccak256(bytes(winFeedback.tag1)), keccak256(bytes("Poker")));

        MockReputationRegistryV2.FeedbackCall memory loseFeedback = mockReputation.getFeedback(1);
        assertEq(loseFeedback.agentId, 200);
        assertEq(loseFeedback.value, int128(-1));
    }

    // ─── getRound View Function Test ────────────────────────────────────

    function test_getRound_returnsCorrectData() public {
        uint256 gameId = _createGame(1 ether);

        _commitBothHands(gameId, 60, 40);
        _bothCheck(gameId);
        _bothCheck(gameId);
        _revealBothHands(gameId, 60, 40);

        PokerGameV2.RoundData memory rd = poker.getRound(gameId, 0);
        assertTrue(rd.p1Committed);
        assertTrue(rd.p2Committed);
        assertTrue(rd.p1Revealed);
        assertTrue(rd.p2Revealed);
        assertEq(rd.p1HandValue, 60);
        assertEq(rd.p2HandValue, 40);
    }

    // ─── Full 3-Round Game Flow Test ────────────────────────────────────

    function test_fullThreeRoundGame_withBetting() public {
        uint256 gameId = _createGame(1 ether);

        // Round 1: p1 bets, p2 calls, both check R2 — p1 wins (70 > 30)
        _commitBothHands(gameId, 70, 30);
        vm.prank(player1);
        poker.takeAction{value: 0.2 ether}(gameId, PokerGameV2.Action.Bet);
        vm.prank(player2);
        poker.takeAction{value: 0.2 ether}(gameId, PokerGameV2.Action.Call);
        _bothCheck(gameId);
        _revealBothHands(gameId, 70, 30);

        // Score: 1-0, budgets: p1=80, p2=120

        // Round 2: p2 wins (20 < 80) — tied 1-1
        _playRound(gameId, 20, 80);
        // Score: 1-1, budgets: p1=60, p2=40

        // Round 3: p1 wins (55 > 35) — final 2-1
        uint256 p1BalBefore = player1.balance;
        _playRound(gameId, 55, 35);

        PokerGameV2.GameView memory g = poker.getGame(gameId);
        assertTrue(g.settled);
        assertEq(g.p1Score, 2);
        assertEq(g.p2Score, 1);
        // p1 budget: 60 - 55 = 5, p2 budget: 40 - 35 = 5

        // Player1 gets 2 ETH (escrow) + 0.4 ETH (extra bets: 0.2+0.2)
        assertEq(player1.balance, p1BalBefore + 2.4 ether);
    }
}
