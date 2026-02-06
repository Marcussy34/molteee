// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title IReputationRegistry — Minimal ERC-8004 Reputation Registry interface
/// @notice Only includes giveFeedback() needed by RPSGame for post-match reputation updates.
///         Full spec: https://eips.ethereum.org/EIPS/eip-8004
interface IReputationRegistry {
    /// @notice Submit feedback for an agent
    /// @param agentId       The ERC-8004 agent token ID (from Identity Registry)
    /// @param value         Feedback value (positive = good, negative = bad)
    /// @param valueDecimals Decimal precision of the value (0 for integer feedback)
    /// @param tag1          Primary category tag (e.g. "RPS")
    /// @param tag2          Secondary tag (e.g. "win" or "loss")
    /// @param endpoint      Optional endpoint URL (empty string if unused)
    /// @param feedbackURI   Optional URI to detailed feedback (empty string if unused)
    /// @param feedbackHash  Optional hash of feedback content (bytes32(0) if unused)
    function giveFeedback(
        uint256 agentId,
        int128 value,
        uint8 valueDecimals,
        string calldata tag1,
        string calldata tag2,
        string calldata endpoint,
        string calldata feedbackURI,
        bytes32 feedbackHash
    ) external;
}
