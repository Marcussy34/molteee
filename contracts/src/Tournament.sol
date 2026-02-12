// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./Escrow.sol";
import "./AgentRegistry.sol";

/// @title Tournament — Single-elimination bracket tournaments
/// @notice Orchestrates multi-round tournaments across existing game contracts.
///         Tournament does NOT run games — it tracks brackets, entry fees, and prizes.
///         Individual matches run through RPSGame/PokerGame/AuctionGame + Escrow as usual.
contract Tournament is Ownable, ReentrancyGuard {
    // ─── Types ───────────────────────────────────────────────────────────

    enum TournamentStatus { Registration, Active, Complete, Cancelled }

    struct TournamentInfo {
        uint256 entryFee;       // entry fee per player (wei)
        uint256 baseWager;      // base wager for round 0 (escalates 2x per round)
        uint256 maxPlayers;     // 4 or 8
        uint256 playerCount;    // current registrations
        uint256 prizePool;      // total collected entry fees
        uint256 currentRound;   // 0-indexed
        uint256 totalRounds;    // log2(maxPlayers): 2 for 4-player, 3 for 8-player
        TournamentStatus status;
        address creator;
        address winner;         // set when tournament completes
        address runnerUp;       // set when tournament completes
    }

    struct BracketMatch {
        address player1;
        address player2;
        address winner;
        uint256 escrowMatchId;  // linked escrow match (0 = not yet created)
        bool reported;
    }

    // ─── Storage ─────────────────────────────────────────────────────────

    Escrow public escrow;
    AgentRegistry public registry;

    /// @dev Game contract addresses for rotation: round % 3 → 0=RPS, 1=Poker, 2=Auction
    address public rpsGame;
    address public pokerGame;
    address public auctionGame;

    /// @dev Auto-incrementing tournament ID
    uint256 public nextTournamentId;

    /// @dev tournamentId => TournamentInfo
    mapping(uint256 => TournamentInfo) public tournaments;

    /// @dev tournamentId => list of registered player addresses
    mapping(uint256 => address[]) public participants;

    /// @dev tournamentId => round => matchIndex => BracketMatch
    mapping(uint256 => mapping(uint256 => mapping(uint256 => BracketMatch))) public bracket;

    /// @dev tournamentId => player => registered flag
    mapping(uint256 => mapping(address => bool)) public isRegistered;

    /// @dev tournamentId => semifinalists (3rd/4th place)
    mapping(uint256 => address[]) public semifinalists;

    // ─── Events ──────────────────────────────────────────────────────────

    event TournamentCreated(uint256 indexed tournamentId, uint256 entryFee, uint256 baseWager, uint256 maxPlayers, address indexed creator);
    event PlayerRegistered(uint256 indexed tournamentId, address indexed player, uint256 playerCount);
    event BracketGenerated(uint256 indexed tournamentId, uint256 totalRounds);
    event MatchReported(uint256 indexed tournamentId, uint256 round, uint256 matchIndex, address indexed winner);
    event TournamentComplete(uint256 indexed tournamentId, address indexed winner, address indexed runnerUp);
    event TournamentCancelled(uint256 indexed tournamentId);
    event PrizesDistributed(uint256 indexed tournamentId, uint256 winnerPrize, uint256 runnerUpPrize);

    // ─── Constructor ─────────────────────────────────────────────────────

    /// @param _escrow      Address of the Escrow contract
    /// @param _registry    Address of the AgentRegistry contract
    /// @param _rpsGame     Address of the RPSGame contract
    /// @param _pokerGame   Address of the PokerGame contract
    /// @param _auctionGame Address of the AuctionGame contract
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

    // ─── Tournament Lifecycle ────────────────────────────────────────────

    /// @notice Create a new tournament
    /// @param _entryFee   Entry fee per player (wei)
    /// @param _baseWager  Base wager for round 0 (escalates 2x per round)
    /// @param _maxPlayers Maximum players (must be 4 or 8)
    /// @return tournamentId The ID of the new tournament
    function createTournament(
        uint256 _entryFee,
        uint256 _baseWager,
        uint256 _maxPlayers
    ) external returns (uint256 tournamentId) {
        require(_maxPlayers == 4 || _maxPlayers == 8, "Tournament: must be 4 or 8 players");
        require(_baseWager > 0, "Tournament: baseWager must be > 0");

        // Calculate total rounds: log2(maxPlayers)
        uint256 totalRounds = _maxPlayers == 4 ? 2 : 3;

        tournamentId = nextTournamentId++;
        tournaments[tournamentId] = TournamentInfo({
            entryFee: _entryFee,
            baseWager: _baseWager,
            maxPlayers: _maxPlayers,
            playerCount: 0,
            prizePool: 0,
            currentRound: 0,
            totalRounds: totalRounds,
            status: TournamentStatus.Registration,
            creator: msg.sender,
            winner: address(0),
            runnerUp: address(0)
        });

        emit TournamentCreated(tournamentId, _entryFee, _baseWager, _maxPlayers, msg.sender);
    }

    /// @notice Register for a tournament — locks entry fee
    /// @param _tournamentId Tournament to register for
    function register(uint256 _tournamentId) external payable nonReentrant {
        TournamentInfo storage t = tournaments[_tournamentId];
        require(t.status == TournamentStatus.Registration, "Tournament: not in registration");
        require(t.playerCount < t.maxPlayers, "Tournament: tournament full");
        require(!isRegistered[_tournamentId][msg.sender], "Tournament: already registered");
        require(msg.value == t.entryFee, "Tournament: wrong entry fee");

        t.playerCount++;
        t.prizePool += msg.value;
        participants[_tournamentId].push(msg.sender);
        isRegistered[_tournamentId][msg.sender] = true;

        emit PlayerRegistered(_tournamentId, msg.sender, t.playerCount);
    }

    /// @notice Generate bracket once tournament is full
    /// @dev Sequential seeding: 1v4, 2v3 for 4 players; 1v8, 2v7, etc. for 8 players
    /// @param _tournamentId Tournament to generate bracket for
    function generateBracket(uint256 _tournamentId) external {
        TournamentInfo storage t = tournaments[_tournamentId];
        require(t.status == TournamentStatus.Registration, "Tournament: not in registration");
        require(t.playerCount == t.maxPlayers, "Tournament: not full yet");

        t.status = TournamentStatus.Active;

        // Set up round 0 matches with sequential seeding
        uint256 matchCount = t.maxPlayers / 2;
        address[] storage players = participants[_tournamentId];

        for (uint256 i = 0; i < matchCount; i++) {
            // Sequential seeding: seed 1 vs seed N, seed 2 vs seed N-1, etc.
            bracket[_tournamentId][0][i] = BracketMatch({
                player1: players[i],
                player2: players[t.maxPlayers - 1 - i],
                winner: address(0),
                escrowMatchId: 0,
                reported: false
            });
        }

        emit BracketGenerated(_tournamentId, t.totalRounds);
    }

    /// @notice Report a match result from a settled escrow match
    /// @param _tournamentId Tournament ID
    /// @param _round        Round index (0-based)
    /// @param _matchIndex   Match index within the round
    /// @param _escrowMatchId The escrow match ID that was played
    /// @param _winner       Winner of the match
    function reportResult(
        uint256 _tournamentId,
        uint256 _round,
        uint256 _matchIndex,
        uint256 _escrowMatchId,
        address _winner
    ) external {
        TournamentInfo storage t = tournaments[_tournamentId];
        require(t.status == TournamentStatus.Active, "Tournament: not active");
        require(_round == t.currentRound, "Tournament: wrong round");

        BracketMatch storage m = bracket[_tournamentId][_round][_matchIndex];
        require(!m.reported, "Tournament: match already reported");
        require(m.player1 != address(0) && m.player2 != address(0), "Tournament: match not set");

        // Verify winner is a participant in this bracket match
        require(
            _winner == m.player1 || _winner == m.player2,
            "Tournament: winner not a participant"
        );

        // Verify escrow match is settled and has correct participants
        Escrow.Match memory escrowMatch = escrow.getMatch(_escrowMatchId);
        require(escrowMatch.status == Escrow.MatchStatus.Settled, "Tournament: escrow match not settled");

        // Verify escrow match participants match bracket match participants
        bool participantsMatch = (
            (escrowMatch.player1 == m.player1 && escrowMatch.player2 == m.player2) ||
            (escrowMatch.player1 == m.player2 && escrowMatch.player2 == m.player1)
        );
        require(participantsMatch, "Tournament: escrow participants mismatch");

        // Verify the game contract matches the expected game type for this round
        address expectedGame = getGameTypeForRound(_round);
        require(escrowMatch.gameContract == expectedGame, "Tournament: wrong game type for round");

        // Record the result
        m.winner = _winner;
        m.escrowMatchId = _escrowMatchId;
        m.reported = true;

        emit MatchReported(_tournamentId, _round, _matchIndex, _winner);

        // Check if all matches in this round are done → advance round
        _tryAdvanceRound(_tournamentId);
    }

    /// @notice Distribute prizes after tournament completes
    /// @dev 60% winner, 25% runner-up, 7.5% each semifinalist (4-player)
    /// @param _tournamentId Tournament ID
    function distributePrizes(uint256 _tournamentId) external nonReentrant {
        TournamentInfo storage t = tournaments[_tournamentId];
        require(t.status == TournamentStatus.Complete, "Tournament: not complete");
        require(t.prizePool > 0, "Tournament: prizes already distributed");

        uint256 pool = t.prizePool;
        t.prizePool = 0; // prevent re-distribution

        // 60% to winner
        uint256 winnerPrize = (pool * 60) / 100;
        // 25% to runner-up
        uint256 runnerUpPrize = (pool * 25) / 100;

        // Pay winner
        (bool s1, ) = t.winner.call{value: winnerPrize}("");
        require(s1, "Tournament: winner payout failed");

        // Pay runner-up
        (bool s2, ) = t.runnerUp.call{value: runnerUpPrize}("");
        require(s2, "Tournament: runner-up payout failed");

        // Remaining goes to semifinalists (split equally)
        uint256 remaining = pool - winnerPrize - runnerUpPrize;
        address[] storage semis = semifinalists[_tournamentId];

        if (semis.length > 0) {
            uint256 perSemi = remaining / semis.length;
            for (uint256 i = 0; i < semis.length; i++) {
                (bool s, ) = semis[i].call{value: perSemi}("");
                require(s, "Tournament: semifinalist payout failed");
            }
        } else {
            // If no semifinalists (shouldn't happen), give remainder to winner
            (bool s, ) = t.winner.call{value: remaining}("");
            require(s, "Tournament: remainder payout failed");
        }

        emit PrizesDistributed(_tournamentId, winnerPrize, runnerUpPrize);
    }

    /// @notice Cancel a tournament during registration — refunds all entry fees
    /// @param _tournamentId Tournament ID
    function cancelTournament(uint256 _tournamentId) external nonReentrant {
        TournamentInfo storage t = tournaments[_tournamentId];
        require(t.status == TournamentStatus.Registration, "Tournament: can only cancel during registration");
        require(msg.sender == t.creator || msg.sender == owner(), "Tournament: not authorized");

        t.status = TournamentStatus.Cancelled;

        // Refund all entry fees
        address[] storage players = participants[_tournamentId];
        uint256 fee = t.entryFee;
        for (uint256 i = 0; i < players.length; i++) {
            if (fee > 0) {
                (bool success, ) = players[i].call{value: fee}("");
                require(success, "Tournament: refund failed");
            }
        }
        t.prizePool = 0;

        emit TournamentCancelled(_tournamentId);
    }

    // ─── View Functions ──────────────────────────────────────────────────

    /// @notice Get tournament info
    function getTournament(uint256 _tournamentId) external view returns (TournamentInfo memory) {
        return tournaments[_tournamentId];
    }

    /// @notice Get all participants for a tournament
    function getParticipants(uint256 _tournamentId) external view returns (address[] memory) {
        return participants[_tournamentId];
    }

    /// @notice Get a specific bracket match
    function getBracketMatch(
        uint256 _tournamentId,
        uint256 _round,
        uint256 _matchIndex
    ) external view returns (BracketMatch memory) {
        return bracket[_tournamentId][_round][_matchIndex];
    }

    /// @notice Get the wager for a specific round (baseWager * 2^round)
    function getRoundWager(uint256 _tournamentId, uint256 _round) public view returns (uint256) {
        return tournaments[_tournamentId].baseWager * (2 ** _round);
    }

    /// @notice Get the game contract address for a given round
    /// @dev Rotation: round % 3 → 0=RPS, 1=Poker, 2=Auction
    function getGameTypeForRound(uint256 _round) public view returns (address) {
        uint256 gameIndex = _round % 3;
        if (gameIndex == 0) return rpsGame;
        if (gameIndex == 1) return pokerGame;
        return auctionGame;
    }

    /// @notice Get the number of matches in a given round
    function getMatchCountForRound(uint256 _tournamentId, uint256 _round) public view returns (uint256) {
        return tournaments[_tournamentId].maxPlayers / (2 ** (_round + 1));
    }

    // ─── Internal Functions ──────────────────────────────────────────────

    /// @dev Check if all matches in the current round are reported, then advance
    function _tryAdvanceRound(uint256 _tournamentId) internal {
        TournamentInfo storage t = tournaments[_tournamentId];
        uint256 matchCount = getMatchCountForRound(_tournamentId, t.currentRound);

        // Check if all matches are reported
        for (uint256 i = 0; i < matchCount; i++) {
            if (!bracket[_tournamentId][t.currentRound][i].reported) {
                return; // Not all done yet
            }
        }

        // All matches done — check if this was the final round
        if (t.currentRound + 1 >= t.totalRounds) {
            // Tournament complete — the winner of the final match is the champion
            BracketMatch storage finalMatch = bracket[_tournamentId][t.currentRound][0];
            t.winner = finalMatch.winner;
            t.runnerUp = finalMatch.winner == finalMatch.player1 ? finalMatch.player2 : finalMatch.player1;
            t.status = TournamentStatus.Complete;

            // Record semifinalists (losers of the penultimate round)
            if (t.totalRounds >= 2) {
                uint256 semiRound = t.totalRounds - 2;
                uint256 semiMatchCount = getMatchCountForRound(_tournamentId, semiRound);
                for (uint256 i = 0; i < semiMatchCount; i++) {
                    BracketMatch storage sm = bracket[_tournamentId][semiRound][i];
                    address loser = sm.winner == sm.player1 ? sm.player2 : sm.player1;
                    // Only add losers who didn't advance (i.e., aren't the finalist runner-up)
                    if (loser != t.runnerUp) {
                        semifinalists[_tournamentId].push(loser);
                    }
                }
            }

            emit TournamentComplete(_tournamentId, t.winner, t.runnerUp);
        } else {
            // Advance to next round — populate bracket from winners
            t.currentRound++;
            uint256 nextMatchCount = getMatchCountForRound(_tournamentId, t.currentRound);

            for (uint256 i = 0; i < nextMatchCount; i++) {
                // Winners from match 2*i and 2*i+1 form the next match
                address w1 = bracket[_tournamentId][t.currentRound - 1][2 * i].winner;
                address w2 = bracket[_tournamentId][t.currentRound - 1][2 * i + 1].winner;

                bracket[_tournamentId][t.currentRound][i] = BracketMatch({
                    player1: w1,
                    player2: w2,
                    winner: address(0),
                    escrowMatchId: 0,
                    reported: false
                });
            }
        }
    }
}
