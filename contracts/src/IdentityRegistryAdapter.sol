// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./interfaces/IIdentityRegistry.sol";

/// @title ERC-8004 Identity Registry Adapter
/// @notice Bridges AgentRegistry's registerAgent(address) calls to the real
///         ERC-8004 Identity Registry's register(string) function.
///         The real registry mints NFTs to msg.sender, so this adapter:
///         1. Calls register("") — NFT minted to this adapter
///         2. Transfers the NFT to the actual agent wallet
///         3. Returns the token ID to AgentRegistry for storage
///
///         Deploy this, then call AgentRegistry.setIdentityRegistry(adapterAddr).
interface IRealIdentityRegistry {
    function register(string calldata agentURI) external returns (uint256);
    function ownerOf(uint256 tokenId) external view returns (address);
    function getAgentWallet(uint256 agentId) external view returns (address);
    /// @dev ERC-721 transfer (the real registry is an ERC-721 NFT)
    function transferFrom(address from, address to, uint256 tokenId) external;
}

contract IdentityRegistryAdapter is IIdentityRegistry {
    /// @dev The real ERC-8004 Identity Registry on Monad mainnet
    IRealIdentityRegistry public immutable realRegistry;

    constructor(address _realRegistry) {
        realRegistry = IRealIdentityRegistry(_realRegistry);
    }

    /// @notice Called by AgentRegistry during register(). Mints an ERC-8004
    ///         identity token and transfers it to the agent wallet.
    /// @param wallet The agent's wallet address (passed by AgentRegistry)
    /// @return agentId The newly minted token ID
    function registerAgent(address wallet) external override returns (uint256 agentId) {
        // Mint identity NFT — goes to this adapter (msg.sender of the real registry call)
        agentId = realRegistry.register("");
        // Transfer NFT ownership to the actual agent wallet
        realRegistry.transferFrom(address(this), wallet, agentId);
    }

    /// @notice Pass-through to real registry
    function ownerOf(uint256 tokenId) external view override returns (address) {
        return realRegistry.ownerOf(tokenId);
    }

    /// @notice Pass-through to real registry
    function getAgentWallet(uint256 agentId) external view override returns (address) {
        return realRegistry.getAgentWallet(agentId);
    }

    /// @dev Accept ERC-721 tokens (needed for safeTransferFrom if used)
    function onERC721Received(address, address, uint256, bytes calldata) external pure returns (bytes4) {
        return this.onERC721Received.selector;
    }
}
