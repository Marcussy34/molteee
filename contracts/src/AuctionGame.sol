// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./Escrow.sol";
import "./AgentRegistry.sol";
import "./interfaces/IReputationRegistry.sol";

/// @title AuctionGame — Sealed-bid auction with commit-reveal
/// @notice Two agents compete in a sealed-bid auction for a prize.
///         Both commit secret bids, then reveal. Higher bid wins the prize,
///         but pays their bid amount. Lower bidder keeps their bid.
///
/// Flow:
///   1. createGame() — links to an active escrow match. Prize = 2x escrow wager.
///   2. Both players commit bids (hash of bid amount + salt)
///   3. Both players reveal bids
///   4. Higher bidder wins: gets prize - their bid (net profit = prize - bid)
///      Lower bidder: gets their escrow wager back (no loss beyond opportunity cost)
///
/// Strategy depth:
///   - Bid too high → win but low profit
///   - Bid too low → lose the prize entirely
///   - Optimal bid requires modeling opponent's likely bid range
///   - This creates information-theoretic gameplay similar to first-price auctions
///
/// Bid constraints:
///   - Minimum bid: 1 wei (must bid something)
///   - Maximum bid: escrow wager amount (can't bid more than you deposited)
///   - Bids are in units relative to the escrow wager (percentage of wager)
contract AuctionGame is Ownable {
    // ─── Types ───────────────────────────────────────────────────────────

    enum GamePhase {
        Commit,    // Both players submit hashed bids
        Reveal,    // Both players reveal bid amounts
        Complete   // Auction settled
    }

    struct Game {
        uint256 escrowMatchId;
        address player1;
        address player2;
        // Bid commitments
        bytes32 p1Commit;
        bytes32 p2Commit;
        uint256 p1Bid;        // Revealed bid amount (in wei, up to escrow wager)
        uint256 p2Bid;
        bool p1Revealed;
        bool p2Revealed;
        // Prize is 2x the escrow wager (both players' stakes)
        uint256 prize;
        // Phase and timing
        GamePhase phase;
        uint256 phaseDeadline;
        bool settled;
    }

    // ─── Storage ─────────────────────────────────────────────────────────

    Escrow public escrow;
    AgentRegistry public registry;
    IReputationRegistry public reputationRegistry;

    uint256 public nextGameId;
    mapping(uint256 => Game) public games;

    uint256 public phaseTimeout = 5 minutes;

    uint256 public constant ELO_K = 32;

    // ─── Events ──────────────────────────────────────────────────────────

    event GameCreated(uint256 indexed gameId, uint256 indexed escrowMatchId, address indexed player1, address player2, uint256 prize);
    event BidCommitted(uint256 indexed gameId, address indexed player);
    event BidRevealed(uint256 indexed gameId, address indexed player, uint256 bid);
    event GameComplete(uint256 indexed gameId, address indexed winner, uint256 winnerBid, uint256 loserBid);
    event TimeoutClaimed(uint256 indexed gameId, address indexed claimer);
    event ReputationFeedback(uint256 indexed gameId, uint256 agentId, int128 value, string tag);

    // ─── Constructor ─────────────────────────────────────────────────────

    constructor(address _escrow, address _registry, address _reputationRegistry) Ownable(msg.sender) {
        escrow = Escrow(_escrow);
        registry = AgentRegistry(_registry);
        if (_reputationRegistry != address(0)) {
            reputationRegistry = IReputationRegistry(_reputationRegistry);
        }
    }

    // ─── Game Lifecycle ──────────────────────────────────────────────────

    /// @notice Create a new auction game linked to an escrow match
    function createGame(uint256 _escrowMatchId) external returns (uint256 gameId) {
        Escrow.Match memory m = escrow.getMatch(_escrowMatchId);
        require(m.status == Escrow.MatchStatus.Active, "AuctionGame: escrow not Active");
        require(msg.sender == m.player1 || msg.sender == m.player2, "AuctionGame: not a participant");
        require(m.gameContract == address(this), "AuctionGame: escrow not linked to this game");

        gameId = nextGameId++;

        Game storage g = games[gameId];
        g.escrowMatchId = _escrowMatchId;
        g.player1 = m.player1;
        g.player2 = m.player2;
        g.prize = m.wager * 2;
        g.phase = GamePhase.Commit;
        g.phaseDeadline = block.timestamp + phaseTimeout;

        emit GameCreated(gameId, _escrowMatchId, m.player1, m.player2, g.prize);
    }

    /// @notice Commit a hashed bid (keccak256(abi.encodePacked(uint256 bid, bytes32 salt)))
    function commitBid(uint256 _gameId, bytes32 _hash) external {
        Game storage g = games[_gameId];
        require(g.phase == GamePhase.Commit, "AuctionGame: not in Commit phase");
        require(!g.settled, "AuctionGame: game settled");
        require(block.timestamp <= g.phaseDeadline, "AuctionGame: commit expired");

        if (msg.sender == g.player1) {
            require(g.p1Commit == bytes32(0), "AuctionGame: already committed");
            g.p1Commit = _hash;
        } else if (msg.sender == g.player2) {
            require(g.p2Commit == bytes32(0), "AuctionGame: already committed");
            g.p2Commit = _hash;
        } else {
            revert("AuctionGame: not a participant");
        }

        emit BidCommitted(_gameId, msg.sender);

        // Both committed — move to reveal
        if (g.p1Commit != bytes32(0) && g.p2Commit != bytes32(0)) {
            g.phase = GamePhase.Reveal;
            g.phaseDeadline = block.timestamp + phaseTimeout;
        }
    }

    /// @notice Reveal bid amount and salt
    function revealBid(uint256 _gameId, uint256 _bid, bytes32 _salt) external {
        Game storage g = games[_gameId];
        require(g.phase == GamePhase.Reveal, "AuctionGame: not in Reveal phase");
        require(!g.settled, "AuctionGame: game settled");
        require(block.timestamp <= g.phaseDeadline, "AuctionGame: reveal expired");

        // Bid must be between 1 wei and the escrow wager amount
        Escrow.Match memory m = escrow.getMatch(g.escrowMatchId);
        require(_bid >= 1, "AuctionGame: bid must be >= 1");
        require(_bid <= m.wager, "AuctionGame: bid exceeds wager");

        bytes32 expectedHash = keccak256(abi.encodePacked(_bid, _salt));

        if (msg.sender == g.player1) {
            require(!g.p1Revealed, "AuctionGame: already revealed");
            require(expectedHash == g.p1Commit, "AuctionGame: hash mismatch");
            g.p1Bid = _bid;
            g.p1Revealed = true;
        } else if (msg.sender == g.player2) {
            require(!g.p2Revealed, "AuctionGame: already revealed");
            require(expectedHash == g.p2Commit, "AuctionGame: hash mismatch");
            g.p2Bid = _bid;
            g.p2Revealed = true;
        } else {
            revert("AuctionGame: not a participant");
        }

        emit BidRevealed(_gameId, msg.sender, _bid);

        // Both revealed — determine winner
        if (g.p1Revealed && g.p2Revealed) {
            if (g.p1Bid > g.p2Bid) {
                _settleGame(_gameId, g.player1);
            } else if (g.p2Bid > g.p1Bid) {
                _settleGame(_gameId, g.player2);
            } else {
                // Equal bids — draw
                _settleGame(_gameId, address(0));
            }
        }
    }

    /// @notice Claim timeout if opponent hasn't acted
    function claimTimeout(uint256 _gameId) external {
        Game storage g = games[_gameId];
        require(!g.settled, "AuctionGame: game settled");
        require(block.timestamp > g.phaseDeadline, "AuctionGame: deadline not passed");

        address winner;

        if (g.phase == GamePhase.Commit) {
            if (g.p1Commit != bytes32(0) && g.p2Commit == bytes32(0)) {
                winner = g.player1;
            } else if (g.p2Commit != bytes32(0) && g.p1Commit == bytes32(0)) {
                winner = g.player2;
            } else {
                _settleGame(_gameId, address(0));
                emit TimeoutClaimed(_gameId, msg.sender);
                return;
            }
        } else if (g.phase == GamePhase.Reveal) {
            if (g.p1Revealed && !g.p2Revealed) {
                winner = g.player1;
            } else if (g.p2Revealed && !g.p1Revealed) {
                winner = g.player2;
            } else {
                _settleGame(_gameId, address(0));
                emit TimeoutClaimed(_gameId, msg.sender);
                return;
            }
        } else {
            revert("AuctionGame: game already complete");
        }

        _settleGame(_gameId, winner);
        emit TimeoutClaimed(_gameId, msg.sender);
    }

    // ─── View Functions ──────────────────────────────────────────────────

    /// @dev View struct to avoid stack-too-deep
    struct GameView {
        uint256 escrowMatchId;
        address player1;
        address player2;
        uint256 prize;
        uint256 p1Bid;
        uint256 p2Bid;
        bool p1Committed;
        bool p2Committed;
        bool p1Revealed;
        bool p2Revealed;
        GamePhase phase;
        uint256 phaseDeadline;
        bool settled;
    }

    function getGame(uint256 _gameId) external view returns (GameView memory) {
        Game storage g = games[_gameId];
        return GameView({
            escrowMatchId: g.escrowMatchId,
            player1: g.player1,
            player2: g.player2,
            prize: g.prize,
            p1Bid: g.p1Bid,
            p2Bid: g.p2Bid,
            p1Committed: g.p1Commit != bytes32(0),
            p2Committed: g.p2Commit != bytes32(0),
            p1Revealed: g.p1Revealed,
            p2Revealed: g.p2Revealed,
            phase: g.phase,
            phaseDeadline: g.phaseDeadline,
            settled: g.settled
        });
    }

    // ─── Owner Functions ─────────────────────────────────────────────────

    function setPhaseTimeout(uint256 _timeout) external onlyOwner {
        require(_timeout >= 1 minutes, "AuctionGame: timeout too short");
        phaseTimeout = _timeout;
    }

    function setReputationRegistry(address _reputationRegistry) external onlyOwner {
        reputationRegistry = IReputationRegistry(_reputationRegistry);
    }

    // ─── Internal Functions ──────────────────────────────────────────────

    /// @dev Settle the auction — winner gets prize, pays their bid
    function _settleGame(uint256 _gameId, address _winner) internal {
        Game storage g = games[_gameId];
        g.settled = true;
        g.phase = GamePhase.Complete;

        Escrow.Match memory m = escrow.getMatch(g.escrowMatchId);

        if (_winner == address(0)) {
            // Draw or timeout with neither acting — refund both
            escrow.settleDraw(g.escrowMatchId);
        } else {
            // Winner gets the prize via escrow
            escrow.settle(g.escrowMatchId, _winner);
        }

        // Update ELO and records
        address loser = _winner == g.player1 ? g.player2 : g.player1;

        if (_winner != address(0)) {
            uint256 winnerElo = registry.elo(_winner, AgentRegistry.GameType.Auction);
            uint256 loserElo = registry.elo(loser, AgentRegistry.GameType.Auction);

            (uint256 newWinnerElo, uint256 newLoserElo) = _calculateELO(winnerElo, loserElo);

            try registry.updateELO(_winner, AgentRegistry.GameType.Auction, newWinnerElo) {} catch {}
            try registry.updateELO(loser, AgentRegistry.GameType.Auction, newLoserElo) {} catch {}

            try registry.recordMatch(_winner, loser, AgentRegistry.GameType.Auction, true, m.wager) {} catch {}
            try registry.recordMatch(loser, _winner, AgentRegistry.GameType.Auction, false, m.wager) {} catch {}

            _postReputationFeedback(_gameId, _winner, loser);
        }

        emit GameComplete(_gameId, _winner, g.p1Bid, g.p2Bid);
    }

    function _postReputationFeedback(uint256 _gameId, address _winner, address _loser) internal {
        if (address(reputationRegistry) == address(0)) return;

        // Lookup ERC-8004 agent IDs from centralized AgentRegistry
        uint256 winnerAgentId = registry.getAgentId(_winner);
        uint256 loserAgentId = registry.getAgentId(_loser);

        if (winnerAgentId != 0) {
            try reputationRegistry.giveFeedback(
                winnerAgentId, int128(1), 0, "Auction", "win", "", "", bytes32(0)
            ) {
                emit ReputationFeedback(_gameId, winnerAgentId, int128(1), "win");
            } catch {}
        }

        if (loserAgentId != 0) {
            try reputationRegistry.giveFeedback(
                loserAgentId, int128(-1), 0, "Auction", "loss", "", "", bytes32(0)
            ) {
                emit ReputationFeedback(_gameId, loserAgentId, int128(-1), "loss");
            } catch {}
        }
    }

    function _calculateELO(
        uint256 _winnerElo,
        uint256 _loserElo
    ) internal pure returns (uint256 newWinnerElo, uint256 newLoserElo) {
        uint256 total = _winnerElo + _loserElo;
        if (total == 0) total = 1;

        uint256 delta = (ELO_K * _loserElo) / total;
        if (delta == 0) delta = 1;

        newWinnerElo = _winnerElo + delta;
        newLoserElo = _loserElo > delta + 100 ? _loserElo - delta : 100;
    }
}
