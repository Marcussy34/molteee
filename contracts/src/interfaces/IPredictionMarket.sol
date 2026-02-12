// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title IPredictionMarket — Minimal interface for Escrow auto-market lifecycle
/// @notice Used by Escrow to avoid circular dependency (PredictionMarket already imports Escrow).
interface IPredictionMarket {
    /// @notice Create a prediction market for an active escrow match
    /// @param _matchId Escrow match ID (must be Active)
    /// @return marketId The new market ID
    function createMarket(uint256 _matchId) external payable returns (uint256 marketId);

    /// @notice Resolve a market by match ID (winner determined from Escrow.winners)
    /// @param _matchId Escrow match ID
    function resolveByMatch(uint256 _matchId) external;

    /// @notice Resolve a market as draw by match ID
    /// @param _matchId Escrow match ID
    function resolveDrawByMatch(uint256 _matchId) external;
}
