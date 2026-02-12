// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import "../src/Escrow.sol";

contract EscrowTest is Test {
    Escrow public escrow;

    address public owner = address(this);
    address public player1 = address(0x1);
    address public player2 = address(0x2);
    address public gameContract = address(0xCA3E);

    function setUp() public {
        escrow = new Escrow();

        // Authorize the game contract
        escrow.authorizeContract(gameContract, true);

        // Fund players
        vm.deal(player1, 10 ether);
        vm.deal(player2, 10 ether);
    }

    // ─── Create Match Tests ──────────────────────────────────────────────

    function test_createMatch() public {
        vm.prank(player1);
        uint256 matchId = escrow.createMatch{value: 1 ether}(player2, gameContract);

        Escrow.Match memory m = escrow.getMatch(matchId);
        assertEq(m.player1, player1);
        assertEq(m.player2, player2);
        assertEq(m.wager, 1 ether);
        assertEq(m.gameContract, gameContract);
        assertEq(uint8(m.status), uint8(Escrow.MatchStatus.Created));
    }

    function test_createMatch_revertZeroWager() public {
        vm.prank(player1);
        vm.expectRevert("Escrow: wager must be > 0");
        escrow.createMatch{value: 0}(player2, gameContract);
    }

    function test_createMatch_revertSelf() public {
        vm.prank(player1);
        vm.expectRevert("Escrow: cannot challenge self");
        escrow.createMatch{value: 1 ether}(player1, gameContract);
    }

    function test_createMatch_revertUnauthorizedGame() public {
        address badGame = address(0xBAD);
        vm.prank(player1);
        vm.expectRevert("Escrow: game contract not authorized");
        escrow.createMatch{value: 1 ether}(player2, badGame);
    }

    // ─── Accept Match Tests ──────────────────────────────────────────────

    function test_acceptMatch() public {
        vm.prank(player1);
        uint256 matchId = escrow.createMatch{value: 1 ether}(player2, gameContract);

        vm.prank(player2);
        escrow.acceptMatch{value: 1 ether}(matchId);

        Escrow.Match memory m = escrow.getMatch(matchId);
        assertEq(uint8(m.status), uint8(Escrow.MatchStatus.Active));
    }

    function test_acceptMatch_revertWrongPlayer() public {
        vm.prank(player1);
        uint256 matchId = escrow.createMatch{value: 1 ether}(player2, gameContract);

        address rando = address(0x3);
        vm.deal(rando, 10 ether);
        vm.prank(rando);
        vm.expectRevert("Escrow: not the designated opponent");
        escrow.acceptMatch{value: 1 ether}(matchId);
    }

    function test_acceptMatch_revertWagerMismatch() public {
        vm.prank(player1);
        uint256 matchId = escrow.createMatch{value: 1 ether}(player2, gameContract);

        vm.prank(player2);
        vm.expectRevert("Escrow: must match wager amount");
        escrow.acceptMatch{value: 0.5 ether}(matchId);
    }

    // ─── Settle Tests ────────────────────────────────────────────────────

    function test_settle_winner() public {
        // Create and accept match
        vm.prank(player1);
        uint256 matchId = escrow.createMatch{value: 1 ether}(player2, gameContract);
        vm.prank(player2);
        escrow.acceptMatch{value: 1 ether}(matchId);

        uint256 balBefore = player1.balance;

        // Settle — player1 wins
        vm.prank(gameContract);
        escrow.settle(matchId, player1);

        assertEq(player1.balance, balBefore + 2 ether);

        Escrow.Match memory m = escrow.getMatch(matchId);
        assertEq(uint8(m.status), uint8(Escrow.MatchStatus.Settled));
    }

    function test_settle_revertUnauthorized() public {
        vm.prank(player1);
        uint256 matchId = escrow.createMatch{value: 1 ether}(player2, gameContract);
        vm.prank(player2);
        escrow.acceptMatch{value: 1 ether}(matchId);

        vm.prank(player1); // not authorized
        vm.expectRevert("Escrow: not authorized");
        escrow.settle(matchId, player1);
    }

    function test_settle_revertWrongGameContract() public {
        // Authorize a second game contract
        address otherGame = address(0xDEAD);
        escrow.authorizeContract(otherGame, true);

        vm.prank(player1);
        uint256 matchId = escrow.createMatch{value: 1 ether}(player2, gameContract);
        vm.prank(player2);
        escrow.acceptMatch{value: 1 ether}(matchId);

        // Wrong game contract tries to settle
        vm.prank(otherGame);
        vm.expectRevert("Escrow: wrong game contract");
        escrow.settle(matchId, player1);
    }

    // ─── Draw Tests ──────────────────────────────────────────────────────

    function test_settleDraw() public {
        vm.prank(player1);
        uint256 matchId = escrow.createMatch{value: 1 ether}(player2, gameContract);
        vm.prank(player2);
        escrow.acceptMatch{value: 1 ether}(matchId);

        uint256 bal1Before = player1.balance;
        uint256 bal2Before = player2.balance;

        vm.prank(gameContract);
        escrow.settleDraw(matchId);

        assertEq(player1.balance, bal1Before + 1 ether);
        assertEq(player2.balance, bal2Before + 1 ether);
    }

    // ─── Cancel / Timeout Tests ──────────────────────────────────────────

    function test_cancelMatch_afterTimeout() public {
        vm.prank(player1);
        uint256 matchId = escrow.createMatch{value: 1 ether}(player2, gameContract);

        uint256 balBefore = player1.balance;

        // Warp past timeout
        vm.warp(block.timestamp + 1 hours + 1);

        vm.prank(player1);
        escrow.cancelMatch(matchId);

        assertEq(player1.balance, balBefore + 1 ether);
        Escrow.Match memory m = escrow.getMatch(matchId);
        assertEq(uint8(m.status), uint8(Escrow.MatchStatus.Cancelled));
    }

    function test_cancelMatch_revertBeforeTimeout() public {
        vm.prank(player1);
        uint256 matchId = escrow.createMatch{value: 1 ether}(player2, gameContract);

        vm.prank(player1);
        vm.expectRevert("Escrow: timeout not reached");
        escrow.cancelMatch(matchId);
    }

    function test_cancelMatch_revertNotChallenger() public {
        vm.prank(player1);
        uint256 matchId = escrow.createMatch{value: 1 ether}(player2, gameContract);

        vm.warp(block.timestamp + 1 hours + 1);

        vm.prank(player2);
        vm.expectRevert("Escrow: only challenger can cancel");
        escrow.cancelMatch(matchId);
    }

    // ─── Authorization Tests ─────────────────────────────────────────────

    function test_authorizeContract() public {
        address newGame = address(0xAE3);
        escrow.authorizeContract(newGame, true);
        assertTrue(escrow.authorizedContracts(newGame));
    }

    function test_authorizeContract_revertNotOwner() public {
        vm.prank(player1);
        vm.expectRevert();
        escrow.authorizeContract(gameContract, false);
    }

    // ─── Escrow Balance Tests ────────────────────────────────────────────

    function test_escrowHoldsCorrectBalance() public {
        vm.prank(player1);
        escrow.createMatch{value: 1 ether}(player2, gameContract);

        assertEq(address(escrow).balance, 1 ether);

        vm.prank(player2);
        escrow.acceptMatch{value: 1 ether}(0);

        assertEq(address(escrow).balance, 2 ether);
    }
}
