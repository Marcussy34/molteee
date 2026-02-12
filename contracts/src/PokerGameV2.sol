// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./Escrow.sol";
import "./AgentRegistry.sol";
import "./interfaces/IReputationRegistry.sol";

/// @title PokerGameV2 — Budget Poker: multi-round commit-reveal poker with hand budget
/// @notice Best-of-3 rounds. Players share a 150-point budget across rounds.
///         Each round: commit hand value (1-100) → bet → bet → reveal → resolve.
///         Higher hand wins the round. First to 2 round wins takes the match.
///         Budget forces resource allocation strategy — can't always pick 100.
///
/// Key design:
///   - Starting budget: 150 points (avg 50/round, max 100/round)
///   - Budget deducted on reveal only (fold = no deduction, budget preserved)
///   - Must reserve ≥1 point per remaining round after current
///   - Extra bets (MON) accumulate across rounds — overall winner gets all
///   - Fold concedes the round immediately (opponent wins that round)
///   - Draw rounds (equal hands) = no score change
contract PokerGameV2 is Ownable {
    // ─── Types ───────────────────────────────────────────────────────────

    /// @dev Game phases for each round
    enum GamePhase {
        Commit,         // Both players commit hand values
        BettingRound1,  // First betting round
        BettingRound2,  // Second betting round
        Showdown,       // Both players reveal hand values
        Complete        // Game settled (final)
    }

    enum Action {
        None,
        Check,   // Pass without betting (only if no active bet)
        Bet,     // Place a bet (only if no active bet in this round)
        Raise,   // Increase the current bet
        Call,    // Match the current bet
        Fold     // Forfeit the current round (not the match)
    }

    /// @dev Per-round state (betting + commit-reveal data)
    struct RoundData {
        bytes32 p1Commit;
        bytes32 p2Commit;
        uint8 p1HandValue;    // Revealed hand value (1-100)
        uint8 p2HandValue;
        bool p1Committed;
        bool p2Committed;
        bool p1Revealed;
        bool p2Revealed;
        // Betting state for this round
        uint256 currentBet;    // Current bet to match
        address lastBettor;    // Who placed the last bet/raise (or first check)
        uint8 betsThisRound;   // Number of bets/raises (max 2)
        address currentTurn;   // Whose turn it is
    }

    /// @dev Top-level game state
    struct Game {
        uint256 escrowMatchId;
        address player1;
        address player2;
        // Round tracking
        uint256 totalRounds;     // Always 3
        uint256 currentRound;    // 0-indexed
        uint256 p1Score;
        uint256 p2Score;
        // Budget tracking
        uint256 startingBudget;  // Always 150
        uint256 p1Budget;
        uint256 p2Budget;
        // Extra bets accumulate across all rounds (real MON)
        uint256 p1ExtraBets;
        uint256 p2ExtraBets;
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
    mapping(uint256 => mapping(uint256 => RoundData)) public rounds;

    uint256 public phaseTimeout = 5 minutes;

    // ─── Constants ───────────────────────────────────────────────────────

    uint256 public constant TOTAL_ROUNDS = 3;
    uint256 public constant STARTING_BUDGET = 150;
    uint256 public constant WINS_NEEDED = 2; // First to 2 wins
    uint256 public constant ELO_K = 32;
    uint256 public constant MAX_BET_MULTIPLIER = 2; // Max bet = 2x escrow wager

    // ─── Events ──────────────────────────────────────────────────────────

    event GameCreated(uint256 indexed gameId, uint256 indexed escrowMatchId, address indexed player1, address player2);
    event HandCommitted(uint256 indexed gameId, uint256 round, address indexed player);
    event ActionTaken(uint256 indexed gameId, uint256 round, address indexed player, Action action, uint256 amount);
    event HandRevealed(uint256 indexed gameId, uint256 round, address indexed player, uint8 handValue);
    event RoundResult(uint256 indexed gameId, uint256 round, address winner, uint256 p1Score, uint256 p2Score);
    event GameComplete(uint256 indexed gameId, address indexed winner);
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

    /// @notice Create a new Budget Poker game linked to an escrow match
    function createGame(uint256 _escrowMatchId) external returns (uint256 gameId) {
        Escrow.Match memory m = escrow.getMatch(_escrowMatchId);
        require(m.status == Escrow.MatchStatus.Active, "PokerV2: escrow not Active");
        require(msg.sender == m.player1 || msg.sender == m.player2, "PokerV2: not a participant");
        require(m.gameContract == address(this), "PokerV2: escrow not linked to this game");

        gameId = nextGameId++;

        Game storage g = games[gameId];
        g.escrowMatchId = _escrowMatchId;
        g.player1 = m.player1;
        g.player2 = m.player2;
        g.totalRounds = TOTAL_ROUNDS;
        g.currentRound = 0;
        g.startingBudget = STARTING_BUDGET;
        g.p1Budget = STARTING_BUDGET;
        g.p2Budget = STARTING_BUDGET;
        g.phase = GamePhase.Commit;
        g.phaseDeadline = block.timestamp + phaseTimeout;

        // Set player1 as first to act in betting rounds
        rounds[gameId][0].currentTurn = m.player1;

        emit GameCreated(gameId, _escrowMatchId, m.player1, m.player2);
    }

    /// @notice Commit a hand value (hash of value + salt) for the current round
    function commitHand(uint256 _gameId, bytes32 _hash) external {
        Game storage g = games[_gameId];
        require(g.phase == GamePhase.Commit, "PokerV2: not in Commit phase");
        require(!g.settled, "PokerV2: game settled");
        require(block.timestamp <= g.phaseDeadline, "PokerV2: commit expired");

        RoundData storage r = rounds[_gameId][g.currentRound];

        if (msg.sender == g.player1) {
            require(!r.p1Committed, "PokerV2: already committed");
            r.p1Commit = _hash;
            r.p1Committed = true;
        } else if (msg.sender == g.player2) {
            require(!r.p2Committed, "PokerV2: already committed");
            r.p2Commit = _hash;
            r.p2Committed = true;
        } else {
            revert("PokerV2: not a participant");
        }

        emit HandCommitted(_gameId, g.currentRound, msg.sender);

        // Both committed — move to betting round 1
        if (r.p1Committed && r.p2Committed) {
            g.phase = GamePhase.BettingRound1;
            g.phaseDeadline = block.timestamp + phaseTimeout;
            r.currentTurn = g.player1;
            r.currentBet = 0;
            r.betsThisRound = 0;
            r.lastBettor = address(0);
        }
    }

    /// @notice Take a betting action (check, bet, raise, call, fold)
    /// @dev For bet/raise, send the amount as msg.value
    function takeAction(uint256 _gameId, Action _action) external payable {
        Game storage g = games[_gameId];
        require(!g.settled, "PokerV2: game settled");
        require(
            g.phase == GamePhase.BettingRound1 || g.phase == GamePhase.BettingRound2,
            "PokerV2: not in betting phase"
        );
        require(block.timestamp <= g.phaseDeadline, "PokerV2: phase expired");

        RoundData storage r = rounds[_gameId][g.currentRound];
        require(msg.sender == r.currentTurn, "PokerV2: not your turn");
        require(_action != Action.None, "PokerV2: invalid action");

        address opponent = msg.sender == g.player1 ? g.player2 : g.player1;

        if (_action == Action.Fold) {
            // Fold = opponent wins this round, no reveal needed, budget preserved
            emit ActionTaken(_gameId, g.currentRound, msg.sender, Action.Fold, 0);
            _resolveRoundWithWinner(_gameId, opponent);
            return;
        }

        if (_action == Action.Check) {
            require(r.currentBet == 0, "PokerV2: cannot check with active bet");
            emit ActionTaken(_gameId, g.currentRound, msg.sender, Action.Check, 0);

            // If both checked (lastBettor was set to first checker), advance
            if (r.lastBettor == opponent) {
                _advanceBettingPhase(_gameId);
            } else {
                r.lastBettor = msg.sender;
                r.currentTurn = opponent;
                g.phaseDeadline = block.timestamp + phaseTimeout;
            }
            return;
        }

        if (_action == Action.Bet) {
            require(r.currentBet == 0, "PokerV2: bet already active, use raise");
            require(msg.value > 0, "PokerV2: bet must be > 0");

            // Cap bet at MAX_BET_MULTIPLIER * escrow wager
            Escrow.Match memory m = escrow.getMatch(g.escrowMatchId);
            require(msg.value <= m.wager * MAX_BET_MULTIPLIER, "PokerV2: bet too large");

            r.currentBet = msg.value;
            r.lastBettor = msg.sender;
            r.betsThisRound++;

            // Track extra bets per player (accumulated across rounds)
            if (msg.sender == g.player1) {
                g.p1ExtraBets += msg.value;
            } else {
                g.p2ExtraBets += msg.value;
            }

            emit ActionTaken(_gameId, g.currentRound, msg.sender, Action.Bet, msg.value);

            r.currentTurn = opponent;
            g.phaseDeadline = block.timestamp + phaseTimeout;
            return;
        }

        if (_action == Action.Raise) {
            require(r.currentBet > 0, "PokerV2: no bet to raise, use bet");
            require(r.betsThisRound < 2, "PokerV2: max raises reached");
            require(msg.value > r.currentBet, "PokerV2: raise must exceed current bet");

            Escrow.Match memory m = escrow.getMatch(g.escrowMatchId);
            require(msg.value <= m.wager * MAX_BET_MULTIPLIER, "PokerV2: raise too large");

            r.currentBet = msg.value;
            r.lastBettor = msg.sender;
            r.betsThisRound++;

            if (msg.sender == g.player1) {
                g.p1ExtraBets += msg.value;
            } else {
                g.p2ExtraBets += msg.value;
            }

            emit ActionTaken(_gameId, g.currentRound, msg.sender, Action.Raise, msg.value);

            r.currentTurn = opponent;
            g.phaseDeadline = block.timestamp + phaseTimeout;
            return;
        }

        if (_action == Action.Call) {
            require(r.currentBet > 0, "PokerV2: nothing to call");
            require(msg.value == r.currentBet, "PokerV2: must match current bet");

            if (msg.sender == g.player1) {
                g.p1ExtraBets += msg.value;
            } else {
                g.p2ExtraBets += msg.value;
            }

            emit ActionTaken(_gameId, g.currentRound, msg.sender, Action.Call, msg.value);

            // Call closes the betting round — advance
            _advanceBettingPhase(_gameId);
            return;
        }

        revert("PokerV2: invalid action");
    }

    /// @notice Reveal hand value and salt for the current round
    function revealHand(uint256 _gameId, uint8 _handValue, bytes32 _salt) external {
        Game storage g = games[_gameId];
        require(g.phase == GamePhase.Showdown, "PokerV2: not in Showdown phase");
        require(!g.settled, "PokerV2: game settled");
        require(block.timestamp <= g.phaseDeadline, "PokerV2: reveal expired");
        require(_handValue >= 1 && _handValue <= 100, "PokerV2: hand must be 1-100");

        RoundData storage r = rounds[_gameId][g.currentRound];
        bytes32 expectedHash = keccak256(abi.encodePacked(_handValue, _salt));

        if (msg.sender == g.player1) {
            require(!r.p1Revealed, "PokerV2: already revealed");
            require(expectedHash == r.p1Commit, "PokerV2: hash mismatch");

            // Budget validation: must have enough budget, reserving 1 per future round
            uint256 roundsAfter = g.totalRounds - g.currentRound - 1;
            require(_handValue <= g.p1Budget - roundsAfter, "PokerV2: exceeds budget");

            r.p1HandValue = _handValue;
            r.p1Revealed = true;
            // Deduct budget on reveal
            g.p1Budget -= _handValue;
        } else if (msg.sender == g.player2) {
            require(!r.p2Revealed, "PokerV2: already revealed");
            require(expectedHash == r.p2Commit, "PokerV2: hash mismatch");

            uint256 roundsAfter = g.totalRounds - g.currentRound - 1;
            require(_handValue <= g.p2Budget - roundsAfter, "PokerV2: exceeds budget");

            r.p2HandValue = _handValue;
            r.p2Revealed = true;
            g.p2Budget -= _handValue;
        } else {
            revert("PokerV2: not a participant");
        }

        emit HandRevealed(_gameId, g.currentRound, msg.sender, _handValue);

        // Both revealed — resolve the round
        if (r.p1Revealed && r.p2Revealed) {
            _resolveRound(_gameId);
        }
    }

    /// @notice Claim timeout if opponent hasn't acted within deadline
    function claimTimeout(uint256 _gameId) external {
        Game storage g = games[_gameId];
        require(!g.settled, "PokerV2: game settled");
        require(block.timestamp > g.phaseDeadline, "PokerV2: deadline not passed");

        RoundData storage r = rounds[_gameId][g.currentRound];
        address winner;

        if (g.phase == GamePhase.Commit) {
            if (r.p1Committed && !r.p2Committed) {
                winner = g.player1;
            } else if (r.p2Committed && !r.p1Committed) {
                winner = g.player2;
            } else {
                // Neither or both committed — draw the match
                _settleGame(_gameId, address(0));
                emit TimeoutClaimed(_gameId, msg.sender);
                return;
            }
        } else if (g.phase == GamePhase.BettingRound1 || g.phase == GamePhase.BettingRound2) {
            // The player whose turn it is timed out — opponent wins the match
            winner = r.currentTurn == g.player1 ? g.player2 : g.player1;
        } else if (g.phase == GamePhase.Showdown) {
            if (r.p1Revealed && !r.p2Revealed) {
                winner = g.player1;
            } else if (r.p2Revealed && !r.p1Revealed) {
                winner = g.player2;
            } else {
                _settleGame(_gameId, address(0));
                emit TimeoutClaimed(_gameId, msg.sender);
                return;
            }
        } else {
            revert("PokerV2: game already complete");
        }

        // Timeout = immediate match loss (not just round loss)
        _settleGame(_gameId, winner);
        emit TimeoutClaimed(_gameId, msg.sender);
    }

    // ─── View Functions ──────────────────────────────────────────────────

    /// @dev View struct to avoid stack-too-deep
    struct GameView {
        uint256 escrowMatchId;
        address player1;
        address player2;
        uint256 totalRounds;
        uint256 currentRound;
        uint256 p1Score;
        uint256 p2Score;
        uint256 startingBudget;
        uint256 p1Budget;
        uint256 p2Budget;
        uint256 p1ExtraBets;
        uint256 p2ExtraBets;
        GamePhase phase;
        uint256 phaseDeadline;
        bool settled;
        // Current round state (convenience — avoids separate getRound call)
        uint256 currentBet;
        address currentTurn;
        bool p1Committed;
        bool p2Committed;
        bool p1Revealed;
        bool p2Revealed;
    }

    /// @notice Get full game state
    function getGame(uint256 _gameId) external view returns (GameView memory) {
        Game storage g = games[_gameId];
        RoundData storage r = rounds[_gameId][g.currentRound];
        return GameView({
            escrowMatchId: g.escrowMatchId,
            player1: g.player1,
            player2: g.player2,
            totalRounds: g.totalRounds,
            currentRound: g.currentRound,
            p1Score: g.p1Score,
            p2Score: g.p2Score,
            startingBudget: g.startingBudget,
            p1Budget: g.p1Budget,
            p2Budget: g.p2Budget,
            p1ExtraBets: g.p1ExtraBets,
            p2ExtraBets: g.p2ExtraBets,
            phase: g.phase,
            phaseDeadline: g.phaseDeadline,
            settled: g.settled,
            currentBet: r.currentBet,
            currentTurn: r.currentTurn,
            p1Committed: r.p1Committed,
            p2Committed: r.p2Committed,
            p1Revealed: r.p1Revealed,
            p2Revealed: r.p2Revealed
        });
    }

    /// @notice Get per-round data
    function getRound(uint256 _gameId, uint256 _round) external view returns (RoundData memory) {
        return rounds[_gameId][_round];
    }

    // ─── Owner Functions ─────────────────────────────────────────────────

    function setPhaseTimeout(uint256 _timeout) external onlyOwner {
        require(_timeout >= 1 minutes, "PokerV2: timeout too short");
        phaseTimeout = _timeout;
    }

    function setReputationRegistry(address _reputationRegistry) external onlyOwner {
        reputationRegistry = IReputationRegistry(_reputationRegistry);
    }

    // ─── Internal Functions ──────────────────────────────────────────────

    /// @dev Advance from current betting round to next phase
    function _advanceBettingPhase(uint256 _gameId) internal {
        Game storage g = games[_gameId];
        RoundData storage r = rounds[_gameId][g.currentRound];

        if (g.phase == GamePhase.BettingRound1) {
            g.phase = GamePhase.BettingRound2;
            r.currentBet = 0;
            r.betsThisRound = 0;
            r.lastBettor = address(0);
            r.currentTurn = g.player1;
            g.phaseDeadline = block.timestamp + phaseTimeout;
        } else if (g.phase == GamePhase.BettingRound2) {
            g.phase = GamePhase.Showdown;
            g.phaseDeadline = block.timestamp + phaseTimeout;
        }
    }

    /// @dev Resolve a round after both reveal — compare hands, update scores, advance or settle
    function _resolveRound(uint256 _gameId) internal {
        Game storage g = games[_gameId];
        RoundData storage r = rounds[_gameId][g.currentRound];

        address roundWinner;
        if (r.p1HandValue > r.p2HandValue) {
            g.p1Score++;
            roundWinner = g.player1;
        } else if (r.p2HandValue > r.p1HandValue) {
            g.p2Score++;
            roundWinner = g.player2;
        }
        // Equal values = draw round (no score change)

        emit RoundResult(_gameId, g.currentRound, roundWinner, g.p1Score, g.p2Score);

        _checkMatchEnd(_gameId);
    }

    /// @dev Resolve a round with a direct winner (from fold)
    function _resolveRoundWithWinner(uint256 _gameId, address _roundWinner) internal {
        Game storage g = games[_gameId];

        if (_roundWinner == g.player1) {
            g.p1Score++;
        } else {
            g.p2Score++;
        }

        emit RoundResult(_gameId, g.currentRound, _roundWinner, g.p1Score, g.p2Score);

        _checkMatchEnd(_gameId);
    }

    /// @dev Check if match is over (someone reached WINS_NEEDED or all rounds played)
    function _checkMatchEnd(uint256 _gameId) internal {
        Game storage g = games[_gameId];

        if (g.p1Score >= WINS_NEEDED) {
            _settleGame(_gameId, g.player1);
        } else if (g.p2Score >= WINS_NEEDED) {
            _settleGame(_gameId, g.player2);
        } else if (g.currentRound + 1 >= g.totalRounds) {
            // All rounds played — determine winner by score
            if (g.p1Score > g.p2Score) {
                _settleGame(_gameId, g.player1);
            } else if (g.p2Score > g.p1Score) {
                _settleGame(_gameId, g.player2);
            } else {
                _settleGame(_gameId, address(0)); // Overall draw
            }
        } else {
            // Advance to next round
            _advanceToNextRound(_gameId);
        }
    }

    /// @dev Reset round state and advance to next round's Commit phase
    function _advanceToNextRound(uint256 _gameId) internal {
        Game storage g = games[_gameId];
        g.currentRound++;
        g.phase = GamePhase.Commit;
        g.phaseDeadline = block.timestamp + phaseTimeout;
        // Pre-set currentTurn for the next round's betting phase
        rounds[_gameId][g.currentRound].currentTurn = g.player1;
    }

    /// @dev Settle the game — distribute pot via escrow, update ELO, reputation
    function _settleGame(uint256 _gameId, address _winner) internal {
        Game storage g = games[_gameId];
        g.settled = true;
        g.phase = GamePhase.Complete;

        Escrow.Match memory m = escrow.getMatch(g.escrowMatchId);

        if (_winner == address(0)) {
            // Draw — escrow refunds base wagers
            escrow.settleDraw(g.escrowMatchId);
            // Refund extra bets to each player
            if (g.p1ExtraBets > 0) {
                (bool s1, ) = g.player1.call{value: g.p1ExtraBets}("");
                require(s1, "PokerV2: refund p1 failed");
            }
            if (g.p2ExtraBets > 0) {
                (bool s2, ) = g.player2.call{value: g.p2ExtraBets}("");
                require(s2, "PokerV2: refund p2 failed");
            }
        } else {
            // Winner takes escrow wagers via Escrow.settle
            escrow.settle(g.escrowMatchId, _winner);
            // Winner also gets all extra bets
            uint256 extraBets = g.p1ExtraBets + g.p2ExtraBets;
            if (extraBets > 0) {
                (bool success, ) = _winner.call{value: extraBets}("");
                require(success, "PokerV2: payout extra bets failed");
            }
        }

        // Update ELO and match history
        address loser = _winner == g.player1 ? g.player2 : g.player1;

        if (_winner != address(0)) {
            uint256 winnerElo = registry.elo(_winner, AgentRegistry.GameType.Poker);
            uint256 loserElo = registry.elo(loser, AgentRegistry.GameType.Poker);

            (uint256 newWinnerElo, uint256 newLoserElo) = _calculateELO(winnerElo, loserElo);

            try registry.updateELO(_winner, AgentRegistry.GameType.Poker, newWinnerElo) {} catch {}
            try registry.updateELO(loser, AgentRegistry.GameType.Poker, newLoserElo) {} catch {}

            try registry.recordMatch(_winner, loser, AgentRegistry.GameType.Poker, true, m.wager) {} catch {}
            try registry.recordMatch(loser, _winner, AgentRegistry.GameType.Poker, false, m.wager) {} catch {}

            _postReputationFeedback(_gameId, _winner, loser);
        }

        emit GameComplete(_gameId, _winner);
    }

    /// @dev Post ERC-8004 reputation feedback
    function _postReputationFeedback(uint256 _gameId, address _winner, address _loser) internal {
        if (address(reputationRegistry) == address(0)) return;

        uint256 winnerAgentId = registry.getAgentId(_winner);
        uint256 loserAgentId = registry.getAgentId(_loser);

        if (winnerAgentId != 0) {
            try reputationRegistry.giveFeedback(
                winnerAgentId, int128(1), 0, "Poker", "win", "", "", bytes32(0)
            ) {
                emit ReputationFeedback(_gameId, winnerAgentId, int128(1), "win");
            } catch {}
        }

        if (loserAgentId != 0) {
            try reputationRegistry.giveFeedback(
                loserAgentId, int128(-1), 0, "Poker", "loss", "", "", bytes32(0)
            ) {
                emit ReputationFeedback(_gameId, loserAgentId, int128(-1), "loss");
            } catch {}
        }
    }

    /// @dev Calculate new ELO ratings (same formula as RPSGame/PokerGame)
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

    /// @dev Allow contract to receive ETH (for bet/raise payments)
    receive() external payable {}
}
