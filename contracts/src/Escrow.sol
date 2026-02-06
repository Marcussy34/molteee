// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title Escrow — Wager locking and payout for arena matches
/// @notice Handles MON escrow for all game types.
///         Game contracts call settle/settleDraw after match completion.
contract Escrow is Ownable, ReentrancyGuard {
    // ─── Types ───────────────────────────────────────────────────────────

    enum MatchStatus { Created, Active, Settled, Cancelled }

    struct Match {
        address player1;        // challenger (creator)
        address player2;        // opponent (acceptor)
        uint256 wager;          // wager amount per player (in wei)
        address gameContract;   // which game contract manages this match
        MatchStatus status;
        uint256 createdAt;
    }

    // ─── Storage ─────────────────────────────────────────────────────────

    /// @dev Auto-incrementing match ID counter
    uint256 public nextMatchId;

    /// @dev matchId => Match data
    mapping(uint256 => Match) public matches;

    /// @dev Contracts authorized to call settle / settleDraw
    mapping(address => bool) public authorizedContracts;

    /// @dev Timeout period — if opponent doesn't accept within this, challenger can cancel
    uint256 public constant ACCEPT_TIMEOUT = 1 hours;

    // ─── Events ──────────────────────────────────────────────────────────

    event MatchCreated(uint256 indexed matchId, address indexed player1, address indexed player2, uint256 wager, address gameContract);
    event MatchAccepted(uint256 indexed matchId, address indexed player2);
    event MatchSettled(uint256 indexed matchId, address indexed winner, uint256 payout);
    event MatchDraw(uint256 indexed matchId);
    event MatchCancelled(uint256 indexed matchId);
    event ContractAuthorized(address indexed contractAddr, bool authorized);

    // ─── Modifiers ───────────────────────────────────────────────────────

    modifier onlyAuthorized() {
        require(authorizedContracts[msg.sender], "Escrow: not authorized");
        _;
    }

    // ─── Constructor ─────────────────────────────────────────────────────

    constructor() Ownable(msg.sender) {}

    // ─── Public Functions ────────────────────────────────────────────────

    /// @notice Create an escrow match — locks challenger's wager
    /// @param _opponent     Address of the opponent
    /// @param _gameContract Address of the game contract that will manage this match
    /// @return matchId      The ID of the newly created match
    function createMatch(
        address _opponent,
        address _gameContract
    ) external payable returns (uint256 matchId) {
        require(msg.value > 0, "Escrow: wager must be > 0");
        require(_opponent != address(0), "Escrow: invalid opponent");
        require(_opponent != msg.sender, "Escrow: cannot challenge self");
        require(authorizedContracts[_gameContract], "Escrow: game contract not authorized");

        matchId = nextMatchId++;
        matches[matchId] = Match({
            player1: msg.sender,
            player2: _opponent,
            wager: msg.value,
            gameContract: _gameContract,
            status: MatchStatus.Created,
            createdAt: block.timestamp
        });

        emit MatchCreated(matchId, msg.sender, _opponent, msg.value, _gameContract);
    }

    /// @notice Accept an escrow match — locks opponent's matching wager
    /// @param _matchId The match to accept
    function acceptMatch(uint256 _matchId) external payable nonReentrant {
        Match storage m = matches[_matchId];
        require(m.status == MatchStatus.Created, "Escrow: match not in Created state");
        require(msg.sender == m.player2, "Escrow: not the designated opponent");
        require(msg.value == m.wager, "Escrow: must match wager amount");

        m.status = MatchStatus.Active;
        emit MatchAccepted(_matchId, msg.sender);
    }

    /// @notice Settle a match — winner receives both wagers
    /// @dev Only callable by authorized game contracts
    /// @param _matchId The match to settle
    /// @param _winner  Address of the winner (must be player1 or player2)
    function settle(uint256 _matchId, address _winner) external onlyAuthorized nonReentrant {
        Match storage m = matches[_matchId];
        require(m.status == MatchStatus.Active, "Escrow: match not Active");
        require(_winner == m.player1 || _winner == m.player2, "Escrow: winner not a participant");
        require(msg.sender == m.gameContract, "Escrow: wrong game contract");

        m.status = MatchStatus.Settled;
        uint256 payout = m.wager * 2;

        // Transfer winnings
        (bool success, ) = _winner.call{value: payout}("");
        require(success, "Escrow: payout transfer failed");

        emit MatchSettled(_matchId, _winner, payout);
    }

    /// @notice Settle a draw — both players get their wager back
    /// @dev Only callable by authorized game contracts
    function settleDraw(uint256 _matchId) external onlyAuthorized nonReentrant {
        Match storage m = matches[_matchId];
        require(m.status == MatchStatus.Active, "Escrow: match not Active");
        require(msg.sender == m.gameContract, "Escrow: wrong game contract");

        m.status = MatchStatus.Settled;

        // Return wagers to both players
        (bool s1, ) = m.player1.call{value: m.wager}("");
        require(s1, "Escrow: refund to player1 failed");

        (bool s2, ) = m.player2.call{value: m.wager}("");
        require(s2, "Escrow: refund to player2 failed");

        emit MatchDraw(_matchId);
    }

    /// @notice Cancel a match if opponent hasn't accepted within timeout
    /// @dev Only callable by the challenger (player1)
    function cancelMatch(uint256 _matchId) external nonReentrant {
        Match storage m = matches[_matchId];
        require(m.status == MatchStatus.Created, "Escrow: match not in Created state");
        require(msg.sender == m.player1, "Escrow: only challenger can cancel");
        require(block.timestamp >= m.createdAt + ACCEPT_TIMEOUT, "Escrow: timeout not reached");

        m.status = MatchStatus.Cancelled;

        // Refund challenger's wager
        (bool success, ) = m.player1.call{value: m.wager}("");
        require(success, "Escrow: refund failed");

        emit MatchCancelled(_matchId);
    }

    // ─── View Functions ──────────────────────────────────────────────────

    /// @notice Get match details
    function getMatch(uint256 _matchId) external view returns (Match memory) {
        return matches[_matchId];
    }

    // ─── Owner Functions ─────────────────────────────────────────────────

    /// @notice Authorize or revoke a game contract
    function authorizeContract(address _contract, bool _authorized) external onlyOwner {
        authorizedContracts[_contract] = _authorized;
        emit ContractAuthorized(_contract, _authorized);
    }
}
