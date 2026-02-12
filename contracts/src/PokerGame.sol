// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./Escrow.sol";
import "./AgentRegistry.sol";
import "./interfaces/IReputationRegistry.sol";

/// @title PokerGame — Simplified commit-reveal poker with bluffing
/// @notice Two-player poker with hand values 1-100. Players commit hidden hand
///         values, then bet in 2 rounds. Fold = opponent wins without reveal.
///         At showdown, higher hand value wins. Integrates with Escrow + AgentRegistry.
///
/// Flow:
///   1. createGame() — links to an active escrow match
///   2. Both players commit hand values (hash of value + salt)
///   3. Betting round 1: players take turns (check/bet/raise/fold)
///   4. Betting round 2: same as round 1
///   5. Showdown: both reveal hand values, higher wins the pot
///
/// Key design decisions:
///   - Hand values 1-100 (committed privately, like a single card draw)
///   - 2 betting rounds max (keeps on-chain tx count reasonable)
///   - Fold = immediate loss, opponent wins without reveal
///   - Pot = initial wager from escrow + accumulated bets from both players
///   - Extra bets beyond the escrow wager are sent as msg.value with bet/raise
contract PokerGame is Ownable {
    // ─── Types ───────────────────────────────────────────────────────────

    enum GamePhase {
        Commit,         // Both players commit hand values
        BettingRound1,  // First betting round
        BettingRound2,  // Second betting round
        Showdown,       // Both players reveal hand values
        Complete        // Game settled
    }

    enum Action {
        None,
        Check,   // Pass without betting (only if no active bet)
        Bet,     // Place a bet (only if no active bet in this round)
        Raise,   // Increase the current bet
        Call,    // Match the current bet
        Fold     // Forfeit the game
    }

    struct Game {
        uint256 escrowMatchId;
        address player1;
        address player2;
        // Hand commitments
        bytes32 p1Commit;
        bytes32 p2Commit;
        uint8 p1HandValue;    // Revealed hand value (1-100)
        uint8 p2HandValue;
        bool p1Revealed;
        bool p2Revealed;
        // Betting state
        uint256 pot;           // Total pot (escrow wagers + extra bets)
        uint256 p1ExtraBets;   // Extra bets from player1 (beyond escrow wager)
        uint256 p2ExtraBets;   // Extra bets from player2
        uint256 currentBet;    // Current bet to match in this round
        address lastBettor;    // Who placed the last bet/raise
        uint8 betsThisRound;   // Number of bets/raises in this round (max 2)
        // Turn tracking
        address currentTurn;   // Whose turn it is to act
        // Phase and timing
        GamePhase phase;
        uint256 phaseDeadline;
        bool settled;
    }

    // ─── Storage ─────────────────────────────────────────────────────────

    Escrow public escrow;
    AgentRegistry public registry;
    IReputationRegistry public reputationRegistry;

    /// @dev Maps player wallet address to their ERC-8004 agentId
    mapping(address => uint256) public agentIds;

    uint256 public nextGameId;
    mapping(uint256 => Game) public games;

    uint256 public phaseTimeout = 5 minutes;

    uint256 public constant ELO_K = 32;

    /// @dev Max bet/raise amount = 2x the escrow wager
    uint256 public constant MAX_BET_MULTIPLIER = 2;

    // ─── Events ──────────────────────────────────────────────────────────

    event GameCreated(uint256 indexed gameId, uint256 indexed escrowMatchId, address indexed player1, address player2);
    event HandCommitted(uint256 indexed gameId, address indexed player);
    event ActionTaken(uint256 indexed gameId, address indexed player, Action action, uint256 amount);
    event HandRevealed(uint256 indexed gameId, address indexed player, uint8 handValue);
    event GameComplete(uint256 indexed gameId, address indexed winner, uint256 pot);
    event TimeoutClaimed(uint256 indexed gameId, address indexed claimer);
    event AgentIdSet(address indexed agent, uint256 agentId);
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

    /// @notice Create a new poker game linked to an escrow match
    function createGame(uint256 _escrowMatchId) external returns (uint256 gameId) {
        Escrow.Match memory m = escrow.getMatch(_escrowMatchId);
        require(m.status == Escrow.MatchStatus.Active, "PokerGame: escrow not Active");
        require(msg.sender == m.player1 || msg.sender == m.player2, "PokerGame: not a participant");
        require(m.gameContract == address(this), "PokerGame: escrow not linked to this game");

        gameId = nextGameId++;

        // Initialize game — pot starts with both escrow wagers
        Game storage g = games[gameId];
        g.escrowMatchId = _escrowMatchId;
        g.player1 = m.player1;
        g.player2 = m.player2;
        g.pot = m.wager * 2;
        g.phase = GamePhase.Commit;
        g.phaseDeadline = block.timestamp + phaseTimeout;
        // player1 acts first in betting rounds
        g.currentTurn = m.player1;

        emit GameCreated(gameId, _escrowMatchId, m.player1, m.player2);
    }

    /// @notice Commit a hand value (hash of value + salt)
    function commitHand(uint256 _gameId, bytes32 _hash) external {
        Game storage g = games[_gameId];
        require(g.phase == GamePhase.Commit, "PokerGame: not in Commit phase");
        require(!g.settled, "PokerGame: game settled");
        require(block.timestamp <= g.phaseDeadline, "PokerGame: commit expired");

        if (msg.sender == g.player1) {
            require(g.p1Commit == bytes32(0), "PokerGame: already committed");
            g.p1Commit = _hash;
        } else if (msg.sender == g.player2) {
            require(g.p2Commit == bytes32(0), "PokerGame: already committed");
            g.p2Commit = _hash;
        } else {
            revert("PokerGame: not a participant");
        }

        emit HandCommitted(_gameId, msg.sender);

        // Both committed — move to betting round 1
        if (g.p1Commit != bytes32(0) && g.p2Commit != bytes32(0)) {
            g.phase = GamePhase.BettingRound1;
            g.phaseDeadline = block.timestamp + phaseTimeout;
            g.currentTurn = g.player1;
            g.currentBet = 0;
            g.betsThisRound = 0;
            g.lastBettor = address(0);
        }
    }

    /// @notice Take a betting action (check, bet, raise, call, fold)
    /// @param _gameId Game ID
    /// @param _action The action to take
    /// @dev For bet/raise, send the amount as msg.value
    function takeAction(uint256 _gameId, Action _action) external payable {
        Game storage g = games[_gameId];
        require(!g.settled, "PokerGame: game settled");
        require(
            g.phase == GamePhase.BettingRound1 || g.phase == GamePhase.BettingRound2,
            "PokerGame: not in betting phase"
        );
        require(block.timestamp <= g.phaseDeadline, "PokerGame: phase expired");
        require(msg.sender == g.currentTurn, "PokerGame: not your turn");
        require(_action != Action.None, "PokerGame: invalid action");

        address opponent = msg.sender == g.player1 ? g.player2 : g.player1;

        if (_action == Action.Fold) {
            // Fold = immediate loss
            emit ActionTaken(_gameId, msg.sender, Action.Fold, 0);
            _settleGame(_gameId, opponent);
            return;
        }

        if (_action == Action.Check) {
            require(g.currentBet == 0, "PokerGame: cannot check with active bet");
            emit ActionTaken(_gameId, msg.sender, Action.Check, 0);

            // If both checked (lastBettor was set to first checker), advance
            if (g.lastBettor == opponent) {
                // Both checked — advance to next phase
                _advancePhase(_gameId);
            } else {
                // First check — mark and pass turn
                g.lastBettor = msg.sender;
                g.currentTurn = opponent;
                g.phaseDeadline = block.timestamp + phaseTimeout;
            }
            return;
        }

        if (_action == Action.Bet) {
            require(g.currentBet == 0, "PokerGame: bet already active, use raise");
            require(msg.value > 0, "PokerGame: bet must be > 0");

            // Cap bet at MAX_BET_MULTIPLIER * escrow wager
            Escrow.Match memory m = escrow.getMatch(g.escrowMatchId);
            require(msg.value <= m.wager * MAX_BET_MULTIPLIER, "PokerGame: bet too large");

            g.currentBet = msg.value;
            g.lastBettor = msg.sender;
            g.betsThisRound++;
            g.pot += msg.value;

            // Track extra bets per player
            if (msg.sender == g.player1) {
                g.p1ExtraBets += msg.value;
            } else {
                g.p2ExtraBets += msg.value;
            }

            emit ActionTaken(_gameId, msg.sender, Action.Bet, msg.value);

            g.currentTurn = opponent;
            g.phaseDeadline = block.timestamp + phaseTimeout;
            return;
        }

        if (_action == Action.Raise) {
            require(g.currentBet > 0, "PokerGame: no bet to raise, use bet");
            require(g.betsThisRound < 2, "PokerGame: max raises reached");
            require(msg.value > g.currentBet, "PokerGame: raise must exceed current bet");

            Escrow.Match memory m = escrow.getMatch(g.escrowMatchId);
            require(msg.value <= m.wager * MAX_BET_MULTIPLIER, "PokerGame: raise too large");

            g.currentBet = msg.value;
            g.lastBettor = msg.sender;
            g.betsThisRound++;
            g.pot += msg.value;

            if (msg.sender == g.player1) {
                g.p1ExtraBets += msg.value;
            } else {
                g.p2ExtraBets += msg.value;
            }

            emit ActionTaken(_gameId, msg.sender, Action.Raise, msg.value);

            g.currentTurn = opponent;
            g.phaseDeadline = block.timestamp + phaseTimeout;
            return;
        }

        if (_action == Action.Call) {
            require(g.currentBet > 0, "PokerGame: nothing to call");
            require(msg.value == g.currentBet, "PokerGame: must match current bet");

            g.pot += msg.value;

            if (msg.sender == g.player1) {
                g.p1ExtraBets += msg.value;
            } else {
                g.p2ExtraBets += msg.value;
            }

            emit ActionTaken(_gameId, msg.sender, Action.Call, msg.value);

            // Call closes the betting round — advance
            _advancePhase(_gameId);
            return;
        }

        revert("PokerGame: invalid action");
    }

    /// @notice Reveal hand value and salt
    function revealHand(uint256 _gameId, uint8 _handValue, bytes32 _salt) external {
        Game storage g = games[_gameId];
        require(g.phase == GamePhase.Showdown, "PokerGame: not in Showdown phase");
        require(!g.settled, "PokerGame: game settled");
        require(block.timestamp <= g.phaseDeadline, "PokerGame: reveal expired");
        require(_handValue >= 1 && _handValue <= 100, "PokerGame: hand must be 1-100");

        bytes32 expectedHash = keccak256(abi.encodePacked(_handValue, _salt));

        if (msg.sender == g.player1) {
            require(!g.p1Revealed, "PokerGame: already revealed");
            require(expectedHash == g.p1Commit, "PokerGame: hash mismatch");
            g.p1HandValue = _handValue;
            g.p1Revealed = true;
        } else if (msg.sender == g.player2) {
            require(!g.p2Revealed, "PokerGame: already revealed");
            require(expectedHash == g.p2Commit, "PokerGame: hash mismatch");
            g.p2HandValue = _handValue;
            g.p2Revealed = true;
        } else {
            revert("PokerGame: not a participant");
        }

        emit HandRevealed(_gameId, msg.sender, _handValue);

        // Both revealed — determine winner
        if (g.p1Revealed && g.p2Revealed) {
            if (g.p1HandValue > g.p2HandValue) {
                _settleGame(_gameId, g.player1);
            } else if (g.p2HandValue > g.p1HandValue) {
                _settleGame(_gameId, g.player2);
            } else {
                // Same hand value — draw
                _settleGame(_gameId, address(0));
            }
        }
    }

    /// @notice Claim timeout if opponent hasn't acted within deadline
    function claimTimeout(uint256 _gameId) external {
        Game storage g = games[_gameId];
        require(!g.settled, "PokerGame: game settled");
        require(block.timestamp > g.phaseDeadline, "PokerGame: deadline not passed");

        address winner;

        if (g.phase == GamePhase.Commit) {
            if (g.p1Commit != bytes32(0) && g.p2Commit == bytes32(0)) {
                winner = g.player1;
            } else if (g.p2Commit != bytes32(0) && g.p1Commit == bytes32(0)) {
                winner = g.player2;
            } else {
                // Neither or both committed — draw
                _settleGame(_gameId, address(0));
                emit TimeoutClaimed(_gameId, msg.sender);
                return;
            }
        } else if (g.phase == GamePhase.BettingRound1 || g.phase == GamePhase.BettingRound2) {
            // The player whose turn it is timed out — opponent wins
            winner = g.currentTurn == g.player1 ? g.player2 : g.player1;
        } else if (g.phase == GamePhase.Showdown) {
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
            revert("PokerGame: game already complete");
        }

        _settleGame(_gameId, winner);
        emit TimeoutClaimed(_gameId, msg.sender);
    }

    // ─── View Functions ──────────────────────────────────────────────────

    /// @dev View struct to avoid stack-too-deep on getGame return
    struct GameView {
        uint256 escrowMatchId;
        address player1;
        address player2;
        uint256 pot;
        uint256 currentBet;
        address currentTurn;
        GamePhase phase;
        uint256 phaseDeadline;
        bool settled;
        uint8 p1HandValue;
        uint8 p2HandValue;
        bool p1Committed;
        bool p2Committed;
        bool p1Revealed;
        bool p2Revealed;
        uint256 p1ExtraBets;
        uint256 p2ExtraBets;
    }

    /// @notice Get full game state as a struct
    function getGame(uint256 _gameId) external view returns (GameView memory) {
        Game storage g = games[_gameId];
        return GameView({
            escrowMatchId: g.escrowMatchId,
            player1: g.player1,
            player2: g.player2,
            pot: g.pot,
            currentBet: g.currentBet,
            currentTurn: g.currentTurn,
            phase: g.phase,
            phaseDeadline: g.phaseDeadline,
            settled: g.settled,
            p1HandValue: g.p1HandValue,
            p2HandValue: g.p2HandValue,
            p1Committed: g.p1Commit != bytes32(0),
            p2Committed: g.p2Commit != bytes32(0),
            p1Revealed: g.p1Revealed,
            p2Revealed: g.p2Revealed,
            p1ExtraBets: g.p1ExtraBets,
            p2ExtraBets: g.p2ExtraBets
        });
    }

    // ─── Owner Functions ─────────────────────────────────────────────────

    function setPhaseTimeout(uint256 _timeout) external onlyOwner {
        require(_timeout >= 1 minutes, "PokerGame: timeout too short");
        phaseTimeout = _timeout;
    }

    function setAgentId(address _agent, uint256 _agentId) external onlyOwner {
        agentIds[_agent] = _agentId;
        emit AgentIdSet(_agent, _agentId);
    }

    function setReputationRegistry(address _reputationRegistry) external onlyOwner {
        reputationRegistry = IReputationRegistry(_reputationRegistry);
    }

    // ─── Internal Functions ──────────────────────────────────────────────

    /// @dev Advance from current betting round to next phase
    function _advancePhase(uint256 _gameId) internal {
        Game storage g = games[_gameId];

        if (g.phase == GamePhase.BettingRound1) {
            g.phase = GamePhase.BettingRound2;
            g.currentBet = 0;
            g.betsThisRound = 0;
            g.lastBettor = address(0);
            g.currentTurn = g.player1;
            g.phaseDeadline = block.timestamp + phaseTimeout;
        } else if (g.phase == GamePhase.BettingRound2) {
            g.phase = GamePhase.Showdown;
            g.phaseDeadline = block.timestamp + phaseTimeout;
        }
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
                require(s1, "PokerGame: refund p1 failed");
            }
            if (g.p2ExtraBets > 0) {
                (bool s2, ) = g.player2.call{value: g.p2ExtraBets}("");
                require(s2, "PokerGame: refund p2 failed");
            }
        } else {
            // Winner takes escrow wagers via Escrow.settle
            escrow.settle(g.escrowMatchId, _winner);
            // Winner also gets all extra bets accumulated in the pot
            uint256 extraBets = g.p1ExtraBets + g.p2ExtraBets;
            if (extraBets > 0) {
                (bool success, ) = _winner.call{value: extraBets}("");
                require(success, "PokerGame: payout extra bets failed");
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

        emit GameComplete(_gameId, _winner, g.pot);
    }

    /// @dev Post ERC-8004 reputation feedback
    function _postReputationFeedback(uint256 _gameId, address _winner, address _loser) internal {
        if (address(reputationRegistry) == address(0)) return;

        uint256 winnerAgentId = agentIds[_winner];
        uint256 loserAgentId = agentIds[_loser];

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

    /// @dev Calculate new ELO ratings (same formula as RPSGame)
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
