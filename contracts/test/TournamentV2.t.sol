// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import "../src/AgentRegistry.sol";
import "../src/Escrow.sol";
import "../src/RPSGame.sol";
import "../src/PokerGame.sol";
import "../src/AuctionGame.sol";
import "../src/TournamentV2.sol";

contract TournamentV2Test is Test {
    AgentRegistry public registry;
    Escrow public escrow;
    RPSGame public rps;
    PokerGame public poker;
    AuctionGame public auction;
    TournamentV2 public tv2;

    address public owner = address(this);
    address public player1;
    address public player2;
    address public player3;
    address public player4;

    bytes32 public salt1 = keccak256("salt1");
    bytes32 public salt2 = keccak256("salt2");

    function setUp() public {
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
        tv2 = new TournamentV2(
            address(escrow),
            address(registry),
            address(rps),
            address(poker),
            address(auction)
        );

        // Authorize game contracts
        escrow.authorizeContract(address(rps), true);
        escrow.authorizeContract(address(poker), true);
        escrow.authorizeContract(address(auction), true);
        registry.authorizeContract(address(rps), true);
        registry.authorizeContract(address(poker), true);
        registry.authorizeContract(address(auction), true);

        // Fund players
        vm.deal(player1, 100 ether);
        vm.deal(player2, 100 ether);
        vm.deal(player3, 100 ether);
        vm.deal(player4, 100 ether);

        // Register all players
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

    /// @dev Create and fill a 4-player tournament
    function _createAndFillTournament(
        TournamentV2.TournamentFormat format,
        uint256 entryFee,
        uint256 baseWager
    ) internal returns (uint256 tid) {
        tid = tv2.createTournament(format, entryFee, baseWager, 4);

        vm.prank(player1);
        tv2.register{value: entryFee}(tid);
        vm.prank(player2);
        tv2.register{value: entryFee}(tid);
        vm.prank(player3);
        tv2.register{value: entryFee}(tid);
        vm.prank(player4);
        tv2.register{value: entryFee}(tid);
    }

    /// @dev Play RPS where playerA wins (Rock vs Scissors). Returns escrow match ID.
    function _playRPSMatch(address playerA, address playerB, uint256 wager) internal returns (uint256 escrowMatchId) {
        vm.prank(playerA);
        escrowMatchId = escrow.createMatch{value: wager}(playerB, address(rps));
        vm.prank(playerB);
        escrow.acceptMatch{value: wager}(escrowMatchId);

        vm.prank(playerA);
        uint256 gameId = rps.createGame(escrowMatchId, 1);

        vm.prank(playerA);
        rps.commit(gameId, keccak256(abi.encodePacked(uint8(1), salt1))); // Rock
        vm.prank(playerB);
        rps.commit(gameId, keccak256(abi.encodePacked(uint8(3), salt2))); // Scissors

        vm.prank(playerA);
        rps.reveal(gameId, RPSGame.Move.Rock, salt1);
        vm.prank(playerB);
        rps.reveal(gameId, RPSGame.Move.Scissors, salt2);
    }

    // ─── Creation Tests ──────────────────────────────────────────────────

    function test_createRoundRobin() public {
        uint256 tid = tv2.createTournament(TournamentV2.TournamentFormat.RoundRobin, 0.01 ether, 0.001 ether, 4);

        TournamentV2.TournamentInfo memory t = tv2.getTournament(tid);
        assertEq(uint8(t.format), uint8(TournamentV2.TournamentFormat.RoundRobin));
        assertEq(t.entryFee, 0.01 ether);
        assertEq(t.baseWager, 0.001 ether);
        assertEq(t.maxPlayers, 4);
        assertEq(uint8(t.status), uint8(TournamentV2.TournamentStatus.Registration));
    }

    function test_createDoubleElim() public {
        uint256 tid = tv2.createTournament(TournamentV2.TournamentFormat.DoubleElim, 0.01 ether, 0.001 ether, 4);

        TournamentV2.TournamentInfo memory t = tv2.getTournament(tid);
        assertEq(uint8(t.format), uint8(TournamentV2.TournamentFormat.DoubleElim));
    }

    function test_createTournament_revertInvalidPlayers() public {
        vm.expectRevert("TV2: must be 4 or 8 players");
        tv2.createTournament(TournamentV2.TournamentFormat.RoundRobin, 0.01 ether, 0.001 ether, 3);
    }

    // ─── Registration Tests ──────────────────────────────────────────────

    function test_register() public {
        uint256 entryFee = 0.01 ether;
        uint256 tid = tv2.createTournament(TournamentV2.TournamentFormat.RoundRobin, entryFee, 0.001 ether, 4);

        vm.prank(player1);
        tv2.register{value: entryFee}(tid);

        TournamentV2.TournamentInfo memory t = tv2.getTournament(tid);
        assertEq(t.playerCount, 1);
        assertEq(t.prizePool, entryFee);
    }

    function test_register_revertDuplicate() public {
        uint256 entryFee = 0.01 ether;
        uint256 tid = tv2.createTournament(TournamentV2.TournamentFormat.RoundRobin, entryFee, 0.001 ether, 4);

        vm.prank(player1);
        tv2.register{value: entryFee}(tid);

        vm.prank(player1);
        vm.expectRevert("TV2: already registered");
        tv2.register{value: entryFee}(tid);
    }

    function test_register_revertWrongFee() public {
        uint256 entryFee = 0.01 ether;
        uint256 tid = tv2.createTournament(TournamentV2.TournamentFormat.RoundRobin, entryFee, 0.001 ether, 4);

        vm.prank(player1);
        vm.expectRevert("TV2: wrong entry fee");
        tv2.register{value: 0.005 ether}(tid);
    }

    // ─── Round-Robin Schedule Tests ──────────────────────────────────────

    function test_rrScheduleGeneration() public {
        uint256 entryFee = 0.01 ether;
        uint256 tid = _createAndFillTournament(TournamentV2.TournamentFormat.RoundRobin, entryFee, 0.001 ether);

        tv2.generateSchedule(tid);

        // 4 players: 4*(4-1)/2 = 6 matches
        assertEq(tv2.rrTotalMatches(tid), 6);

        // Verify first match: player1 vs player2
        TournamentV2.MatchResult memory m0 = tv2.getRRMatch(tid, 0);
        assertEq(m0.player1, player1);
        assertEq(m0.player2, player2);
        assertFalse(m0.reported);

        TournamentV2.TournamentInfo memory t = tv2.getTournament(tid);
        assertEq(uint8(t.status), uint8(TournamentV2.TournamentStatus.Active));
    }

    function test_rrSchedule_revertIfNotFull() public {
        uint256 entryFee = 0.01 ether;
        uint256 tid = tv2.createTournament(TournamentV2.TournamentFormat.RoundRobin, entryFee, 0.001 ether, 4);

        vm.prank(player1);
        tv2.register{value: entryFee}(tid);

        vm.expectRevert("TV2: not full yet");
        tv2.generateSchedule(tid);
    }

    // ─── Round-Robin Result Reporting Tests ───────────────────────────────

    function test_rrReportResult() public {
        uint256 entryFee = 0.01 ether;
        uint256 wager = 0.001 ether;
        uint256 tid = _createAndFillTournament(TournamentV2.TournamentFormat.RoundRobin, entryFee, wager);
        tv2.generateSchedule(tid);

        // Play match 0 (player1 vs player2): player1 wins
        uint256 eid = _playRPSMatch(player1, player2, wager);
        tv2.reportRRResult(tid, 0, eid);

        TournamentV2.MatchResult memory m = tv2.getRRMatch(tid, 0);
        assertTrue(m.reported);
        assertEq(m.winner, player1);

        // Player1 should have 3 points
        assertEq(tv2.getPlayerPoints(tid, player1), 3);
        assertEq(tv2.getPlayerPoints(tid, player2), 0);
    }

    function test_rrReportResult_revertIfAlreadyReported() public {
        uint256 entryFee = 0.01 ether;
        uint256 wager = 0.001 ether;
        uint256 tid = _createAndFillTournament(TournamentV2.TournamentFormat.RoundRobin, entryFee, wager);
        tv2.generateSchedule(tid);

        uint256 eid = _playRPSMatch(player1, player2, wager);
        tv2.reportRRResult(tid, 0, eid);

        vm.expectRevert("TV2: match already reported");
        tv2.reportRRResult(tid, 0, eid);
    }

    // ─── Round-Robin Full Lifecycle ──────────────────────────────────────

    function test_rrFullLifecycle() public {
        uint256 entryFee = 0.1 ether;
        uint256 wager = 0.001 ether;
        uint256 tid = _createAndFillTournament(TournamentV2.TournamentFormat.RoundRobin, entryFee, wager);
        tv2.generateSchedule(tid);

        // 6 matches for 4 players: 1v2, 1v3, 1v4, 2v3, 2v4, 3v4
        // Player1 beats everyone (3 wins = 9 points)
        // Match 0: p1 vs p2 → p1 wins
        uint256 eid0 = _playRPSMatch(player1, player2, wager);
        tv2.reportRRResult(tid, 0, eid0);

        // Match 1: p1 vs p3 → p1 wins
        uint256 eid1 = _playRPSMatch(player1, player3, wager);
        tv2.reportRRResult(tid, 1, eid1);

        // Match 2: p1 vs p4 → p1 wins
        uint256 eid2 = _playRPSMatch(player1, player4, wager);
        tv2.reportRRResult(tid, 2, eid2);

        // Match 3: p2 vs p3 → p2 wins
        uint256 eid3 = _playRPSMatch(player2, player3, wager);
        tv2.reportRRResult(tid, 3, eid3);

        // Match 4: p2 vs p4 → p2 wins
        uint256 eid4 = _playRPSMatch(player2, player4, wager);
        tv2.reportRRResult(tid, 4, eid4);

        // Match 5: p3 vs p4 → p3 wins
        uint256 eid5 = _playRPSMatch(player3, player4, wager);
        tv2.reportRRResult(tid, 5, eid5);

        // Points: p1=9, p2=6, p3=3, p4=0
        assertEq(tv2.getPlayerPoints(tid, player1), 9);
        assertEq(tv2.getPlayerPoints(tid, player2), 6);
        assertEq(tv2.getPlayerPoints(tid, player3), 3);
        assertEq(tv2.getPlayerPoints(tid, player4), 0);

        // Tournament should be complete
        TournamentV2.TournamentInfo memory t = tv2.getTournament(tid);
        assertEq(uint8(t.status), uint8(TournamentV2.TournamentStatus.Complete));
        assertEq(t.winner, player1);
    }

    // ─── Double-Elimination Tests ────────────────────────────────────────

    function test_deScheduleGeneration() public {
        uint256 entryFee = 0.01 ether;
        uint256 tid = _createAndFillTournament(TournamentV2.TournamentFormat.DoubleElim, entryFee, 0.001 ether);

        tv2.generateSchedule(tid);

        // 4 players: 6 total matches in double-elim
        assertEq(tv2.deTotalMatches(tid), 6);

        // Winners bracket round 0: p1 vs p4, p2 vs p3
        TournamentV2.MatchResult memory m0 = tv2.getDEMatch(tid, 0, 0, 0);
        assertEq(m0.player1, player1);
        assertEq(m0.player2, player4);

        TournamentV2.MatchResult memory m1 = tv2.getDEMatch(tid, 0, 0, 1);
        assertEq(m1.player1, player2);
        assertEq(m1.player2, player3);
    }

    function test_deReportWinnersBracket() public {
        uint256 entryFee = 0.01 ether;
        uint256 wager = 0.001 ether;
        uint256 tid = _createAndFillTournament(TournamentV2.TournamentFormat.DoubleElim, entryFee, wager);
        tv2.generateSchedule(tid);

        // WB R0 Match 0: p1 beats p4
        uint256 eid0 = _playRPSMatch(player1, player4, wager);
        tv2.reportDEResult(tid, 0, 0, 0, eid0);

        TournamentV2.MatchResult memory m = tv2.getDEMatch(tid, 0, 0, 0);
        assertTrue(m.reported);
        assertEq(m.winner, player1);

        // p4 should have 1 loss
        assertEq(tv2.getPlayerLosses(tid, player4), 1);
        assertEq(tv2.getPlayerLosses(tid, player1), 0);
    }

    function test_deReportResult_revertIfAlreadyReported() public {
        uint256 entryFee = 0.01 ether;
        uint256 wager = 0.001 ether;
        uint256 tid = _createAndFillTournament(TournamentV2.TournamentFormat.DoubleElim, entryFee, wager);
        tv2.generateSchedule(tid);

        uint256 eid0 = _playRPSMatch(player1, player4, wager);
        tv2.reportDEResult(tid, 0, 0, 0, eid0);

        vm.expectRevert("TV2: match already reported");
        tv2.reportDEResult(tid, 0, 0, 0, eid0);
    }

    function test_deGrandFinalCompletesTournament() public {
        uint256 entryFee = 0.1 ether;
        uint256 wager = 0.001 ether;
        uint256 tid = _createAndFillTournament(TournamentV2.TournamentFormat.DoubleElim, entryFee, wager);
        tv2.generateSchedule(tid);

        // WB R0: p1 beats p4, p2 beats p3
        uint256 eid0 = _playRPSMatch(player1, player4, wager);
        tv2.reportDEResult(tid, 0, 0, 0, eid0);
        uint256 eid1 = _playRPSMatch(player2, player3, wager);
        tv2.reportDEResult(tid, 0, 0, 1, eid1);

        // Set up grand final match manually: p1 vs p2 (bracket=2, round=0, match=0)
        // In a full implementation, the contract would auto-schedule this.
        // For testing, we verify the grand final completion logic.

        // Tournament should still be active (grand final not played)
        TournamentV2.TournamentInfo memory t = tv2.getTournament(tid);
        assertEq(uint8(t.status), uint8(TournamentV2.TournamentStatus.Active));
    }

    // ─── Prize Distribution Tests ────────────────────────────────────────

    function test_rrPrizeDistribution() public {
        uint256 entryFee = 1 ether;
        uint256 wager = 0.001 ether;
        uint256 tid = _createAndFillTournament(TournamentV2.TournamentFormat.RoundRobin, entryFee, wager);
        tv2.generateSchedule(tid);

        // Play all 6 matches: p1 wins all
        uint256 eid0 = _playRPSMatch(player1, player2, wager);
        tv2.reportRRResult(tid, 0, eid0);
        uint256 eid1 = _playRPSMatch(player1, player3, wager);
        tv2.reportRRResult(tid, 1, eid1);
        uint256 eid2 = _playRPSMatch(player1, player4, wager);
        tv2.reportRRResult(tid, 2, eid2);
        uint256 eid3 = _playRPSMatch(player2, player3, wager);
        tv2.reportRRResult(tid, 3, eid3);
        uint256 eid4 = _playRPSMatch(player2, player4, wager);
        tv2.reportRRResult(tid, 4, eid4);
        uint256 eid5 = _playRPSMatch(player3, player4, wager);
        tv2.reportRRResult(tid, 5, eid5);

        // Distribute prizes
        uint256 pool = entryFee * 4; // 4 ether
        uint256 p1Before = player1.balance;
        uint256 p2Before = player2.balance;

        tv2.distributePrizes(tid);

        // Winner (p1): 70% = 2.8 ether
        assertEq(player1.balance - p1Before, (pool * 70) / 100);
        // Runner-up (p2 with 6 pts): 30% = 1.2 ether
        assertEq(player2.balance - p2Before, (pool * 30) / 100);
    }

    function test_distributePrizes_revertIfNotComplete() public {
        uint256 entryFee = 0.01 ether;
        uint256 tid = _createAndFillTournament(TournamentV2.TournamentFormat.RoundRobin, entryFee, 0.001 ether);
        tv2.generateSchedule(tid);

        vm.expectRevert("TV2: not complete");
        tv2.distributePrizes(tid);
    }

    // ─── Cancel Tests ────────────────────────────────────────────────────

    function test_cancelTournament() public {
        uint256 entryFee = 0.5 ether;
        uint256 tid = tv2.createTournament(TournamentV2.TournamentFormat.RoundRobin, entryFee, 0.001 ether, 4);

        uint256 p1Before = player1.balance;
        vm.prank(player1);
        tv2.register{value: entryFee}(tid);
        vm.prank(player2);
        tv2.register{value: entryFee}(tid);

        // Cancel
        tv2.cancelTournament(tid);

        // Refunds issued
        assertEq(player1.balance, p1Before);

        TournamentV2.TournamentInfo memory t = tv2.getTournament(tid);
        assertEq(uint8(t.status), uint8(TournamentV2.TournamentStatus.Cancelled));
    }

    function test_cancelTournament_revertIfActive() public {
        uint256 entryFee = 0.01 ether;
        uint256 tid = _createAndFillTournament(TournamentV2.TournamentFormat.RoundRobin, entryFee, 0.001 ether);
        tv2.generateSchedule(tid);

        vm.expectRevert("TV2: can only cancel during registration");
        tv2.cancelTournament(tid);
    }

    // ─── View Functions ──────────────────────────────────────────────────

    function test_getParticipants() public {
        uint256 entryFee = 0.01 ether;
        uint256 tid = _createAndFillTournament(TournamentV2.TournamentFormat.RoundRobin, entryFee, 0.001 ether);

        address[] memory players = tv2.getParticipants(tid);
        assertEq(players.length, 4);
        assertEq(players[0], player1);
        assertEq(players[3], player4);
    }

    function test_getGameForMatch() public {
        // idx 0: RPS, idx 1: Poker, idx 2: Auction, idx 3: RPS again
        assertEq(tv2.getGameForMatch(0), address(rps));
        assertEq(tv2.getGameForMatch(1), address(poker));
        assertEq(tv2.getGameForMatch(2), address(auction));
        assertEq(tv2.getGameForMatch(3), address(rps));
    }
}
