// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import "../src/AgentRegistry.sol";
import "../src/Escrow.sol";
import "../src/RPSGame.sol";
import "../src/PokerGame.sol";
import "../src/AuctionGame.sol";
import "../src/Tournament.sol";

contract TournamentTest is Test {
    AgentRegistry public registry;
    Escrow public escrow;
    RPSGame public rps;
    PokerGame public poker;
    AuctionGame public auction;
    Tournament public tournament;

    address public owner = address(this);
    address public player1;
    address public player2;
    address public player3;
    address public player4;

    // Common salts for RPS testing
    bytes32 public salt1 = keccak256("salt1");
    bytes32 public salt2 = keccak256("salt2");

    function setUp() public {
        // Create labeled addresses
        player1 = makeAddr("player1");
        player2 = makeAddr("player2");
        player3 = makeAddr("player3");
        player4 = makeAddr("player4");

        // Deploy all contracts
        registry = new AgentRegistry();
        escrow = new Escrow();
        rps = new RPSGame(address(escrow), address(registry), address(0));
        poker = new PokerGame(address(escrow), address(registry), address(0));
        auction = new AuctionGame(address(escrow), address(registry), address(0));
        tournament = new Tournament(
            address(escrow),
            address(registry),
            address(rps),
            address(poker),
            address(auction)
        );

        // Authorize game contracts in Escrow and Registry
        escrow.authorizeContract(address(rps), true);
        escrow.authorizeContract(address(poker), true);
        escrow.authorizeContract(address(auction), true);
        registry.authorizeContract(address(rps), true);
        registry.authorizeContract(address(poker), true);
        registry.authorizeContract(address(auction), true);

        // Fund players generously
        vm.deal(player1, 100 ether);
        vm.deal(player2, 100 ether);
        vm.deal(player3, 100 ether);
        vm.deal(player4, 100 ether);

        // Register all players as agents for all game types
        AgentRegistry.GameType[] memory gameTypes = new AgentRegistry.GameType[](3);
        gameTypes[0] = AgentRegistry.GameType.RPS;
        gameTypes[1] = AgentRegistry.GameType.Poker;
        gameTypes[2] = AgentRegistry.GameType.Auction;

        vm.prank(player1);
        registry.register(gameTypes, 0.001 ether, 10 ether);
        vm.prank(player2);
        registry.register(gameTypes, 0.001 ether, 10 ether);
        vm.prank(player3);
        registry.register(gameTypes, 0.001 ether, 10 ether);
        vm.prank(player4);
        registry.register(gameTypes, 0.001 ether, 10 ether);
    }

    // ─── Helpers ─────────────────────────────────────────────────────────

    /// @dev Create a 4-player tournament and register all players
    function _createAndFillTournament(uint256 entryFee, uint256 baseWager) internal returns (uint256 tid) {
        tid = tournament.createTournament(entryFee, baseWager, 4);

        vm.prank(player1);
        tournament.register{value: entryFee}(tid);
        vm.prank(player2);
        tournament.register{value: entryFee}(tid);
        vm.prank(player3);
        tournament.register{value: entryFee}(tid);
        vm.prank(player4);
        tournament.register{value: entryFee}(tid);
    }

    /// @dev Play a full RPS game between two players. player_a wins.
    /// Creates escrow match, accepts, creates game, plays 1 round where playerA wins.
    /// Returns the escrow match ID.
    function _playRPSMatch(
        address playerA,
        address playerB,
        uint256 wager
    ) internal returns (uint256 escrowMatchId) {
        // Create escrow match
        vm.prank(playerA);
        escrowMatchId = escrow.createMatch{value: wager}(playerB, address(rps));

        // Accept escrow match
        vm.prank(playerB);
        escrow.acceptMatch{value: wager}(escrowMatchId);

        // Create RPS game (best of 1)
        vm.prank(playerA);
        uint256 gameId = rps.createGame(escrowMatchId, 1);

        // playerA plays Rock, playerB plays Scissors → playerA wins
        vm.prank(playerA);
        rps.commit(gameId, keccak256(abi.encodePacked(uint8(1), salt1))); // Rock
        vm.prank(playerB);
        rps.commit(gameId, keccak256(abi.encodePacked(uint8(3), salt2))); // Scissors

        vm.prank(playerA);
        rps.reveal(gameId, RPSGame.Move.Rock, salt1);
        vm.prank(playerB);
        rps.reveal(gameId, RPSGame.Move.Scissors, salt2);

        // Game should be settled now
        RPSGame.Game memory g = rps.getGame(gameId);
        assertTrue(g.settled, "RPS game should be settled");
    }

    /// @dev Compute commit hash for an RPS move
    function _commitHash(RPSGame.Move move, bytes32 salt) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(uint8(move), salt));
    }

    // ─── Tournament Creation Tests ───────────────────────────────────────

    function test_createTournament() public {
        uint256 tid = tournament.createTournament(0.01 ether, 0.001 ether, 4);

        Tournament.TournamentInfo memory t = tournament.getTournament(tid);
        assertEq(t.entryFee, 0.01 ether);
        assertEq(t.baseWager, 0.001 ether);
        assertEq(t.maxPlayers, 4);
        assertEq(t.playerCount, 0);
        assertEq(t.prizePool, 0);
        assertEq(t.totalRounds, 2); // log2(4) = 2
        assertEq(uint8(t.status), uint8(Tournament.TournamentStatus.Registration));
        assertEq(t.creator, address(this));
    }

    function test_createTournament_8players() public {
        uint256 tid = tournament.createTournament(0.01 ether, 0.001 ether, 8);

        Tournament.TournamentInfo memory t = tournament.getTournament(tid);
        assertEq(t.maxPlayers, 8);
        assertEq(t.totalRounds, 3); // log2(8) = 3
    }

    function test_createTournament_revertInvalidPlayers() public {
        vm.expectRevert("Tournament: must be 4 or 8 players");
        tournament.createTournament(0.01 ether, 0.001 ether, 3);

        vm.expectRevert("Tournament: must be 4 or 8 players");
        tournament.createTournament(0.01 ether, 0.001 ether, 6);
    }

    // ─── Registration Tests ─────────────────────────────────────────────

    function test_register_locksEntryFee() public {
        uint256 entryFee = 0.01 ether;
        uint256 tid = tournament.createTournament(entryFee, 0.001 ether, 4);

        vm.prank(player1);
        tournament.register{value: entryFee}(tid);

        vm.prank(player2);
        tournament.register{value: entryFee}(tid);

        Tournament.TournamentInfo memory t = tournament.getTournament(tid);
        assertEq(t.playerCount, 2);
        assertEq(t.prizePool, entryFee * 2);

        // Register remaining players
        vm.prank(player3);
        tournament.register{value: entryFee}(tid);
        vm.prank(player4);
        tournament.register{value: entryFee}(tid);

        t = tournament.getTournament(tid);
        assertEq(t.playerCount, 4);
        assertEq(t.prizePool, entryFee * 4);
    }

    function test_register_revertIfFull() public {
        uint256 entryFee = 0.01 ether;
        uint256 tid = _createAndFillTournament(entryFee, 0.001 ether);

        // 5th player should be rejected
        address player5 = makeAddr("player5");
        vm.deal(player5, 1 ether);

        vm.prank(player5);
        vm.expectRevert("Tournament: tournament full");
        tournament.register{value: entryFee}(tid);
    }

    function test_register_revertIfWrongFee() public {
        uint256 entryFee = 0.01 ether;
        uint256 tid = tournament.createTournament(entryFee, 0.001 ether, 4);

        // Wrong fee amount
        vm.prank(player1);
        vm.expectRevert("Tournament: wrong entry fee");
        tournament.register{value: 0.005 ether}(tid);
    }

    function test_register_revertIfDuplicate() public {
        uint256 entryFee = 0.01 ether;
        uint256 tid = tournament.createTournament(entryFee, 0.001 ether, 4);

        vm.prank(player1);
        tournament.register{value: entryFee}(tid);

        // Same player again
        vm.prank(player1);
        vm.expectRevert("Tournament: already registered");
        tournament.register{value: entryFee}(tid);
    }

    // ─── Bracket Generation Tests ───────────────────────────────────────

    function test_generateBracket_correctSeeding() public {
        uint256 entryFee = 0.01 ether;
        uint256 tid = _createAndFillTournament(entryFee, 0.001 ether);

        tournament.generateBracket(tid);

        // Verify status changed
        Tournament.TournamentInfo memory t = tournament.getTournament(tid);
        assertEq(uint8(t.status), uint8(Tournament.TournamentStatus.Active));

        // Sequential seeding: 1v4, 2v3
        Tournament.BracketMatch memory m0 = tournament.getBracketMatch(tid, 0, 0);
        assertEq(m0.player1, player1); // seed 1
        assertEq(m0.player2, player4); // seed 4

        Tournament.BracketMatch memory m1 = tournament.getBracketMatch(tid, 0, 1);
        assertEq(m1.player1, player2); // seed 2
        assertEq(m1.player2, player3); // seed 3
    }

    function test_generateBracket_revertIfNotFull() public {
        uint256 entryFee = 0.01 ether;
        uint256 tid = tournament.createTournament(entryFee, 0.001 ether, 4);

        // Only register 2 players
        vm.prank(player1);
        tournament.register{value: entryFee}(tid);
        vm.prank(player2);
        tournament.register{value: entryFee}(tid);

        vm.expectRevert("Tournament: not full yet");
        tournament.generateBracket(tid);
    }

    // ─── Result Reporting Tests ──────────────────────────────────────────

    function test_reportResult_validSettlement() public {
        uint256 entryFee = 0.01 ether;
        uint256 wager = 0.001 ether;
        uint256 tid = _createAndFillTournament(entryFee, wager);
        tournament.generateBracket(tid);

        // Play match 0 (player1 vs player4): player1 wins via RPS
        uint256 escrowMatchId = _playRPSMatch(player1, player4, wager);

        // Report the result
        tournament.reportResult(tid, 0, 0, escrowMatchId, player1);

        // Verify match recorded
        Tournament.BracketMatch memory m = tournament.getBracketMatch(tid, 0, 0);
        assertTrue(m.reported);
        assertEq(m.winner, player1);
        assertEq(m.escrowMatchId, escrowMatchId);
    }

    function test_reportResult_revertIfWrongPlayers() public {
        uint256 entryFee = 0.01 ether;
        uint256 wager = 0.001 ether;
        uint256 tid = _createAndFillTournament(entryFee, wager);
        tournament.generateBracket(tid);

        // Play an RPS match between wrong pair (player1 vs player2)
        // but match 0 expects player1 vs player4
        uint256 escrowMatchId = _playRPSMatch(player1, player2, wager);

        // Try to report with mismatched participants
        vm.expectRevert("Tournament: escrow participants mismatch");
        tournament.reportResult(tid, 0, 0, escrowMatchId, player1);
    }

    function test_reportResult_revertIfWrongGameType() public {
        uint256 entryFee = 0.01 ether;
        uint256 wager = 0.001 ether;
        uint256 tid = _createAndFillTournament(entryFee, wager);
        tournament.generateBracket(tid);

        // Round 0 expects RPS (round % 3 == 0). Play a poker match instead.
        // Create escrow match pointing to PokerGame
        vm.prank(player1);
        uint256 escrowMatchId = escrow.createMatch{value: wager}(player4, address(poker));
        vm.prank(player4);
        escrow.acceptMatch{value: wager}(escrowMatchId);

        // Create and play poker game to settle it
        vm.prank(player1);
        uint256 gameId = poker.createGame(escrowMatchId);

        // Both commit hands
        bytes32 h1 = keccak256(abi.encodePacked(uint8(90), salt1));
        bytes32 h2 = keccak256(abi.encodePacked(uint8(10), salt2));
        vm.prank(player1);
        poker.commitHand(gameId, h1);
        vm.prank(player4);
        poker.commitHand(gameId, h2);

        // Both check through betting rounds
        vm.prank(player1);
        poker.takeAction(gameId, PokerGame.Action.Check);
        vm.prank(player4);
        poker.takeAction(gameId, PokerGame.Action.Check);
        vm.prank(player1);
        poker.takeAction(gameId, PokerGame.Action.Check);
        vm.prank(player4);
        poker.takeAction(gameId, PokerGame.Action.Check);

        // Both reveal
        vm.prank(player1);
        poker.revealHand(gameId, 90, salt1);
        vm.prank(player4);
        poker.revealHand(gameId, 10, salt2);

        // Try to report poker match for round 0 (expected RPS)
        vm.expectRevert("Tournament: wrong game type for round");
        tournament.reportResult(tid, 0, 0, escrowMatchId, player1);
    }

    // ─── Round Advancement Tests ─────────────────────────────────────────

    function test_roundAdvancement() public {
        uint256 entryFee = 0.01 ether;
        uint256 wager = 0.001 ether;
        uint256 tid = _createAndFillTournament(entryFee, wager);
        tournament.generateBracket(tid);

        // Play and report match 0: player1 beats player4
        uint256 eid0 = _playRPSMatch(player1, player4, wager);
        tournament.reportResult(tid, 0, 0, eid0, player1);

        // Round shouldn't advance yet (match 1 still pending)
        Tournament.TournamentInfo memory t = tournament.getTournament(tid);
        assertEq(t.currentRound, 0);

        // Play and report match 1: player2 beats player3
        uint256 eid1 = _playRPSMatch(player2, player3, wager);
        tournament.reportResult(tid, 0, 1, eid1, player2);

        // Now round should advance to 1
        t = tournament.getTournament(tid);
        assertEq(t.currentRound, 1);
        assertEq(uint8(t.status), uint8(Tournament.TournamentStatus.Active));

        // Verify round 1 bracket: player1 vs player2
        Tournament.BracketMatch memory m = tournament.getBracketMatch(tid, 1, 0);
        assertEq(m.player1, player1);
        assertEq(m.player2, player2);
    }

    // ─── Full Tournament Tests ───────────────────────────────────────────

    function test_full4PlayerTournament() public {
        uint256 entryFee = 0.1 ether;
        uint256 wager = 0.001 ether;
        uint256 tid = _createAndFillTournament(entryFee, wager);
        tournament.generateBracket(tid);

        // === Round 0 (RPS, wager=0.001 ether) ===
        // Match 0: player1 beats player4
        uint256 eid0 = _playRPSMatch(player1, player4, wager);
        tournament.reportResult(tid, 0, 0, eid0, player1);

        // Match 1: player2 beats player3
        uint256 eid1 = _playRPSMatch(player2, player3, wager);
        tournament.reportResult(tid, 0, 1, eid1, player2);

        // Round advances to 1
        Tournament.TournamentInfo memory t = tournament.getTournament(tid);
        assertEq(t.currentRound, 1);

        // === Round 1 (Poker, wager=0.002 ether) ===
        uint256 round1Wager = tournament.getRoundWager(tid, 1);
        assertEq(round1Wager, 0.002 ether); // baseWager * 2^1

        // Verify game type for round 1 is Poker
        assertEq(tournament.getGameTypeForRound(1), address(poker));

        // Create and play a poker match: player1 beats player2
        vm.prank(player1);
        uint256 eid2 = escrow.createMatch{value: round1Wager}(player2, address(poker));
        vm.prank(player2);
        escrow.acceptMatch{value: round1Wager}(eid2);

        vm.prank(player1);
        uint256 pokerGameId = poker.createGame(eid2);

        // Commit hands: player1=90, player2=10
        vm.prank(player1);
        poker.commitHand(pokerGameId, keccak256(abi.encodePacked(uint8(90), salt1)));
        vm.prank(player2);
        poker.commitHand(pokerGameId, keccak256(abi.encodePacked(uint8(10), salt2)));

        // Both check through both betting rounds
        vm.prank(player1);
        poker.takeAction(pokerGameId, PokerGame.Action.Check);
        vm.prank(player2);
        poker.takeAction(pokerGameId, PokerGame.Action.Check);
        vm.prank(player1);
        poker.takeAction(pokerGameId, PokerGame.Action.Check);
        vm.prank(player2);
        poker.takeAction(pokerGameId, PokerGame.Action.Check);

        // Reveal
        vm.prank(player1);
        poker.revealHand(pokerGameId, 90, salt1);
        vm.prank(player2);
        poker.revealHand(pokerGameId, 10, salt2);

        // Report final result
        tournament.reportResult(tid, 1, 0, eid2, player1);

        // Tournament should be Complete
        t = tournament.getTournament(tid);
        assertEq(uint8(t.status), uint8(Tournament.TournamentStatus.Complete));
        assertEq(t.winner, player1);
        assertEq(t.runnerUp, player2);
    }

    // ─── Prize Distribution Tests ────────────────────────────────────────

    function test_distributePrizes_correctSplit() public {
        uint256 entryFee = 1 ether;
        uint256 wager = 0.001 ether;
        uint256 tid = _createAndFillTournament(entryFee, wager);
        tournament.generateBracket(tid);

        // Play full tournament: player1 wins
        // Round 0: player1 beats player4, player2 beats player3
        uint256 eid0 = _playRPSMatch(player1, player4, wager);
        tournament.reportResult(tid, 0, 0, eid0, player1);
        uint256 eid1 = _playRPSMatch(player2, player3, wager);
        tournament.reportResult(tid, 0, 1, eid1, player2);

        // Round 1: player1 beats player2 (poker)
        uint256 r1Wager = tournament.getRoundWager(tid, 1);
        vm.prank(player1);
        uint256 eid2 = escrow.createMatch{value: r1Wager}(player2, address(poker));
        vm.prank(player2);
        escrow.acceptMatch{value: r1Wager}(eid2);
        vm.prank(player1);
        uint256 pgId = poker.createGame(eid2);
        vm.prank(player1);
        poker.commitHand(pgId, keccak256(abi.encodePacked(uint8(90), salt1)));
        vm.prank(player2);
        poker.commitHand(pgId, keccak256(abi.encodePacked(uint8(10), salt2)));
        vm.prank(player1);
        poker.takeAction(pgId, PokerGame.Action.Check);
        vm.prank(player2);
        poker.takeAction(pgId, PokerGame.Action.Check);
        vm.prank(player1);
        poker.takeAction(pgId, PokerGame.Action.Check);
        vm.prank(player2);
        poker.takeAction(pgId, PokerGame.Action.Check);
        vm.prank(player1);
        poker.revealHand(pgId, 90, salt1);
        vm.prank(player2);
        poker.revealHand(pgId, 10, salt2);
        tournament.reportResult(tid, 1, 0, eid2, player1);

        // Now distribute prizes
        uint256 pool = entryFee * 4; // 4 ether
        uint256 p1Before = player1.balance;
        uint256 p2Before = player2.balance;
        uint256 p3Before = player3.balance;
        uint256 p4Before = player4.balance;

        tournament.distributePrizes(tid);

        // Winner: 60% = 2.4 ether
        assertEq(player1.balance - p1Before, (pool * 60) / 100);
        // Runner-up: 25% = 1.0 ether
        assertEq(player2.balance - p2Before, (pool * 25) / 100);

        // Semifinalists: remaining 15% split
        // In a 4-player tournament, losers of round 0 are semifinalists
        // player3 lost to player2, player4 lost to player1
        // But runner-up (player2) already got their share, so only the non-finalist losers
        // from the semifinal round (round 0) get the semifinalist prize
        // The remaining 0.6 ether goes to semifinalists
        uint256 remaining = pool - (pool * 60) / 100 - (pool * 25) / 100;
        // player3 and player4 are semifinalists
        // But player4 lost to player1 in round 0, and player3 lost to player2 in round 0
        // The runner-up is player2 (who lost the final), so player3 (who also lost to player2) is NOT the runner-up
        // Both player3 and player4 should be semifinalists
        uint256 perSemi = remaining / 2;
        // Check that semifinalists got paid (either p3 or p4 got perSemi)
        uint256 p3Gain = player3.balance - p3Before;
        uint256 p4Gain = player4.balance - p4Before;
        assertEq(p3Gain + p4Gain, remaining);
        assertEq(p3Gain, perSemi);
        assertEq(p4Gain, perSemi);
    }

    function test_distributePrizes_revertIfNotComplete() public {
        uint256 entryFee = 0.01 ether;
        uint256 tid = _createAndFillTournament(entryFee, 0.001 ether);
        tournament.generateBracket(tid);

        // Tournament is Active but not Complete
        vm.expectRevert("Tournament: not complete");
        tournament.distributePrizes(tid);
    }

    // ─── Escalating Stakes Tests ─────────────────────────────────────────

    function test_escalatingStakes() public {
        uint256 baseWager = 0.001 ether;
        uint256 tid = tournament.createTournament(0.01 ether, baseWager, 8);

        // Round 0: baseWager * 2^0 = 0.001 ether
        assertEq(tournament.getRoundWager(tid, 0), baseWager);
        // Round 1: baseWager * 2^1 = 0.002 ether
        assertEq(tournament.getRoundWager(tid, 1), baseWager * 2);
        // Round 2: baseWager * 2^2 = 0.004 ether
        assertEq(tournament.getRoundWager(tid, 2), baseWager * 4);
    }

    // ─── Game Type Rotation Tests ────────────────────────────────────────

    function test_gameTypeRotation() public {
        // Round 0: RPS (0 % 3 == 0)
        assertEq(tournament.getGameTypeForRound(0), address(rps));
        // Round 1: Poker (1 % 3 == 1)
        assertEq(tournament.getGameTypeForRound(1), address(poker));
        // Round 2: Auction (2 % 3 == 2)
        assertEq(tournament.getGameTypeForRound(2), address(auction));
        // Round 3: RPS again (3 % 3 == 0)
        assertEq(tournament.getGameTypeForRound(3), address(rps));
    }

    // ─── Cancel Tournament Tests ─────────────────────────────────────────

    function test_cancelTournament_refunds() public {
        uint256 entryFee = 0.5 ether;
        uint256 tid = tournament.createTournament(entryFee, 0.001 ether, 4);

        uint256 p1Before = player1.balance;
        uint256 p2Before = player2.balance;

        vm.prank(player1);
        tournament.register{value: entryFee}(tid);
        vm.prank(player2);
        tournament.register{value: entryFee}(tid);

        // Balances should be reduced by entry fee
        assertEq(player1.balance, p1Before - entryFee);
        assertEq(player2.balance, p2Before - entryFee);

        // Cancel (creator is address(this))
        tournament.cancelTournament(tid);

        // Balances should be restored
        assertEq(player1.balance, p1Before);
        assertEq(player2.balance, p2Before);

        // Status should be Cancelled
        Tournament.TournamentInfo memory t = tournament.getTournament(tid);
        assertEq(uint8(t.status), uint8(Tournament.TournamentStatus.Cancelled));
        assertEq(t.prizePool, 0);
    }

    function test_cancelTournament_revertIfActive() public {
        uint256 entryFee = 0.01 ether;
        uint256 tid = _createAndFillTournament(entryFee, 0.001 ether);
        tournament.generateBracket(tid);

        // Can't cancel an active tournament
        vm.expectRevert("Tournament: can only cancel during registration");
        tournament.cancelTournament(tid);
    }

    // ─── View Functions ──────────────────────────────────────────────────

    function test_getParticipants() public {
        uint256 entryFee = 0.01 ether;
        uint256 tid = _createAndFillTournament(entryFee, 0.001 ether);

        address[] memory players = tournament.getParticipants(tid);
        assertEq(players.length, 4);
        assertEq(players[0], player1);
        assertEq(players[1], player2);
        assertEq(players[2], player3);
        assertEq(players[3], player4);
    }

    function test_getMatchCountForRound() public {
        // 4-player tournament: 2 matches in round 0, 1 in round 1
        uint256 tid = tournament.createTournament(0.01 ether, 0.001 ether, 4);
        assertEq(tournament.getMatchCountForRound(tid, 0), 2);
        assertEq(tournament.getMatchCountForRound(tid, 1), 1);
    }
}
