// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import "../src/AgentRegistry.sol";
import "../src/Escrow.sol";
import "../src/AuctionGame.sol";
import "../src/interfaces/IReputationRegistry.sol";

/// @dev Mock ERC-8004 Reputation Registry for testing
contract MockReputationRegistry3 is IReputationRegistry {
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

contract AuctionGameTest is Test {
    AgentRegistry public registry;
    Escrow public escrow;
    AuctionGame public auction;
    MockReputationRegistry3 public mockReputation;

    address public owner = address(this);
    address public player1;
    address public player2;

    bytes32 public salt1 = keccak256("auctionsalt1");
    bytes32 public salt2 = keccak256("auctionsalt2");

    function setUp() public {
        player1 = makeAddr("player1");
        player2 = makeAddr("player2");

        registry = new AgentRegistry();
        escrow = new Escrow();
        mockReputation = new MockReputationRegistry3();
        auction = new AuctionGame(address(escrow), address(registry), address(mockReputation));

        escrow.authorizeContract(address(auction), true);
        registry.authorizeContract(address(auction), true);

        vm.deal(player1, 100 ether);
        vm.deal(player2, 100 ether);

        // Register for Auction
        AgentRegistry.GameType[] memory gameTypes = new AgentRegistry.GameType[](1);
        gameTypes[0] = AgentRegistry.GameType.Auction;

        vm.prank(player1);
        registry.register(gameTypes, 0.001 ether, 10 ether);
        vm.prank(player2);
        registry.register(gameTypes, 0.001 ether, 10 ether);
    }

    // ─── Helpers ─────────────────────────────────────────────────────────

    function _createActiveEscrow(uint256 wager) internal returns (uint256 matchId) {
        vm.prank(player1);
        matchId = escrow.createMatch{value: wager}(player2, address(auction));
        vm.prank(player2);
        escrow.acceptMatch{value: wager}(matchId);
    }

    function _createGame(uint256 wager) internal returns (uint256 gameId) {
        uint256 matchId = _createActiveEscrow(wager);
        vm.prank(player1);
        gameId = auction.createGame(matchId);
    }

    function _bidHash(uint256 bid, bytes32 salt) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(bid, salt));
    }

    function _commitBothBids(uint256 gameId, uint256 bid1, uint256 bid2) internal {
        vm.prank(player1);
        auction.commitBid(gameId, _bidHash(bid1, salt1));
        vm.prank(player2);
        auction.commitBid(gameId, _bidHash(bid2, salt2));
    }

    function _revealBothBids(uint256 gameId, uint256 bid1, uint256 bid2) internal {
        vm.prank(player1);
        auction.revealBid(gameId, bid1, salt1);
        vm.prank(player2);
        auction.revealBid(gameId, bid2, salt2);
    }

    // ─── Game Creation Tests ─────────────────────────────────────────────

    function test_createGame() public {
        uint256 gameId = _createGame(1 ether);

        AuctionGame.GameView memory g = auction.getGame(gameId);

        assertEq(g.player1, player1);
        assertEq(g.player2, player2);
        assertEq(g.prize, 2 ether);
        assertEq(uint8(g.phase), uint8(AuctionGame.GamePhase.Commit));
        assertFalse(g.settled);
    }

    // ─── Commit Phase Tests ──────────────────────────────────────────────

    function test_commitBid() public {
        uint256 gameId = _createGame(1 ether);

        vm.prank(player1);
        auction.commitBid(gameId, _bidHash(0.5 ether, salt1));

        AuctionGame.GameView memory g = auction.getGame(gameId);
        assertEq(uint8(g.phase), uint8(AuctionGame.GamePhase.Commit));
        assertTrue(g.p1Committed);
        assertFalse(g.p2Committed);
    }

    function test_bothCommit_advancesToReveal() public {
        uint256 gameId = _createGame(1 ether);
        _commitBothBids(gameId, 0.5 ether, 0.7 ether);

        AuctionGame.GameView memory g = auction.getGame(gameId);
        assertEq(uint8(g.phase), uint8(AuctionGame.GamePhase.Reveal));
    }

    function test_commit_revertDoubleCommit() public {
        uint256 gameId = _createGame(1 ether);

        vm.prank(player1);
        auction.commitBid(gameId, _bidHash(0.5 ether, salt1));

        vm.prank(player1);
        vm.expectRevert("AuctionGame: already committed");
        auction.commitBid(gameId, _bidHash(0.6 ether, salt1));
    }

    // ─── Reveal + Winner Tests ───────────────────────────────────────────

    function test_higherBidWins() public {
        uint256 gameId = _createGame(1 ether);
        _commitBothBids(gameId, 0.8 ether, 0.5 ether);

        uint256 p1BalBefore = player1.balance;

        _revealBothBids(gameId, 0.8 ether, 0.5 ether);

        // Player1 bid higher → wins prize (2 ETH via escrow)
        AuctionGame.GameView memory g = auction.getGame(gameId);
        assertTrue(g.settled);
        assertEq(player1.balance, p1BalBefore + 2 ether);
    }

    function test_lowerBidLoses() public {
        uint256 gameId = _createGame(1 ether);
        _commitBothBids(gameId, 0.3 ether, 0.9 ether);

        uint256 p2BalBefore = player2.balance;

        _revealBothBids(gameId, 0.3 ether, 0.9 ether);

        // Player2 bid higher → wins
        AuctionGame.GameView memory g = auction.getGame(gameId);
        assertTrue(g.settled);
        assertEq(player2.balance, p2BalBefore + 2 ether);
    }

    function test_equalBids_draw() public {
        uint256 gameId = _createGame(1 ether);
        _commitBothBids(gameId, 0.5 ether, 0.5 ether);

        uint256 p1BalBefore = player1.balance;
        uint256 p2BalBefore = player2.balance;

        _revealBothBids(gameId, 0.5 ether, 0.5 ether);

        AuctionGame.GameView memory g = auction.getGame(gameId);
        assertTrue(g.settled);
        // Both get refunded
        assertEq(player1.balance, p1BalBefore + 1 ether);
        assertEq(player2.balance, p2BalBefore + 1 ether);
    }

    function test_reveal_revertHashMismatch() public {
        uint256 gameId = _createGame(1 ether);
        _commitBothBids(gameId, 0.5 ether, 0.7 ether);

        vm.prank(player1);
        vm.expectRevert("AuctionGame: hash mismatch");
        auction.revealBid(gameId, 0.9 ether, salt1); // Committed 0.5, revealing 0.9
    }

    function test_reveal_revertBidTooHigh() public {
        uint256 gameId = _createGame(1 ether);

        // Commit a bid of 2 ether (exceeds wager)
        bytes32 hash = _bidHash(2 ether, salt1);
        vm.prank(player1);
        auction.commitBid(gameId, hash);
        vm.prank(player2);
        auction.commitBid(gameId, _bidHash(0.5 ether, salt2));

        vm.prank(player1);
        vm.expectRevert("AuctionGame: bid exceeds wager");
        auction.revealBid(gameId, 2 ether, salt1);
    }

    function test_reveal_revertBidZero() public {
        uint256 gameId = _createGame(1 ether);

        bytes32 hash = _bidHash(0, salt1);
        vm.prank(player1);
        auction.commitBid(gameId, hash);
        vm.prank(player2);
        auction.commitBid(gameId, _bidHash(0.5 ether, salt2));

        vm.prank(player1);
        vm.expectRevert("AuctionGame: bid must be >= 1");
        auction.revealBid(gameId, 0, salt1);
    }

    // ─── Timeout Tests ───────────────────────────────────────────────────

    function test_timeout_commitPhase() public {
        uint256 gameId = _createGame(1 ether);

        vm.prank(player1);
        auction.commitBid(gameId, _bidHash(0.5 ether, salt1));

        vm.warp(block.timestamp + 5 minutes + 1);

        uint256 p1BalBefore = player1.balance;

        vm.prank(player1);
        auction.claimTimeout(gameId);

        AuctionGame.GameView memory g = auction.getGame(gameId);
        assertTrue(g.settled);
        assertEq(player1.balance, p1BalBefore + 2 ether);
    }

    function test_timeout_revealPhase() public {
        uint256 gameId = _createGame(1 ether);
        _commitBothBids(gameId, 0.5 ether, 0.7 ether);

        // Only player1 reveals
        vm.prank(player1);
        auction.revealBid(gameId, 0.5 ether, salt1);

        vm.warp(block.timestamp + 5 minutes + 1);

        uint256 p1BalBefore = player1.balance;

        vm.prank(player1);
        auction.claimTimeout(gameId);

        AuctionGame.GameView memory g = auction.getGame(gameId);
        assertTrue(g.settled);
        assertEq(player1.balance, p1BalBefore + 2 ether);
    }

    function test_timeout_neitherCommitted_draw() public {
        uint256 gameId = _createGame(1 ether);

        vm.warp(block.timestamp + 5 minutes + 1);

        uint256 p1BalBefore = player1.balance;
        uint256 p2BalBefore = player2.balance;

        vm.prank(player1);
        auction.claimTimeout(gameId);

        assertEq(player1.balance, p1BalBefore + 1 ether);
        assertEq(player2.balance, p2BalBefore + 1 ether);
    }

    // ─── ELO & Match History Tests ───────────────────────────────────────

    function test_eloUpdateAfterAuction() public {
        uint256 gameId = _createGame(1 ether);
        _commitBothBids(gameId, 0.8 ether, 0.3 ether);
        _revealBothBids(gameId, 0.8 ether, 0.3 ether);

        uint256 p1Elo = registry.elo(player1, AgentRegistry.GameType.Auction);
        uint256 p2Elo = registry.elo(player2, AgentRegistry.GameType.Auction);

        assertGt(p1Elo, 1000);
        assertLt(p2Elo, 1000);
    }

    function test_matchRecordAfterAuction() public {
        uint256 gameId = _createGame(1 ether);
        _commitBothBids(gameId, 0.8 ether, 0.3 ether);
        _revealBothBids(gameId, 0.8 ether, 0.3 ether);

        assertEq(registry.getMatchCount(player1), 1);
        AgentRegistry.MatchRecord[] memory p1History = registry.getMatchHistory(player1);
        assertTrue(p1History[0].won);
        assertEq(uint8(p1History[0].gameType), uint8(AgentRegistry.GameType.Auction));
    }

    // ─── Reputation Tests ────────────────────────────────────────────────

    function test_reputationFeedbackAfterAuction() public {
        registry.setAgentIdFor(player1, 100);
        registry.setAgentIdFor(player2, 200);

        uint256 gameId = _createGame(1 ether);
        _commitBothBids(gameId, 0.8 ether, 0.3 ether);
        _revealBothBids(gameId, 0.8 ether, 0.3 ether);

        assertEq(mockReputation.feedbackCount(), 2);

        MockReputationRegistry3.FeedbackCall memory winFeedback = mockReputation.getFeedback(0);
        assertEq(winFeedback.agentId, 100);
        assertEq(winFeedback.value, int128(1));
        assertEq(keccak256(bytes(winFeedback.tag1)), keccak256(bytes("Auction")));
    }

    // ─── Minimum Bid (1 wei) Test ────────────────────────────────────────

    function test_minimumBid() public {
        uint256 gameId = _createGame(1 ether);
        _commitBothBids(gameId, 1, 2); // 1 wei vs 2 wei

        _revealBothBids(gameId, 1, 2);

        AuctionGame.GameView memory g = auction.getGame(gameId);
        assertTrue(g.settled);
        assertEq(g.p1Bid, 1);
        assertEq(g.p2Bid, 2);
    }
}
