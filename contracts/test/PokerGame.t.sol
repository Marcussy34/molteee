// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import "../src/AgentRegistry.sol";
import "../src/Escrow.sol";
import "../src/PokerGame.sol";
import "../src/interfaces/IReputationRegistry.sol";

/// @dev Mock ERC-8004 Reputation Registry for testing
contract MockReputationRegistry2 is IReputationRegistry {
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

contract PokerGameTest is Test {
    AgentRegistry public registry;
    Escrow public escrow;
    PokerGame public poker;
    MockReputationRegistry2 public mockReputation;

    address public owner = address(this);
    address public player1;
    address public player2;

    // Salts for commit-reveal
    bytes32 public salt1 = keccak256("pokersalt1");
    bytes32 public salt2 = keccak256("pokersalt2");

    function setUp() public {
        player1 = makeAddr("player1");
        player2 = makeAddr("player2");

        registry = new AgentRegistry();
        escrow = new Escrow();
        mockReputation = new MockReputationRegistry2();
        poker = new PokerGame(address(escrow), address(registry), address(mockReputation));

        // Authorize poker game contract
        escrow.authorizeContract(address(poker), true);
        registry.authorizeContract(address(poker), true);

        // Fund players generously for betting
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

    /// @dev Both players commit hands
    function _commitBothHands(uint256 gameId, uint8 hand1, uint8 hand2) internal {
        vm.prank(player1);
        poker.commitHand(gameId, _handHash(hand1, salt1));
        vm.prank(player2);
        poker.commitHand(gameId, _handHash(hand2, salt2));
    }

    /// @dev Both players check (passes betting round)
    function _bothCheck(uint256 gameId) internal {
        vm.prank(player1);
        poker.takeAction(gameId, PokerGame.Action.Check);
        vm.prank(player2);
        poker.takeAction(gameId, PokerGame.Action.Check);
    }

    /// @dev Both players reveal hands
    function _revealBothHands(uint256 gameId, uint8 hand1, uint8 hand2) internal {
        vm.prank(player1);
        poker.revealHand(gameId, hand1, salt1);
        vm.prank(player2);
        poker.revealHand(gameId, hand2, salt2);
    }

    // ─── Game Creation Tests ─────────────────────────────────────────────

    function test_createGame() public {
        uint256 gameId = _createGame(1 ether);

        PokerGame.GameView memory g = poker.getGame(gameId);

        assertEq(g.player1, player1);
        assertEq(g.player2, player2);
        assertEq(g.pot, 2 ether); // Both wagers locked
        assertEq(uint8(g.phase), uint8(PokerGame.GamePhase.Commit));
        assertFalse(g.settled);
    }

    // ─── Commit Phase Tests ──────────────────────────────────────────────

    function test_commitHand() public {
        uint256 gameId = _createGame(1 ether);

        vm.prank(player1);
        poker.commitHand(gameId, _handHash(75, salt1));

        // Should still be in Commit phase (player2 hasn't committed)
        PokerGame.GameView memory g = poker.getGame(gameId);
        assertEq(uint8(g.phase), uint8(PokerGame.GamePhase.Commit));
    }

    function test_bothCommit_advancesToBetting() public {
        uint256 gameId = _createGame(1 ether);
        _commitBothHands(gameId, 75, 50);

        PokerGame.GameView memory g = poker.getGame(gameId);
        assertEq(uint8(g.phase), uint8(PokerGame.GamePhase.BettingRound1));
    }

    function test_commit_revertDoubleCommit() public {
        uint256 gameId = _createGame(1 ether);

        vm.prank(player1);
        poker.commitHand(gameId, _handHash(75, salt1));

        vm.prank(player1);
        vm.expectRevert("PokerGame: already committed");
        poker.commitHand(gameId, _handHash(80, salt1));
    }

    // ─── Betting Round Tests ─────────────────────────────────────────────

    function test_checkCheck_advancesRound() public {
        uint256 gameId = _createGame(1 ether);
        _commitBothHands(gameId, 75, 50);

        // Round 1: both check
        _bothCheck(gameId);

        // Should be in BettingRound2
        PokerGame.GameView memory g = poker.getGame(gameId);
        assertEq(uint8(g.phase), uint8(PokerGame.GamePhase.BettingRound2));
    }

    function test_checkCheck_bothRounds_goesToShowdown() public {
        uint256 gameId = _createGame(1 ether);
        _commitBothHands(gameId, 75, 50);

        // Round 1: both check
        _bothCheck(gameId);
        // Round 2: both check
        _bothCheck(gameId);

        // Should be in Showdown
        PokerGame.GameView memory g = poker.getGame(gameId);
        assertEq(uint8(g.phase), uint8(PokerGame.GamePhase.Showdown));
    }

    function test_betCall_advancesRound() public {
        uint256 gameId = _createGame(1 ether);
        _commitBothHands(gameId, 75, 50);

        // Player1 bets 0.5 ETH
        vm.prank(player1);
        poker.takeAction{value: 0.5 ether}(gameId, PokerGame.Action.Bet);

        // Player2 calls
        vm.prank(player2);
        poker.takeAction{value: 0.5 ether}(gameId, PokerGame.Action.Call);

        // Should advance to BettingRound2
        PokerGame.GameView memory g = poker.getGame(gameId);
        assertEq(uint8(g.phase), uint8(PokerGame.GamePhase.BettingRound2));
        assertEq(g.pot, 3 ether); // 2 (escrow) + 0.5 + 0.5
    }

    function test_bet_revertNotYourTurn() public {
        uint256 gameId = _createGame(1 ether);
        _commitBothHands(gameId, 75, 50);

        // Player2 tries to act first (player1's turn)
        vm.prank(player2);
        vm.expectRevert("PokerGame: not your turn");
        poker.takeAction{value: 0.5 ether}(gameId, PokerGame.Action.Bet);
    }

    function test_bet_revertTooLarge() public {
        uint256 gameId = _createGame(1 ether);
        _commitBothHands(gameId, 75, 50);

        // Max bet = 2x wager = 2 ETH. Try 3 ETH.
        vm.prank(player1);
        vm.expectRevert("PokerGame: bet too large");
        poker.takeAction{value: 3 ether}(gameId, PokerGame.Action.Bet);
    }

    function test_raise_works() public {
        uint256 gameId = _createGame(1 ether);
        _commitBothHands(gameId, 75, 50);

        // Player1 bets 0.3 ETH
        vm.prank(player1);
        poker.takeAction{value: 0.3 ether}(gameId, PokerGame.Action.Bet);

        // Player2 raises to 0.6 ETH
        vm.prank(player2);
        poker.takeAction{value: 0.6 ether}(gameId, PokerGame.Action.Raise);

        // Player1 calls
        vm.prank(player1);
        poker.takeAction{value: 0.6 ether}(gameId, PokerGame.Action.Call);

        // Should advance to round 2
        PokerGame.GameView memory g = poker.getGame(gameId);
        assertEq(uint8(g.phase), uint8(PokerGame.GamePhase.BettingRound2));
        assertEq(g.pot, 3.5 ether); // 2 + 0.3 + 0.6 + 0.6
    }

    function test_check_revertWithActiveBet() public {
        uint256 gameId = _createGame(1 ether);
        _commitBothHands(gameId, 75, 50);

        // Player1 bets
        vm.prank(player1);
        poker.takeAction{value: 0.5 ether}(gameId, PokerGame.Action.Bet);

        // Player2 tries to check (should fail — must call, raise, or fold)
        vm.prank(player2);
        vm.expectRevert("PokerGame: cannot check with active bet");
        poker.takeAction(gameId, PokerGame.Action.Check);
    }

    // ─── Fold Tests ──────────────────────────────────────────────────────

    function test_fold_opponentWins() public {
        uint256 gameId = _createGame(1 ether);
        _commitBothHands(gameId, 10, 90); // Player1 has bad hand

        uint256 p2BalBefore = player2.balance;

        // Player1 folds
        vm.prank(player1);
        poker.takeAction(gameId, PokerGame.Action.Fold);

        // Player2 wins without showdown
        PokerGame.GameView memory g = poker.getGame(gameId);
        assertTrue(g.settled);
        assertEq(uint8(g.phase), uint8(PokerGame.GamePhase.Complete));
        // Player2 gets both wagers
        assertEq(player2.balance, p2BalBefore + 2 ether);
    }

    function test_fold_afterBet_winnerGetsExtraBets() public {
        uint256 gameId = _createGame(1 ether);
        _commitBothHands(gameId, 30, 90);

        // Player1 bets 0.5 ETH (bluffing with weak hand)
        vm.prank(player1);
        poker.takeAction{value: 0.5 ether}(gameId, PokerGame.Action.Bet);

        // Player2 raises to 1 ETH
        vm.prank(player2);
        poker.takeAction{value: 1 ether}(gameId, PokerGame.Action.Raise);

        // Player1 folds — player2 wins everything
        vm.prank(player1);
        poker.takeAction(gameId, PokerGame.Action.Fold);

        PokerGame.GameView memory g = poker.getGame(gameId);
        assertTrue(g.settled);
    }

    // ─── Showdown Tests ──────────────────────────────────────────────────

    function test_showdown_higherHandWins() public {
        uint256 gameId = _createGame(1 ether);
        _commitBothHands(gameId, 75, 50);

        // Both check through both rounds
        _bothCheck(gameId);
        _bothCheck(gameId);

        uint256 p1BalBefore = player1.balance;

        // Showdown — both reveal
        _revealBothHands(gameId, 75, 50);

        // Player1 wins (75 > 50)
        PokerGame.GameView memory g = poker.getGame(gameId);
        assertTrue(g.settled);
        assertEq(player1.balance, p1BalBefore + 2 ether);
    }

    function test_showdown_equalHandsDraw() public {
        uint256 gameId = _createGame(1 ether);
        _commitBothHands(gameId, 50, 50);

        _bothCheck(gameId);
        _bothCheck(gameId);

        uint256 p1BalBefore = player1.balance;
        uint256 p2BalBefore = player2.balance;

        _revealBothHands(gameId, 50, 50);

        // Draw — both refunded
        PokerGame.GameView memory g = poker.getGame(gameId);
        assertTrue(g.settled);
        assertEq(player1.balance, p1BalBefore + 1 ether);
        assertEq(player2.balance, p2BalBefore + 1 ether);
    }

    function test_showdown_withBets_winnerGetsAll() public {
        uint256 gameId = _createGame(1 ether);
        _commitBothHands(gameId, 90, 30);

        // Round 1: player1 bets 0.5, player2 calls
        vm.prank(player1);
        poker.takeAction{value: 0.5 ether}(gameId, PokerGame.Action.Bet);
        vm.prank(player2);
        poker.takeAction{value: 0.5 ether}(gameId, PokerGame.Action.Call);

        // Round 2: both check
        _bothCheck(gameId);

        uint256 p1BalBefore = player1.balance;

        // Showdown
        _revealBothHands(gameId, 90, 30);

        // Player1 wins: 2 (escrow) + 0.5 + 0.5 (extra bets) = 3 ether total
        PokerGame.GameView memory g = poker.getGame(gameId);
        assertTrue(g.settled);
        assertEq(player1.balance, p1BalBefore + 2 ether + 1 ether);
    }

    function test_reveal_revertHashMismatch() public {
        uint256 gameId = _createGame(1 ether);
        _commitBothHands(gameId, 75, 50);

        _bothCheck(gameId);
        _bothCheck(gameId);

        // Player1 tries to reveal different hand value
        vm.prank(player1);
        vm.expectRevert("PokerGame: hash mismatch");
        poker.revealHand(gameId, 99, salt1); // Committed 75, revealing 99
    }

    function test_reveal_revertInvalidHandValue() public {
        uint256 gameId = _createGame(1 ether);

        // Commit hand value 0 — hash matches but reveal should reject
        bytes32 badHash = keccak256(abi.encodePacked(uint8(0), salt1));
        vm.prank(player1);
        poker.commitHand(gameId, badHash);
        vm.prank(player2);
        poker.commitHand(gameId, _handHash(50, salt2));

        _bothCheck(gameId);
        _bothCheck(gameId);

        // Try to reveal hand value 0
        vm.prank(player1);
        vm.expectRevert("PokerGame: hand must be 1-100");
        poker.revealHand(gameId, 0, salt1);
    }

    // ─── Timeout Tests ───────────────────────────────────────────────────

    function test_timeout_commitPhase() public {
        uint256 gameId = _createGame(1 ether);

        // Only player1 commits
        vm.prank(player1);
        poker.commitHand(gameId, _handHash(75, salt1));

        vm.warp(block.timestamp + 5 minutes + 1);

        uint256 p1BalBefore = player1.balance;

        vm.prank(player1);
        poker.claimTimeout(gameId);

        PokerGame.GameView memory g = poker.getGame(gameId);
        assertTrue(g.settled);
        assertEq(player1.balance, p1BalBefore + 2 ether);
    }

    function test_timeout_bettingPhase() public {
        uint256 gameId = _createGame(1 ether);
        _commitBothHands(gameId, 75, 50);

        // Player1's turn — they don't act
        vm.warp(block.timestamp + 5 minutes + 1);

        uint256 p2BalBefore = player2.balance;

        // Player2 claims timeout (player1 timed out on their turn)
        vm.prank(player2);
        poker.claimTimeout(gameId);

        PokerGame.GameView memory g = poker.getGame(gameId);
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

        PokerGame.GameView memory g = poker.getGame(gameId);
        assertTrue(g.settled);
        assertEq(player1.balance, p1BalBefore + 2 ether);
    }

    // ─── ELO & Match History Tests ───────────────────────────────────────

    function test_eloUpdateAfterPokerMatch() public {
        uint256 gameId = _createGame(1 ether);
        _commitBothHands(gameId, 90, 10);

        _bothCheck(gameId);
        _bothCheck(gameId);
        _revealBothHands(gameId, 90, 10);

        // Player1 wins — Poker ELO should increase
        uint256 p1Elo = registry.elo(player1, AgentRegistry.GameType.Poker);
        uint256 p2Elo = registry.elo(player2, AgentRegistry.GameType.Poker);

        assertGt(p1Elo, 1000);
        assertLt(p2Elo, 1000);
    }

    function test_matchRecordAfterPokerGame() public {
        uint256 gameId = _createGame(1 ether);
        _commitBothHands(gameId, 90, 10);

        _bothCheck(gameId);
        _bothCheck(gameId);
        _revealBothHands(gameId, 90, 10);

        assertEq(registry.getMatchCount(player1), 1);
        assertEq(registry.getMatchCount(player2), 1);

        AgentRegistry.MatchRecord[] memory p1History = registry.getMatchHistory(player1);
        assertTrue(p1History[0].won);
        assertEq(uint8(p1History[0].gameType), uint8(AgentRegistry.GameType.Poker));
    }

    // ─── Reputation Tests ────────────────────────────────────────────────

    function test_reputationFeedbackAfterPoker() public {
        poker.setAgentId(player1, 100);
        poker.setAgentId(player2, 200);

        uint256 gameId = _createGame(1 ether);
        _commitBothHands(gameId, 90, 10);
        _bothCheck(gameId);
        _bothCheck(gameId);
        _revealBothHands(gameId, 90, 10);

        assertEq(mockReputation.feedbackCount(), 2);

        MockReputationRegistry2.FeedbackCall memory winFeedback = mockReputation.getFeedback(0);
        assertEq(winFeedback.agentId, 100);
        assertEq(winFeedback.value, int128(1));
        assertEq(keccak256(bytes(winFeedback.tag1)), keccak256(bytes("Poker")));

        MockReputationRegistry2.FeedbackCall memory loseFeedback = mockReputation.getFeedback(1);
        assertEq(loseFeedback.agentId, 200);
        assertEq(loseFeedback.value, int128(-1));
    }

    // ─── Full Game Flow Test ─────────────────────────────────────────────

    function test_fullGameFlow_betRaiseCallShowdown() public {
        uint256 gameId = _createGame(1 ether);
        _commitBothHands(gameId, 85, 40);

        // Round 1: Player1 bets 0.2, Player2 raises to 0.5, Player1 calls
        vm.prank(player1);
        poker.takeAction{value: 0.2 ether}(gameId, PokerGame.Action.Bet);
        vm.prank(player2);
        poker.takeAction{value: 0.5 ether}(gameId, PokerGame.Action.Raise);
        vm.prank(player1);
        poker.takeAction{value: 0.5 ether}(gameId, PokerGame.Action.Call);

        // Round 2: Both check
        _bothCheck(gameId);

        uint256 p1BalBefore = player1.balance;

        // Showdown
        _revealBothHands(gameId, 85, 40);

        // Player1 wins with 85 > 40
        PokerGame.GameView memory g = poker.getGame(gameId);
        assertTrue(g.settled);
        // Pot = 2 (escrow) + 0.2 + 0.5 + 0.5 = 3.2 ether
        assertEq(g.pot, 3.2 ether);
        // Player1 gets escrow (2 ETH) + extra bets (1.2 ETH) = 3.2 ETH
        assertEq(player1.balance, p1BalBefore + 3.2 ether);
    }
}
