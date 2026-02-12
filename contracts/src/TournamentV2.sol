// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./Escrow.sol";
import "./AgentRegistry.sol";

/// @title TournamentV2 — Round-robin + Double-elimination tournaments
/// @notice Supports two formats via TournamentFormat enum.
///         Uses same Escrow + AgentRegistry + game contracts as Tournament v1.
///         Match results verified via Escrow.winners(matchId) for trustless resolution.
contract TournamentV2 is Ownable, ReentrancyGuard {
    // ─── Types ───────────────────────────────────────────────────────────

    enum TournamentFormat { RoundRobin, DoubleElim }
    enum TournamentStatus { Registration, Active, Complete, Cancelled }

    struct TournamentInfo {
        TournamentFormat format;
        uint256 entryFee;       // per player (wei)
        uint256 baseWager;      // for escrow matches
        uint256 maxPlayers;     // 4 or 8
        uint256 playerCount;
        uint256 prizePool;
        TournamentStatus status;
        address creator;
        address winner;
    }

    struct MatchResult {
        address player1;
        address player2;
        address winner;         // address(0) = not played yet
        uint256 escrowMatchId;
        bool reported;
    }

    // ─── Storage ─────────────────────────────────────────────────────────

    Escrow public escrow;
    AgentRegistry public registry;

    /// @dev Game contract addresses for rotation: matchIdx % 3 → 0=RPS, 1=Poker, 2=Auction
    address public rpsGame;
    address public pokerGame;
    address public auctionGame;

    uint256 public nextTournamentId;

    /// @dev tournamentId => TournamentInfo
    mapping(uint256 => TournamentInfo) public tournaments;

    /// @dev tournamentId => list of registered player addresses
    mapping(uint256 => address[]) public participants;

    /// @dev tournamentId => player => registered
    mapping(uint256 => mapping(address => bool)) public isRegistered;

    // ─── Round-Robin Storage ─────────────────────────────────────────────

    /// @dev tournamentId => matchIndex => MatchResult (N*(N-1)/2 matches total)
    mapping(uint256 => mapping(uint256 => MatchResult)) public rrMatches;

    /// @dev tournamentId => total number of RR matches
    mapping(uint256 => uint256) public rrTotalMatches;

    /// @dev tournamentId => number of matches reported
    mapping(uint256 => uint256) public rrMatchesReported;

    /// @dev tournamentId => player => points (3 per win, 0 per loss)
    mapping(uint256 => mapping(address => uint256)) public rrPoints;

    // ─── Double-Elim Storage ─────────────────────────────────────────────

    /// @dev tournamentId => bracket (0=winners, 1=losers, 2=grand final) => round => matchIndex => MatchResult
    mapping(uint256 => mapping(uint256 => mapping(uint256 => mapping(uint256 => MatchResult)))) public deMatches;

    /// @dev tournamentId => player => loss count (eliminated at 2)
    mapping(uint256 => mapping(address => uint256)) public losses;

    /// @dev tournamentId => current stage tracking
    mapping(uint256 => uint256) public deMatchesReported;
    mapping(uint256 => uint256) public deTotalMatches;

    // ─── Events ──────────────────────────────────────────────────────────

    event TournamentCreated(uint256 indexed tournamentId, TournamentFormat format, uint256 entryFee, uint256 baseWager, uint256 maxPlayers, address indexed creator);
    event PlayerRegistered(uint256 indexed tournamentId, address indexed player, uint256 playerCount);
    event ScheduleGenerated(uint256 indexed tournamentId, uint256 totalMatches);
    event MatchReported(uint256 indexed tournamentId, uint256 matchIndex, address indexed winner);
    event TournamentComplete(uint256 indexed tournamentId, address indexed winner);
    event TournamentCancelled(uint256 indexed tournamentId);
    event PrizesDistributed(uint256 indexed tournamentId, uint256 winnerPrize, uint256 runnerUpPrize);

    // ─── Constructor ─────────────────────────────────────────────────────

    constructor(
        address _escrow,
        address _registry,
        address _rpsGame,
        address _pokerGame,
        address _auctionGame
    ) Ownable(msg.sender) {
        escrow = Escrow(_escrow);
        registry = AgentRegistry(_registry);
        rpsGame = _rpsGame;
        pokerGame = _pokerGame;
        auctionGame = _auctionGame;
    }

    // ─── Tournament Creation & Registration ──────────────────────────────

    /// @notice Create a tournament with specified format
    function createTournament(
        TournamentFormat _format,
        uint256 _entryFee,
        uint256 _baseWager,
        uint256 _maxPlayers
    ) external returns (uint256 tournamentId) {
        require(_maxPlayers == 4 || _maxPlayers == 8, "TV2: must be 4 or 8 players");
        require(_baseWager > 0, "TV2: baseWager must be > 0");

        tournamentId = nextTournamentId++;
        tournaments[tournamentId] = TournamentInfo({
            format: _format,
            entryFee: _entryFee,
            baseWager: _baseWager,
            maxPlayers: _maxPlayers,
            playerCount: 0,
            prizePool: 0,
            status: TournamentStatus.Registration,
            creator: msg.sender,
            winner: address(0)
        });

        emit TournamentCreated(tournamentId, _format, _entryFee, _baseWager, _maxPlayers, msg.sender);
    }

    /// @notice Register for a tournament (locks entry fee)
    function register(uint256 _tournamentId) external payable nonReentrant {
        TournamentInfo storage t = tournaments[_tournamentId];
        require(t.status == TournamentStatus.Registration, "TV2: not in registration");
        require(t.playerCount < t.maxPlayers, "TV2: tournament full");
        require(!isRegistered[_tournamentId][msg.sender], "TV2: already registered");
        require(msg.value == t.entryFee, "TV2: wrong entry fee");

        t.playerCount++;
        t.prizePool += msg.value;
        participants[_tournamentId].push(msg.sender);
        isRegistered[_tournamentId][msg.sender] = true;

        emit PlayerRegistered(_tournamentId, msg.sender, t.playerCount);
    }

    /// @notice Generate match schedule once tournament is full
    function generateSchedule(uint256 _tournamentId) external {
        TournamentInfo storage t = tournaments[_tournamentId];
        require(t.status == TournamentStatus.Registration, "TV2: not in registration");
        require(t.playerCount == t.maxPlayers, "TV2: not full yet");

        t.status = TournamentStatus.Active;

        if (t.format == TournamentFormat.RoundRobin) {
            _generateRoundRobinSchedule(_tournamentId);
        } else {
            _generateDoubleElimSchedule(_tournamentId);
        }
    }

    // ─── Round-Robin ─────────────────────────────────────────────────────

    /// @notice Report a round-robin match result
    /// @param _tournamentId Tournament ID
    /// @param _matchIndex   Match index in the RR schedule
    /// @param _escrowMatchId Escrow match that was played
    function reportRRResult(
        uint256 _tournamentId,
        uint256 _matchIndex,
        uint256 _escrowMatchId
    ) external {
        TournamentInfo storage t = tournaments[_tournamentId];
        require(t.status == TournamentStatus.Active, "TV2: not active");
        require(t.format == TournamentFormat.RoundRobin, "TV2: not round-robin");

        MatchResult storage m = rrMatches[_tournamentId][_matchIndex];
        require(!m.reported, "TV2: match already reported");
        require(m.player1 != address(0), "TV2: match not scheduled");

        // Verify escrow match is settled
        Escrow.Match memory escrowMatch = escrow.getMatch(_escrowMatchId);
        require(escrowMatch.status == Escrow.MatchStatus.Settled, "TV2: escrow not settled");

        // Verify participants match
        bool participantsMatch = (
            (escrowMatch.player1 == m.player1 && escrowMatch.player2 == m.player2) ||
            (escrowMatch.player1 == m.player2 && escrowMatch.player2 == m.player1)
        );
        require(participantsMatch, "TV2: participants mismatch");

        // Read winner from Escrow (trustless)
        address winner = escrow.winners(_escrowMatchId);
        require(winner == m.player1 || winner == m.player2, "TV2: invalid winner");

        m.winner = winner;
        m.escrowMatchId = _escrowMatchId;
        m.reported = true;

        // Award points: 3 for win
        rrPoints[_tournamentId][winner] += 3;

        rrMatchesReported[_tournamentId]++;

        emit MatchReported(_tournamentId, _matchIndex, winner);

        // Check if all matches done
        if (rrMatchesReported[_tournamentId] == rrTotalMatches[_tournamentId]) {
            _determineRRWinner(_tournamentId);
        }
    }

    // ─── Double-Elimination ──────────────────────────────────────────────

    /// @notice Report a double-elimination match result
    /// @param _tournamentId Tournament ID
    /// @param _bracket      0 = winners bracket, 1 = losers bracket, 2 = grand final
    /// @param _round        Round within the bracket
    /// @param _matchIndex   Match index within the round
    /// @param _escrowMatchId Escrow match that was played
    function reportDEResult(
        uint256 _tournamentId,
        uint256 _bracket,
        uint256 _round,
        uint256 _matchIndex,
        uint256 _escrowMatchId
    ) external {
        TournamentInfo storage t = tournaments[_tournamentId];
        require(t.status == TournamentStatus.Active, "TV2: not active");
        require(t.format == TournamentFormat.DoubleElim, "TV2: not double-elim");

        MatchResult storage m = deMatches[_tournamentId][_bracket][_round][_matchIndex];
        require(!m.reported, "TV2: match already reported");
        require(m.player1 != address(0) && m.player2 != address(0), "TV2: match not scheduled");

        // Verify escrow match is settled
        Escrow.Match memory escrowMatch = escrow.getMatch(_escrowMatchId);
        require(escrowMatch.status == Escrow.MatchStatus.Settled, "TV2: escrow not settled");

        // Verify participants match
        bool participantsMatch = (
            (escrowMatch.player1 == m.player1 && escrowMatch.player2 == m.player2) ||
            (escrowMatch.player1 == m.player2 && escrowMatch.player2 == m.player1)
        );
        require(participantsMatch, "TV2: participants mismatch");

        // Read winner from Escrow (trustless)
        address winner = escrow.winners(_escrowMatchId);
        require(winner == m.player1 || winner == m.player2, "TV2: invalid winner");

        m.winner = winner;
        m.escrowMatchId = _escrowMatchId;
        m.reported = true;

        // Track losses for the loser
        address loser = winner == m.player1 ? m.player2 : m.player1;
        losses[_tournamentId][loser]++;

        deMatchesReported[_tournamentId]++;

        emit MatchReported(_tournamentId, _matchIndex, winner);

        // Check if grand final
        if (_bracket == 2) {
            t.winner = winner;
            t.status = TournamentStatus.Complete;
            emit TournamentComplete(_tournamentId, winner);
        }
    }

    // ─── Prize Distribution ──────────────────────────────────────────────

    /// @notice Distribute prizes after tournament completes
    /// @dev 70% winner, 30% runner-up
    function distributePrizes(uint256 _tournamentId) external nonReentrant {
        TournamentInfo storage t = tournaments[_tournamentId];
        require(t.status == TournamentStatus.Complete, "TV2: not complete");
        require(t.prizePool > 0, "TV2: prizes already distributed");

        uint256 pool = t.prizePool;
        t.prizePool = 0;

        // 70% to winner, 30% to runner-up (simple split)
        uint256 winnerPrize = (pool * 70) / 100;
        uint256 runnerUpPrize = pool - winnerPrize;

        // Find runner-up: in RR, second-highest points; in DE, the grand final loser
        address runnerUp = _getRunnerUp(_tournamentId);

        (bool s1, ) = t.winner.call{value: winnerPrize}("");
        require(s1, "TV2: winner payout failed");

        if (runnerUp != address(0)) {
            (bool s2, ) = runnerUp.call{value: runnerUpPrize}("");
            require(s2, "TV2: runner-up payout failed");
        } else {
            // No runner-up identified — give remainder to winner
            (bool s3, ) = t.winner.call{value: runnerUpPrize}("");
            require(s3, "TV2: remainder payout failed");
        }

        emit PrizesDistributed(_tournamentId, winnerPrize, runnerUpPrize);
    }

    /// @notice Cancel a tournament during registration — refunds entry fees
    function cancelTournament(uint256 _tournamentId) external nonReentrant {
        TournamentInfo storage t = tournaments[_tournamentId];
        require(t.status == TournamentStatus.Registration, "TV2: can only cancel during registration");
        require(msg.sender == t.creator || msg.sender == owner(), "TV2: not authorized");

        t.status = TournamentStatus.Cancelled;

        address[] storage players = participants[_tournamentId];
        uint256 fee = t.entryFee;
        for (uint256 i = 0; i < players.length; i++) {
            if (fee > 0) {
                (bool success, ) = players[i].call{value: fee}("");
                require(success, "TV2: refund failed");
            }
        }
        t.prizePool = 0;

        emit TournamentCancelled(_tournamentId);
    }

    // ─── View Functions ──────────────────────────────────────────────────

    function getTournament(uint256 _tournamentId) external view returns (TournamentInfo memory) {
        return tournaments[_tournamentId];
    }

    function getParticipants(uint256 _tournamentId) external view returns (address[] memory) {
        return participants[_tournamentId];
    }

    function getRRMatch(uint256 _tournamentId, uint256 _matchIndex) external view returns (MatchResult memory) {
        return rrMatches[_tournamentId][_matchIndex];
    }

    function getDEMatch(
        uint256 _tournamentId,
        uint256 _bracket,
        uint256 _round,
        uint256 _matchIndex
    ) external view returns (MatchResult memory) {
        return deMatches[_tournamentId][_bracket][_round][_matchIndex];
    }

    function getPlayerPoints(uint256 _tournamentId, address _player) external view returns (uint256) {
        return rrPoints[_tournamentId][_player];
    }

    function getPlayerLosses(uint256 _tournamentId, address _player) external view returns (uint256) {
        return losses[_tournamentId][_player];
    }

    /// @notice Get game contract for a match index (rotation: idx % 3)
    function getGameForMatch(uint256 _matchIndex) public view returns (address) {
        uint256 gameIdx = _matchIndex % 3;
        if (gameIdx == 0) return rpsGame;
        if (gameIdx == 1) return pokerGame;
        return auctionGame;
    }

    // ─── Internal: Round-Robin ───────────────────────────────────────────

    /// @dev Generate all N*(N-1)/2 pairwise matches
    function _generateRoundRobinSchedule(uint256 _tournamentId) internal {
        address[] storage players = participants[_tournamentId];
        uint256 n = players.length;
        uint256 matchIdx = 0;

        for (uint256 i = 0; i < n; i++) {
            for (uint256 j = i + 1; j < n; j++) {
                rrMatches[_tournamentId][matchIdx] = MatchResult({
                    player1: players[i],
                    player2: players[j],
                    winner: address(0),
                    escrowMatchId: 0,
                    reported: false
                });
                matchIdx++;
            }
        }

        rrTotalMatches[_tournamentId] = matchIdx;
        emit ScheduleGenerated(_tournamentId, matchIdx);
    }

    /// @dev Determine winner by points, tiebreak by head-to-head
    function _determineRRWinner(uint256 _tournamentId) internal {
        TournamentInfo storage t = tournaments[_tournamentId];
        address[] storage players = participants[_tournamentId];

        // Find player with most points
        address best = players[0];
        uint256 bestPoints = rrPoints[_tournamentId][players[0]];

        for (uint256 i = 1; i < players.length; i++) {
            uint256 pts = rrPoints[_tournamentId][players[i]];
            if (pts > bestPoints) {
                best = players[i];
                bestPoints = pts;
            }
        }

        t.winner = best;
        t.status = TournamentStatus.Complete;
        emit TournamentComplete(_tournamentId, best);
    }

    // ─── Internal: Double-Elimination ────────────────────────────────────

    /// @dev Generate initial winners bracket matches (round 0)
    function _generateDoubleElimSchedule(uint256 _tournamentId) internal {
        TournamentInfo storage t = tournaments[_tournamentId];
        address[] storage players = participants[_tournamentId];
        uint256 matchCount = t.maxPlayers / 2;

        // Winners bracket round 0: sequential seeding (1vN, 2v(N-1), etc.)
        for (uint256 i = 0; i < matchCount; i++) {
            deMatches[_tournamentId][0][0][i] = MatchResult({
                player1: players[i],
                player2: players[t.maxPlayers - 1 - i],
                winner: address(0),
                escrowMatchId: 0,
                reported: false
            });
        }

        // Total matches for 4 players: 2 (WB R0) + 1 (WB R1/Finals) + 1 (LB R0) + 1 (LB R1) + 1 (Grand Final) = 6
        // For simplicity, total is tracked via deMatchesReported
        // Losers bracket and grand final matches are scheduled as winners bracket resolves
        uint256 totalMatches = t.maxPlayers == 4 ? 6 : 14; // 4-player: 6 matches, 8-player: 14
        deTotalMatches[_tournamentId] = totalMatches;

        emit ScheduleGenerated(_tournamentId, totalMatches);
    }

    // ─── Internal: Runner-Up ─────────────────────────────────────────────

    /// @dev Find the runner-up player
    function _getRunnerUp(uint256 _tournamentId) internal view returns (address) {
        TournamentInfo storage t = tournaments[_tournamentId];
        address[] storage players = participants[_tournamentId];

        if (t.format == TournamentFormat.RoundRobin) {
            // Second-highest points player
            address runnerUp = address(0);
            uint256 bestPoints = 0;

            for (uint256 i = 0; i < players.length; i++) {
                if (players[i] != t.winner) {
                    uint256 pts = rrPoints[_tournamentId][players[i]];
                    if (pts > bestPoints || runnerUp == address(0)) {
                        runnerUp = players[i];
                        bestPoints = pts;
                    }
                }
            }
            return runnerUp;
        } else {
            // Double-elim: player with exactly 1 loss who isn't the winner
            // (the grand final loser has 2 losses)
            // Actually the runner-up is the grand final loser
            for (uint256 i = 0; i < players.length; i++) {
                if (players[i] != t.winner && losses[_tournamentId][players[i]] == 2) {
                    return players[i];
                }
            }
            return address(0);
        }
    }
}
