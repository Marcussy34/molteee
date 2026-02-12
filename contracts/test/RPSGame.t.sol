// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import "../src/AgentRegistry.sol";
import "../src/Escrow.sol";
import "../src/RPSGame.sol";
import "../src/interfaces/IReputationRegistry.sol";

/// @dev Mock ERC-8004 Reputation Registry for testing feedback calls
contract MockReputationRegistry is IReputationRegistry {
    struct FeedbackCall {
        uint256 agentId;
        int128 value;
        uint8 valueDecimals;
        string tag1;
        string tag2;
    }

    FeedbackCall[] public feedbackCalls;

    function giveFeedback(
        uint256 agentId,
        int128 value,
        uint8 valueDecimals,
        string calldata tag1,
        string calldata tag2,
        string calldata,
        string calldata,
        bytes32
    ) external override {
        feedbackCalls.push(FeedbackCall(agentId, value, valueDecimals, tag1, tag2));
    }

    /// @dev Get total number of giveFeedback calls
    function feedbackCount() external view returns (uint256) {
        return feedbackCalls.length;
    }

    /// @dev Get a specific feedback call for assertions
    function getFeedback(uint256 index) external view returns (FeedbackCall memory) {
        return feedbackCalls[index];
    }
}

contract RPSGameTest is Test {
    AgentRegistry public registry;
    Escrow public escrow;
    RPSGame public rps;
    MockReputationRegistry public mockReputation;

    address public owner = address(this);
    address public player1;
    address public player2;

    // Common salts for testing
    bytes32 public salt1 = keccak256("salt1");
    bytes32 public salt2 = keccak256("salt2");

    function setUp() public {
        // Use labeled addresses for clarity in traces
        player1 = makeAddr("player1");
        player2 = makeAddr("player2");

        // Deploy contracts (including mock ERC-8004 Reputation Registry)
        registry = new AgentRegistry();
        escrow = new Escrow();
        mockReputation = new MockReputationRegistry();
        rps = new RPSGame(address(escrow), address(registry), address(mockReputation));

        // Authorize contracts
        escrow.authorizeContract(address(rps), true);
        registry.authorizeContract(address(rps), true);

        // Fund players
        vm.deal(player1, 100 ether);
        vm.deal(player2, 100 ether);

        // Register both agents
        AgentRegistry.GameType[] memory gameTypes = new AgentRegistry.GameType[](1);
        gameTypes[0] = AgentRegistry.GameType.RPS;

        vm.prank(player1);
        registry.register(gameTypes, 0.001 ether, 10 ether);
        vm.prank(player2);
        registry.register(gameTypes, 0.001 ether, 10 ether);
    }

    // ─── Helpers ─────────────────────────────────────────────────────────

    /// @dev Create an escrow match and accept it, returning the matchId
    function _createActiveEscrow(uint256 wager) internal returns (uint256 matchId) {
        vm.prank(player1);
        matchId = escrow.createMatch{value: wager}(player2, address(rps));
        vm.prank(player2);
        escrow.acceptMatch{value: wager}(matchId);
    }

    /// @dev Create a full game (escrow + RPS) and return the gameId
    function _createGame(uint256 wager, uint256 rounds) internal returns (uint256 gameId) {
        uint256 matchId = _createActiveEscrow(wager);
        vm.prank(player1);
        gameId = rps.createGame(matchId, rounds);
    }

    /// @dev Compute commit hash for a move + salt
    function _commitHash(RPSGame.Move move, bytes32 salt) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(uint8(move), salt));
    }

    /// @dev Play one round: both commit, both reveal
    function _playRound(
        uint256 gameId,
        RPSGame.Move move1,
        RPSGame.Move move2
    ) internal {
        // Both commit
        vm.prank(player1);
        rps.commit(gameId, _commitHash(move1, salt1));
        vm.prank(player2);
        rps.commit(gameId, _commitHash(move2, salt2));

        // Both reveal
        vm.prank(player1);
        rps.reveal(gameId, move1, salt1);
        vm.prank(player2);
        rps.reveal(gameId, move2, salt2);
    }

    // ─── Game Creation Tests ─────────────────────────────────────────────

    function test_createGame() public {
        uint256 gameId = _createGame(1 ether, 1);

        RPSGame.Game memory g = rps.getGame(gameId);
        assertEq(g.player1, player1);
        assertEq(g.player2, player2);
        assertEq(g.totalRounds, 1);
        assertEq(g.currentRound, 0);
        assertEq(uint8(g.phase), uint8(RPSGame.GamePhase.Commit));
        assertFalse(g.settled);
    }

    function test_createGame_revertEvenRounds() public {
        uint256 matchId = _createActiveEscrow(1 ether);

        vm.prank(player1);
        vm.expectRevert("RPSGame: rounds must be odd and > 0");
        rps.createGame(matchId, 2);
    }

    function test_createGame_revertZeroRounds() public {
        uint256 matchId = _createActiveEscrow(1 ether);

        vm.prank(player1);
        vm.expectRevert("RPSGame: rounds must be odd and > 0");
        rps.createGame(matchId, 0);
    }

    // ─── Single Round (Best of 1) Tests ──────────────────────────────────

    function test_bestOf1_rockBeatsScissors() public {
        uint256 gameId = _createGame(1 ether, 1);

        uint256 p1BalBefore = player1.balance;

        _playRound(gameId, RPSGame.Move.Rock, RPSGame.Move.Scissors);

        // player1 wins
        RPSGame.Game memory g = rps.getGame(gameId);
        assertTrue(g.settled);
        assertEq(uint8(g.phase), uint8(RPSGame.GamePhase.Complete));
        assertEq(player1.balance, p1BalBefore + 2 ether);
    }

    function test_bestOf1_paperBeatsRock() public {
        uint256 gameId = _createGame(1 ether, 1);

        uint256 p2BalBefore = player2.balance;

        _playRound(gameId, RPSGame.Move.Rock, RPSGame.Move.Paper);

        // player2 wins
        RPSGame.Game memory g = rps.getGame(gameId);
        assertTrue(g.settled);
        assertEq(player2.balance, p2BalBefore + 2 ether);
    }

    function test_bestOf1_scissorsBeatsPaper() public {
        uint256 gameId = _createGame(1 ether, 1);

        uint256 p1BalBefore = player1.balance;

        _playRound(gameId, RPSGame.Move.Scissors, RPSGame.Move.Paper);

        RPSGame.Game memory g = rps.getGame(gameId);
        assertTrue(g.settled);
        assertEq(player1.balance, p1BalBefore + 2 ether);
    }

    function test_bestOf1_draw() public {
        uint256 gameId = _createGame(1 ether, 1);

        uint256 p1BalBefore = player1.balance;
        uint256 p2BalBefore = player2.balance;

        _playRound(gameId, RPSGame.Move.Rock, RPSGame.Move.Rock);

        // Both get refunded
        RPSGame.Game memory g = rps.getGame(gameId);
        assertTrue(g.settled);
        assertEq(player1.balance, p1BalBefore + 1 ether);
        assertEq(player2.balance, p2BalBefore + 1 ether);
    }

    // ─── Best of 3 Tests ────────────────────────────────────────────────

    function test_bestOf3_winEarlyMajority() public {
        uint256 gameId = _createGame(1 ether, 3);

        // Round 1: player1 wins (Rock > Scissors)
        _playRound(gameId, RPSGame.Move.Rock, RPSGame.Move.Scissors);

        // Game should NOT be settled yet
        RPSGame.Game memory g = rps.getGame(gameId);
        assertFalse(g.settled);
        assertEq(g.p1Score, 1);
        assertEq(g.currentRound, 1);

        // Round 2: player1 wins again (Paper > Rock)
        uint256 p1BalBefore = player1.balance;
        _playRound(gameId, RPSGame.Move.Paper, RPSGame.Move.Rock);

        // Now player1 has 2 wins — majority in best-of-3
        g = rps.getGame(gameId);
        assertTrue(g.settled);
        assertEq(g.p1Score, 2);
        assertEq(player1.balance, p1BalBefore + 2 ether);
    }

    function test_bestOf3_goesToThreeRounds() public {
        uint256 gameId = _createGame(1 ether, 3);

        // Round 1: player1 wins
        _playRound(gameId, RPSGame.Move.Rock, RPSGame.Move.Scissors);
        // Round 2: player2 wins
        _playRound(gameId, RPSGame.Move.Rock, RPSGame.Move.Paper);

        RPSGame.Game memory g = rps.getGame(gameId);
        assertFalse(g.settled);
        assertEq(g.p1Score, 1);
        assertEq(g.p2Score, 1);

        // Round 3: player1 wins decisively
        uint256 p1BalBefore = player1.balance;
        _playRound(gameId, RPSGame.Move.Scissors, RPSGame.Move.Paper);

        g = rps.getGame(gameId);
        assertTrue(g.settled);
        assertEq(g.p1Score, 2);
        assertEq(player1.balance, p1BalBefore + 2 ether);
    }

    // ─── Commit / Reveal Validation ──────────────────────────────────────

    function test_commit_revertDoubleCommit() public {
        uint256 gameId = _createGame(1 ether, 1);

        vm.prank(player1);
        rps.commit(gameId, _commitHash(RPSGame.Move.Rock, salt1));

        vm.prank(player1);
        vm.expectRevert("RPSGame: already committed");
        rps.commit(gameId, _commitHash(RPSGame.Move.Paper, salt1));
    }

    function test_commit_revertNonParticipant() public {
        uint256 gameId = _createGame(1 ether, 1);

        address rando = makeAddr("rando");
        vm.prank(rando);
        vm.expectRevert("RPSGame: not a participant");
        rps.commit(gameId, _commitHash(RPSGame.Move.Rock, salt1));
    }

    function test_reveal_revertHashMismatch() public {
        uint256 gameId = _createGame(1 ether, 1);

        // Both commit
        vm.prank(player1);
        rps.commit(gameId, _commitHash(RPSGame.Move.Rock, salt1));
        vm.prank(player2);
        rps.commit(gameId, _commitHash(RPSGame.Move.Paper, salt2));

        // player1 tries to reveal different move
        vm.prank(player1);
        vm.expectRevert("RPSGame: hash mismatch");
        rps.reveal(gameId, RPSGame.Move.Paper, salt1); // committed Rock, revealing Paper
    }

    function test_reveal_revertMoveNone() public {
        uint256 gameId = _createGame(1 ether, 1);

        // Both commit
        vm.prank(player1);
        rps.commit(gameId, _commitHash(RPSGame.Move.Rock, salt1));
        vm.prank(player2);
        rps.commit(gameId, _commitHash(RPSGame.Move.Paper, salt2));

        vm.prank(player1);
        vm.expectRevert("RPSGame: invalid move");
        rps.reveal(gameId, RPSGame.Move.None, salt1);
    }

    function test_reveal_revertWrongPhase() public {
        uint256 gameId = _createGame(1 ether, 1);

        // Try to reveal before committing
        vm.prank(player1);
        vm.expectRevert("RPSGame: not in Reveal phase");
        rps.reveal(gameId, RPSGame.Move.Rock, salt1);
    }

    // ─── Timeout Tests ───────────────────────────────────────────────────

    function test_timeout_commitPhase_player1Committed() public {
        uint256 gameId = _createGame(1 ether, 1);

        // Only player1 commits
        vm.prank(player1);
        rps.commit(gameId, _commitHash(RPSGame.Move.Rock, salt1));

        // Warp past deadline
        vm.warp(block.timestamp + 5 minutes + 1);

        uint256 p1BalBefore = player1.balance;

        // player1 claims timeout
        vm.prank(player1);
        rps.claimTimeout(gameId);

        RPSGame.Game memory g = rps.getGame(gameId);
        assertTrue(g.settled);
        assertEq(player1.balance, p1BalBefore + 2 ether);
    }

    function test_timeout_revealPhase_player1Revealed() public {
        uint256 gameId = _createGame(1 ether, 1);

        // Both commit
        vm.prank(player1);
        rps.commit(gameId, _commitHash(RPSGame.Move.Rock, salt1));
        vm.prank(player2);
        rps.commit(gameId, _commitHash(RPSGame.Move.Paper, salt2));

        // Only player1 reveals
        vm.prank(player1);
        rps.reveal(gameId, RPSGame.Move.Rock, salt1);

        // Warp past deadline
        vm.warp(block.timestamp + 5 minutes + 1);

        uint256 p1BalBefore = player1.balance;

        vm.prank(player1);
        rps.claimTimeout(gameId);

        RPSGame.Game memory g = rps.getGame(gameId);
        assertTrue(g.settled);
        // player1 wins by timeout even though they played Rock vs Paper
        assertEq(player1.balance, p1BalBefore + 2 ether);
    }

    function test_timeout_revertBeforeDeadline() public {
        uint256 gameId = _createGame(1 ether, 1);

        vm.prank(player1);
        vm.expectRevert("RPSGame: deadline not passed");
        rps.claimTimeout(gameId);
    }

    function test_timeout_neitherCommitted_drawRefund() public {
        uint256 gameId = _createGame(1 ether, 1);

        // Warp past deadline without either committing
        vm.warp(block.timestamp + 5 minutes + 1);

        uint256 p1BalBefore = player1.balance;
        uint256 p2BalBefore = player2.balance;

        vm.prank(player1);
        rps.claimTimeout(gameId);

        // Both get refunded
        assertEq(player1.balance, p1BalBefore + 1 ether);
        assertEq(player2.balance, p2BalBefore + 1 ether);
    }

    // ─── ELO Update Integration ──────────────────────────────────────────

    function test_eloUpdateAfterMatch() public {
        uint256 gameId = _createGame(1 ether, 1);

        _playRound(gameId, RPSGame.Move.Rock, RPSGame.Move.Scissors);

        // player1 won — ELO should increase
        uint256 p1Elo = registry.elo(player1, AgentRegistry.GameType.RPS);
        uint256 p2Elo = registry.elo(player2, AgentRegistry.GameType.RPS);

        // Both started at 1000, winner gains, loser loses
        assertGt(p1Elo, 1000);
        assertLt(p2Elo, 1000);
    }

    function test_matchRecordAfterGame() public {
        uint256 gameId = _createGame(1 ether, 1);

        _playRound(gameId, RPSGame.Move.Rock, RPSGame.Move.Scissors);

        // Check match history
        assertEq(registry.getMatchCount(player1), 1);
        assertEq(registry.getMatchCount(player2), 1);

        AgentRegistry.MatchRecord[] memory p1History = registry.getMatchHistory(player1);
        assertTrue(p1History[0].won);

        AgentRegistry.MatchRecord[] memory p2History = registry.getMatchHistory(player2);
        assertFalse(p2History[0].won);
    }

    // ─── ERC-8004 Reputation Feedback Tests ─────────────────────────────

    function test_reputationFeedbackAfterMatch() public {
        // Set ERC-8004 agent IDs for both players
        rps.setAgentId(player1, 100);
        rps.setAgentId(player2, 200);

        uint256 gameId = _createGame(1 ether, 1);
        _playRound(gameId, RPSGame.Move.Rock, RPSGame.Move.Scissors);

        // player1 wins — should post 2 feedback calls (winner + loser)
        assertEq(mockReputation.feedbackCount(), 2);

        // Winner gets positive feedback
        MockReputationRegistry.FeedbackCall memory winFeedback = mockReputation.getFeedback(0);
        assertEq(winFeedback.agentId, 100);
        assertEq(winFeedback.value, int128(1));
        assertEq(winFeedback.valueDecimals, 0);
        assertEq(winFeedback.tag1, "RPS");
        assertEq(winFeedback.tag2, "win");

        // Loser gets negative feedback
        MockReputationRegistry.FeedbackCall memory loseFeedback = mockReputation.getFeedback(1);
        assertEq(loseFeedback.agentId, 200);
        assertEq(loseFeedback.value, int128(-1));
        assertEq(loseFeedback.tag1, "RPS");
        assertEq(loseFeedback.tag2, "loss");
    }

    function test_reputationFeedbackNotCalledOnDraw() public {
        // Set ERC-8004 agent IDs
        rps.setAgentId(player1, 100);
        rps.setAgentId(player2, 200);

        uint256 gameId = _createGame(1 ether, 1);
        _playRound(gameId, RPSGame.Move.Rock, RPSGame.Move.Rock);

        // Draw — no reputation feedback should be posted
        assertEq(mockReputation.feedbackCount(), 0);
    }

    function test_reputationFeedbackSkippedWithoutAgentIds() public {
        // Don't set agent IDs — feedback should be silently skipped
        uint256 gameId = _createGame(1 ether, 1);
        _playRound(gameId, RPSGame.Move.Rock, RPSGame.Move.Scissors);

        // No feedback calls because agentIds are 0
        assertEq(mockReputation.feedbackCount(), 0);
    }

    function test_reputationFeedbackSkippedWithoutRegistry() public {
        // Deploy RPSGame without reputation registry (address(0))
        RPSGame rpsNoRep = new RPSGame(address(escrow), address(registry), address(0));
        escrow.authorizeContract(address(rpsNoRep), true);
        registry.authorizeContract(address(rpsNoRep), true);

        // Create match using rpsNoRep
        vm.prank(player1);
        uint256 matchId = escrow.createMatch{value: 1 ether}(player2, address(rpsNoRep));
        vm.prank(player2);
        escrow.acceptMatch{value: 1 ether}(matchId);

        vm.prank(player1);
        uint256 gameId = rpsNoRep.createGame(matchId, 1);

        // Play round
        vm.prank(player1);
        rpsNoRep.commit(gameId, _commitHash(RPSGame.Move.Rock, salt1));
        vm.prank(player2);
        rpsNoRep.commit(gameId, _commitHash(RPSGame.Move.Scissors, salt2));
        vm.prank(player1);
        rpsNoRep.reveal(gameId, RPSGame.Move.Rock, salt1);
        vm.prank(player2);
        rpsNoRep.reveal(gameId, RPSGame.Move.Scissors, salt2);

        // Game settles without reverting (reputation feedback silently skipped)
        RPSGame.Game memory g = rpsNoRep.getGame(gameId);
        assertTrue(g.settled);
    }

    function test_setAgentId() public {
        rps.setAgentId(player1, 42);
        assertEq(rps.agentIds(player1), 42);
    }

    function test_setAgentId_revertNonOwner() public {
        vm.prank(player1);
        vm.expectRevert();
        rps.setAgentId(player1, 42);
    }

    // ─── All 9 Move Combinations ─────────────────────────────────────────

    function test_allMoveCombinations() public {
        // R vs R = draw, R vs P = P wins, R vs S = R wins
        // P vs R = P wins, P vs P = draw, P vs S = S wins
        // S vs R = R wins, S vs P = S wins, S vs S = draw

        RPSGame.Move[3] memory moves = [RPSGame.Move.Rock, RPSGame.Move.Paper, RPSGame.Move.Scissors];
        // expected winner: 0 = draw, 1 = player1, 2 = player2
        uint8[3][3] memory expected = [
            [uint8(0), uint8(2), uint8(1)], // Rock vs ...
            [uint8(1), uint8(0), uint8(2)], // Paper vs ...
            [uint8(2), uint8(1), uint8(0)]  // Scissors vs ...
        ];

        for (uint256 i = 0; i < 3; i++) {
            for (uint256 j = 0; j < 3; j++) {
                // Create a fresh game for each combination
                uint256 gameId = _createGame(0.01 ether, 1);
                _playRound(gameId, moves[i], moves[j]);

                RPSGame.Game memory g = rps.getGame(gameId);
                assertTrue(g.settled, "Game should be settled");

                if (expected[i][j] == 0) {
                    // Draw
                    assertEq(g.p1Score, 0);
                    assertEq(g.p2Score, 0);
                } else if (expected[i][j] == 1) {
                    // Player 1 wins
                    assertEq(g.p1Score, 1);
                } else {
                    // Player 2 wins
                    assertEq(g.p2Score, 1);
                }
            }
        }
    }
}
