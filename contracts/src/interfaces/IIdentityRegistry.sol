// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title IIdentityRegistry — Minimal ERC-8004 Identity Registry interface
/// @notice Only includes functions needed for agent ID lookups.
///         Full spec: https://eips.ethereum.org/EIPS/eip-8004
interface IIdentityRegistry {
    /// @notice Get the owner address of an agent token
    /// @param tokenId The agent's ERC-721 token ID
    /// @return The wallet address that owns this agent
    function ownerOf(uint256 tokenId) external view returns (address);

    /// @notice Get the agent wallet address for a given agent ID
    /// @param agentId The agent's token ID
    /// @return The wallet address associated with this agent
    function getAgentWallet(uint256 agentId) external view returns (address);
}
