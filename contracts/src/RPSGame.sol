// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./Escrow.sol";
import "./AgentRegistry.sol";

/// @title RPSGame — Commit-reveal Rock Paper Scissors with best-of-N rounds
/// @notice Players commit hashed moves, then reveal. After all rounds,
///         the contract settles via Escrow and updates ELO via AgentRegistry.
contract RPSGame is Ownable {
    // ─── Types ───────────────────────────────────────────────────────────

    enum Move { None, Rock, Paper, Scissors }

    enum GamePhase { Commit, Reveal, Complete }

    struct RoundData {
        bytes32 p1Commit;
        bytes32 p2Commit;
        Move p1Move;
        Move p2Move;
        bool p1Revealed;
        bool p2Revealed;
    }

    struct Game {
        uint256 escrowMatchId;  // linked escrow match
        address player1;
        address player2;
        uint256 totalRounds;    // best-of-N (odd number)
        uint256 currentRound;   // 0-indexed
        uint256 p1Score;
        uint256 p2Score;
        GamePhase phase;
        uint256 phaseDeadline;  // timestamp when current phase expires
        bool settled;           // has this game been settled?
    }

    // ─── Storage ─────────────────────────────────────────────────────────

    Escrow public escrow;
    AgentRegistry public registry;

    /// @dev Auto-incrementing game ID
    uint256 public nextGameId;

    /// @dev gameId => Game data
    mapping(uint256 => Game) public games;

    /// @dev gameId => roundIndex => RoundData
    mapping(uint256 => mapping(uint256 => RoundData)) public rounds;

    /// @dev Phase timeout duration (configurable by owner)
    uint256 public phaseTimeout = 5 minutes;

    // ─── Constants ───────────────────────────────────────────────────────

    /// @dev ELO K-factor for rating changes
    uint256 public constant ELO_K = 32;

    // ─── Events ──────────────────────────────────────────────────────────

    event GameCreated(uint256 indexed gameId, uint256 indexed escrowMatchId, address indexed player1, address player2, uint256 totalRounds);
    event MoveCommitted(uint256 indexed gameId, uint256 round, address indexed player);
    event MoveRevealed(uint256 indexed gameId, uint256 round, address indexed player, Move move);
    event RoundResult(uint256 indexed gameId, uint256 round, address winner); // winner=address(0) for draw
    event GameComplete(uint256 indexed gameId, address indexed winner); // winner=address(0) for draw
    event TimeoutClaimed(uint256 indexed gameId, address indexed claimer);

    // ─── Constructor ─────────────────────────────────────────────────────

    constructor(address _escrow, address _registry) Ownable(msg.sender) {
        escrow = Escrow(_escrow);
        registry = AgentRegistry(_registry);
    }

    // ─── Game Lifecycle ──────────────────────────────────────────────────

    /// @notice Create a new RPS game linked to an escrow match
    /// @param _escrowMatchId ID of the escrow match (must be Active)
    /// @param _totalRounds   Number of rounds (must be odd, >= 1)
    /// @return gameId        The ID of the new game
    function createGame(
        uint256 _escrowMatchId,
        uint256 _totalRounds
    ) external returns (uint256 gameId) {
        require(_totalRounds > 0 && _totalRounds % 2 == 1, "RPSGame: rounds must be odd and > 0");

        // Verify escrow match is Active and caller is a participant
        Escrow.Match memory m = escrow.getMatch(_escrowMatchId);
        require(m.status == Escrow.MatchStatus.Active, "RPSGame: escrow match not Active");
        require(
            msg.sender == m.player1 || msg.sender == m.player2,
            "RPSGame: not a participant"
        );
        require(m.gameContract == address(this), "RPSGame: escrow not linked to this game");

        gameId = nextGameId++;
        games[gameId] = Game({
            escrowMatchId: _escrowMatchId,
            player1: m.player1,
            player2: m.player2,
            totalRounds: _totalRounds,
            currentRound: 0,
            p1Score: 0,
            p2Score: 0,
            phase: GamePhase.Commit,
            phaseDeadline: block.timestamp + phaseTimeout,
            settled: false
        });

        emit GameCreated(gameId, _escrowMatchId, m.player1, m.player2, _totalRounds);
    }

    /// @notice Commit a hashed move for the current round
    /// @param _gameId Game ID
    /// @param _hash   keccak256(abi.encodePacked(uint8(move), salt))
    function commit(uint256 _gameId, bytes32 _hash) external {
        Game storage g = games[_gameId];
        require(g.phase == GamePhase.Commit, "RPSGame: not in Commit phase");
        require(!g.settled, "RPSGame: game already settled");
        require(block.timestamp <= g.phaseDeadline, "RPSGame: commit phase expired");

        RoundData storage r = rounds[_gameId][g.currentRound];

        if (msg.sender == g.player1) {
            require(r.p1Commit == bytes32(0), "RPSGame: already committed");
            r.p1Commit = _hash;
        } else if (msg.sender == g.player2) {
            require(r.p2Commit == bytes32(0), "RPSGame: already committed");
            r.p2Commit = _hash;
        } else {
            revert("RPSGame: not a participant");
        }

        emit MoveCommitted(_gameId, g.currentRound, msg.sender);

        // If both committed, move to Reveal phase
        if (r.p1Commit != bytes32(0) && r.p2Commit != bytes32(0)) {
            g.phase = GamePhase.Reveal;
            g.phaseDeadline = block.timestamp + phaseTimeout;
        }
    }

    /// @notice Reveal a move and salt for the current round
    /// @param _gameId Game ID
    /// @param _move   The actual move (Rock/Paper/Scissors)
    /// @param _salt   The salt used in the commit hash
    function reveal(uint256 _gameId, Move _move, bytes32 _salt) external {
        Game storage g = games[_gameId];
        require(g.phase == GamePhase.Reveal, "RPSGame: not in Reveal phase");
        require(!g.settled, "RPSGame: game already settled");
        require(block.timestamp <= g.phaseDeadline, "RPSGame: reveal phase expired");
        require(_move != Move.None, "RPSGame: invalid move");

        RoundData storage r = rounds[_gameId][g.currentRound];
        bytes32 expectedHash = keccak256(abi.encodePacked(uint8(_move), _salt));

        if (msg.sender == g.player1) {
            require(!r.p1Revealed, "RPSGame: already revealed");
            require(expectedHash == r.p1Commit, "RPSGame: hash mismatch");
            r.p1Move = _move;
            r.p1Revealed = true;
        } else if (msg.sender == g.player2) {
            require(!r.p2Revealed, "RPSGame: already revealed");
            require(expectedHash == r.p2Commit, "RPSGame: hash mismatch");
            r.p2Move = _move;
            r.p2Revealed = true;
        } else {
            revert("RPSGame: not a participant");
        }

        emit MoveRevealed(_gameId, g.currentRound, msg.sender, _move);

        // If both revealed, resolve the round
        if (r.p1Revealed && r.p2Revealed) {
            _resolveRound(_gameId);
        }
    }

    /// @notice Claim timeout if opponent hasn't acted within the deadline
    /// @dev Awards the match to the player who DID act on time
    function claimTimeout(uint256 _gameId) external {
        Game storage g = games[_gameId];
        require(!g.settled, "RPSGame: game already settled");
        require(block.timestamp > g.phaseDeadline, "RPSGame: deadline not passed");

        address winner;
        RoundData storage r = rounds[_gameId][g.currentRound];

        if (g.phase == GamePhase.Commit) {
            // Whoever committed gets the win; if neither committed, player1 can cancel
            if (r.p1Commit != bytes32(0) && r.p2Commit == bytes32(0)) {
                winner = g.player1;
            } else if (r.p2Commit != bytes32(0) && r.p1Commit == bytes32(0)) {
                winner = g.player2;
            } else {
                // Neither committed — treat as draw
                _settleGame(_gameId, address(0));
                emit TimeoutClaimed(_gameId, msg.sender);
                return;
            }
        } else if (g.phase == GamePhase.Reveal) {
            // Whoever revealed gets the win
            if (r.p1Revealed && !r.p2Revealed) {
                winner = g.player1;
            } else if (r.p2Revealed && !r.p1Revealed) {
                winner = g.player2;
            } else {
                // Neither revealed — treat as draw
                _settleGame(_gameId, address(0));
                emit TimeoutClaimed(_gameId, msg.sender);
                return;
            }
        } else {
            revert("RPSGame: game already complete");
        }

        // Settle with the winner (forfeit by timeout)
        _settleGame(_gameId, winner);
        emit TimeoutClaimed(_gameId, msg.sender);
    }

    // ─── View Functions ──────────────────────────────────────────────────

    /// @notice Get game details
    function getGame(uint256 _gameId) external view returns (Game memory) {
        return games[_gameId];
    }

    /// @notice Get round data for a specific game and round
    function getRound(uint256 _gameId, uint256 _round) external view returns (RoundData memory) {
        return rounds[_gameId][_round];
    }

    // ─── Owner Functions ─────────────────────────────────────────────────

    /// @notice Update the phase timeout duration
    function setPhaseTimeout(uint256 _timeout) external onlyOwner {
        require(_timeout >= 1 minutes, "RPSGame: timeout too short");
        phaseTimeout = _timeout;
    }

    // ─── Internal Functions ──────────────────────────────────────────────

    /// @dev Resolve a round after both players reveal, then advance or complete
    function _resolveRound(uint256 _gameId) internal {
        Game storage g = games[_gameId];
        RoundData storage r = rounds[_gameId][g.currentRound];

        // Determine round winner
        address roundWinner = _determineWinner(r.p1Move, r.p2Move, g.player1, g.player2);

        if (roundWinner == g.player1) {
            g.p1Score++;
        } else if (roundWinner == g.player2) {
            g.p2Score++;
        }
        // else: draw round, no score change

        emit RoundResult(_gameId, g.currentRound, roundWinner);

        // Check if someone has won enough rounds (majority)
        uint256 winsNeeded = (g.totalRounds / 2) + 1;

        if (g.p1Score >= winsNeeded) {
            _settleGame(_gameId, g.player1);
        } else if (g.p2Score >= winsNeeded) {
            _settleGame(_gameId, g.player2);
        } else if (g.currentRound + 1 >= g.totalRounds) {
            // All rounds played — determine winner by score
            if (g.p1Score > g.p2Score) {
                _settleGame(_gameId, g.player1);
            } else if (g.p2Score > g.p1Score) {
                _settleGame(_gameId, g.player2);
            } else {
                // Overall draw
                _settleGame(_gameId, address(0));
            }
        } else {
            // Advance to next round
            g.currentRound++;
            g.phase = GamePhase.Commit;
            g.phaseDeadline = block.timestamp + phaseTimeout;
        }
    }

    /// @dev Determine the winner of a single RPS round
    /// @return winner address (address(0) if draw)
    function _determineWinner(
        Move _p1Move,
        Move _p2Move,
        address _player1,
        address _player2
    ) internal pure returns (address winner) {
        if (_p1Move == _p2Move) return address(0); // draw

        // Rock beats Scissors, Scissors beats Paper, Paper beats Rock
        if (
            (_p1Move == Move.Rock && _p2Move == Move.Scissors) ||
            (_p1Move == Move.Scissors && _p2Move == Move.Paper) ||
            (_p1Move == Move.Paper && _p2Move == Move.Rock)
        ) {
            return _player1;
        }
        return _player2;
    }

    /// @dev Settle the game — update escrow, ELO, and match history
    function _settleGame(uint256 _gameId, address _winner) internal {
        Game storage g = games[_gameId];
        g.settled = true;
        g.phase = GamePhase.Complete;

        Escrow.Match memory m = escrow.getMatch(g.escrowMatchId);

        if (_winner == address(0)) {
            // Draw — refund both
            escrow.settleDraw(g.escrowMatchId);
        } else {
            // Winner takes all
            escrow.settle(g.escrowMatchId, _winner);
        }

        // Compute new ELO ratings
        address loser = _winner == g.player1 ? g.player2 : g.player1;

        if (_winner != address(0)) {
            uint256 winnerElo = registry.elo(_winner, AgentRegistry.GameType.RPS);
            uint256 loserElo = registry.elo(loser, AgentRegistry.GameType.RPS);

            (uint256 newWinnerElo, uint256 newLoserElo) = _calculateELO(winnerElo, loserElo);

            // Update ELO (only if agents are registered — don't revert if not)
            try registry.updateELO(_winner, AgentRegistry.GameType.RPS, newWinnerElo) {} catch {}
            try registry.updateELO(loser, AgentRegistry.GameType.RPS, newLoserElo) {} catch {}

            // Record match results
            try registry.recordMatch(_winner, loser, AgentRegistry.GameType.RPS, true, m.wager) {} catch {}
            try registry.recordMatch(loser, _winner, AgentRegistry.GameType.RPS, false, m.wager) {} catch {}
        }

        emit GameComplete(_gameId, _winner);
    }

    /// @dev Calculate new ELO ratings after a match
    /// @return newWinnerElo New ELO for the winner
    /// @return newLoserElo  New ELO for the loser
    function _calculateELO(
        uint256 _winnerElo,
        uint256 _loserElo
    ) internal pure returns (uint256 newWinnerElo, uint256 newLoserElo) {
        // Simplified ELO: winner gains K * (1 - expected), loser loses same amount
        // Expected score for winner = 1 / (1 + 10^((loserElo - winnerElo) / 400))
        // We approximate with integer math:
        //   delta = K * loserElo / (winnerElo + loserElo)
        // This is a reasonable approximation for small ELO differences

        uint256 total = _winnerElo + _loserElo;
        if (total == 0) total = 1; // safety

        uint256 delta = (ELO_K * _loserElo) / total;
        if (delta == 0) delta = 1; // minimum change

        newWinnerElo = _winnerElo + delta;
        // Prevent underflow: loser ELO doesn't go below 100
        newLoserElo = _loserElo > delta + 100 ? _loserElo - delta : 100;
    }
}
