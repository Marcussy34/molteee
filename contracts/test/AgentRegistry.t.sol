// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import "../src/AgentRegistry.sol";
import "../src/interfaces/IIdentityRegistry.sol";

/// @dev Mock ERC-8004 Identity Registry that assigns sequential agent IDs
contract MockIdentityRegistry is IIdentityRegistry {
    uint256 public nextId = 1;
    mapping(uint256 => address) public owners;
    mapping(uint256 => address) public wallets;

    function ownerOf(uint256 tokenId) external view override returns (address) {
        return owners[tokenId];
    }

    function getAgentWallet(uint256 agentId) external view override returns (address) {
        return wallets[agentId];
    }

    function registerAgent(address wallet) external override returns (uint256 agentId) {
        agentId = nextId++;
        owners[agentId] = wallet;
        wallets[agentId] = wallet;
    }
}

/// @dev Mock Identity Registry that always reverts (for failure testing)
contract FailingIdentityRegistry is IIdentityRegistry {
    function ownerOf(uint256) external pure override returns (address) {
        revert("FailingIdentityRegistry: not supported");
    }

    function getAgentWallet(uint256) external pure override returns (address) {
        revert("FailingIdentityRegistry: not supported");
    }

    function registerAgent(address) external pure override returns (uint256) {
        revert("FailingIdentityRegistry: registration failed");
    }
}

contract AgentRegistryTest is Test {
    AgentRegistry public registry;

    address public owner = address(this);
    address public agent1 = address(0x1);
    address public agent2 = address(0x2);
    address public gameContract = address(0xCA3E);

    // Reusable game types array
    AgentRegistry.GameType[] gameTypes;

    function setUp() public {
        registry = new AgentRegistry();
        gameTypes.push(AgentRegistry.GameType.RPS);
    }

    // ─── Registration Tests ──────────────────────────────────────────────

    function test_register() public {
        vm.prank(agent1);
        registry.register(gameTypes, 0.001 ether, 1 ether);

        AgentRegistry.AgentInfo memory info = registry.getAgent(agent1);
        assertEq(info.wallet, agent1);
        assertTrue(info.isOpen);
        assertTrue(info.exists);
        assertEq(info.minWager, 0.001 ether);
        assertEq(info.maxWager, 1 ether);
        assertEq(info.gameTypes.length, 1);
        assertEq(uint8(info.gameTypes[0]), uint8(AgentRegistry.GameType.RPS));
    }

    function test_register_defaultELO() public {
        vm.prank(agent1);
        registry.register(gameTypes, 0.001 ether, 1 ether);

        uint256 eloRPS = registry.elo(agent1, AgentRegistry.GameType.RPS);
        assertEq(eloRPS, 1000);
    }

    function test_register_multipleGameTypes() public {
        AgentRegistry.GameType[] memory multiTypes = new AgentRegistry.GameType[](3);
        multiTypes[0] = AgentRegistry.GameType.RPS;
        multiTypes[1] = AgentRegistry.GameType.Poker;
        multiTypes[2] = AgentRegistry.GameType.Auction;

        vm.prank(agent1);
        registry.register(multiTypes, 0.001 ether, 1 ether);

        assertEq(registry.elo(agent1, AgentRegistry.GameType.RPS), 1000);
        assertEq(registry.elo(agent1, AgentRegistry.GameType.Poker), 1000);
        assertEq(registry.elo(agent1, AgentRegistry.GameType.Auction), 1000);
    }

    function test_register_revertDoubleRegister() public {
        vm.prank(agent1);
        registry.register(gameTypes, 0.001 ether, 1 ether);

        vm.prank(agent1);
        vm.expectRevert("AgentRegistry: already registered");
        registry.register(gameTypes, 0.001 ether, 1 ether);
    }

    function test_register_revertEmptyGameTypes() public {
        AgentRegistry.GameType[] memory empty = new AgentRegistry.GameType[](0);

        vm.prank(agent1);
        vm.expectRevert("AgentRegistry: need at least one game type");
        registry.register(empty, 0.001 ether, 1 ether);
    }

    function test_register_revertMaxLessThanMin() public {
        vm.prank(agent1);
        vm.expectRevert("AgentRegistry: maxWager < minWager");
        registry.register(gameTypes, 1 ether, 0.001 ether);
    }

    // ─── Status Tests ────────────────────────────────────────────────────

    function test_updateStatus() public {
        vm.prank(agent1);
        registry.register(gameTypes, 0.001 ether, 1 ether);

        vm.prank(agent1);
        registry.updateStatus(false);

        AgentRegistry.AgentInfo memory info = registry.getAgent(agent1);
        assertFalse(info.isOpen);
    }

    function test_updateStatus_revertNotRegistered() public {
        vm.prank(agent1);
        vm.expectRevert("AgentRegistry: not registered");
        registry.updateStatus(false);
    }

    // ─── Open Agents Filtering ───────────────────────────────────────────

    function test_getOpenAgents() public {
        // Register two agents for RPS
        vm.prank(agent1);
        registry.register(gameTypes, 0.001 ether, 1 ether);

        vm.prank(agent2);
        registry.register(gameTypes, 0.001 ether, 1 ether);

        address[] memory open = registry.getOpenAgents(AgentRegistry.GameType.RPS);
        assertEq(open.length, 2);

        // Close agent1
        vm.prank(agent1);
        registry.updateStatus(false);

        open = registry.getOpenAgents(AgentRegistry.GameType.RPS);
        assertEq(open.length, 1);
        assertEq(open[0], agent2);
    }

    function test_getOpenAgents_filterByGameType() public {
        // agent1 plays RPS only
        vm.prank(agent1);
        registry.register(gameTypes, 0.001 ether, 1 ether);

        // agent2 plays Poker only
        AgentRegistry.GameType[] memory pokerTypes = new AgentRegistry.GameType[](1);
        pokerTypes[0] = AgentRegistry.GameType.Poker;
        vm.prank(agent2);
        registry.register(pokerTypes, 0.001 ether, 1 ether);

        address[] memory rpsAgents = registry.getOpenAgents(AgentRegistry.GameType.RPS);
        assertEq(rpsAgents.length, 1);
        assertEq(rpsAgents[0], agent1);

        address[] memory pokerAgents = registry.getOpenAgents(AgentRegistry.GameType.Poker);
        assertEq(pokerAgents.length, 1);
        assertEq(pokerAgents[0], agent2);
    }

    // ─── ELO Update Tests ────────────────────────────────────────────────

    function test_updateELO() public {
        vm.prank(agent1);
        registry.register(gameTypes, 0.001 ether, 1 ether);

        // Authorize game contract
        registry.authorizeContract(gameContract, true);

        // Update ELO
        vm.prank(gameContract);
        registry.updateELO(agent1, AgentRegistry.GameType.RPS, 1050);

        assertEq(registry.elo(agent1, AgentRegistry.GameType.RPS), 1050);
    }

    function test_updateELO_revertUnauthorized() public {
        vm.prank(agent1);
        registry.register(gameTypes, 0.001 ether, 1 ether);

        vm.prank(agent2); // not authorized
        vm.expectRevert("AgentRegistry: not authorized");
        registry.updateELO(agent1, AgentRegistry.GameType.RPS, 1050);
    }

    // ─── Match Record Tests ──────────────────────────────────────────────

    function test_recordMatch() public {
        vm.prank(agent1);
        registry.register(gameTypes, 0.001 ether, 1 ether);

        registry.authorizeContract(gameContract, true);

        vm.prank(gameContract);
        registry.recordMatch(agent1, agent2, AgentRegistry.GameType.RPS, true, 0.1 ether);

        AgentRegistry.MatchRecord[] memory history = registry.getMatchHistory(agent1);
        assertEq(history.length, 1);
        assertEq(history[0].opponent, agent2);
        assertTrue(history[0].won);
        assertEq(history[0].wager, 0.1 ether);
    }

    function test_getMatchCount() public {
        vm.prank(agent1);
        registry.register(gameTypes, 0.001 ether, 1 ether);

        registry.authorizeContract(gameContract, true);

        vm.prank(gameContract);
        registry.recordMatch(agent1, agent2, AgentRegistry.GameType.RPS, true, 0.1 ether);
        vm.prank(gameContract);
        registry.recordMatch(agent1, agent2, AgentRegistry.GameType.RPS, false, 0.2 ether);

        assertEq(registry.getMatchCount(agent1), 2);
    }

    // ─── Authorization Tests ─────────────────────────────────────────────

    function test_authorizeContract() public {
        registry.authorizeContract(gameContract, true);
        assertTrue(registry.authorizedContracts(gameContract));

        registry.authorizeContract(gameContract, false);
        assertFalse(registry.authorizedContracts(gameContract));
    }

    function test_authorizeContract_revertNotOwner() public {
        vm.prank(agent1);
        vm.expectRevert();
        registry.authorizeContract(gameContract, true);
    }

    // ─── ERC-8004 Identity Integration Tests ─────────────────────────────

    function test_register_autoAssignsAgentId() public {
        // Configure mock identity registry
        MockIdentityRegistry mockIdentity = new MockIdentityRegistry();
        registry.setIdentityRegistry(address(mockIdentity));

        // Register agent — should auto-assign agentId
        vm.prank(agent1);
        registry.register(gameTypes, 0.001 ether, 1 ether);

        // agentId should be 1 (first registration in mock)
        assertEq(registry.agentIds(agent1), 1);
        assertEq(registry.getAgentId(agent1), 1);
    }

    function test_register_identityRegistryFailure_doesNotRevert() public {
        // Configure failing identity registry
        FailingIdentityRegistry failingIdentity = new FailingIdentityRegistry();
        registry.setIdentityRegistry(address(failingIdentity));

        // Register agent — should succeed despite identity registry failure
        vm.prank(agent1);
        registry.register(gameTypes, 0.001 ether, 1 ether);

        // Agent registered but no agentId assigned
        AgentRegistry.AgentInfo memory info = registry.getAgent(agent1);
        assertTrue(info.exists);
        assertEq(registry.agentIds(agent1), 0);
    }

    function test_register_withoutIdentityRegistry_noAgentId() public {
        // No identity registry configured (default address(0))
        vm.prank(agent1);
        registry.register(gameTypes, 0.001 ether, 1 ether);

        // agentId should be 0 (not assigned)
        assertEq(registry.agentIds(agent1), 0);
    }

    function test_getAgentId() public {
        // Set agentId via owner admin function
        registry.setAgentIdFor(agent1, 42);
        assertEq(registry.getAgentId(agent1), 42);
    }

    function test_setAgentId_bySelf() public {
        // Register agent first
        vm.prank(agent1);
        registry.register(gameTypes, 0.001 ether, 1 ether);

        // Agent sets their own agentId
        vm.prank(agent1);
        registry.setAgentId(99);
        assertEq(registry.agentIds(agent1), 99);
    }

    function test_setAgentId_revertNotRegistered() public {
        // Try to set agentId without registering first
        vm.prank(agent1);
        vm.expectRevert("AgentRegistry: not registered");
        registry.setAgentId(99);
    }

    function test_setAgentIdFor_byOwner() public {
        // Owner sets agentId for any address (doesn't need to be registered)
        registry.setAgentIdFor(agent1, 42);
        assertEq(registry.agentIds(agent1), 42);
    }

    function test_setAgentIdFor_revertNotOwner() public {
        vm.prank(agent1);
        vm.expectRevert();
        registry.setAgentIdFor(agent1, 42);
    }

    function test_setIdentityRegistry_onlyOwner() public {
        MockIdentityRegistry mockIdentity = new MockIdentityRegistry();

        // Owner can set
        registry.setIdentityRegistry(address(mockIdentity));
        assertEq(address(registry.identityRegistry()), address(mockIdentity));

        // Non-owner cannot set
        vm.prank(agent1);
        vm.expectRevert();
        registry.setIdentityRegistry(address(mockIdentity));
    }

    function test_register_multipleAgents_sequentialIds() public {
        // Configure mock identity registry
        MockIdentityRegistry mockIdentity = new MockIdentityRegistry();
        registry.setIdentityRegistry(address(mockIdentity));

        // Register two agents — should get sequential IDs
        vm.prank(agent1);
        registry.register(gameTypes, 0.001 ether, 1 ether);

        vm.prank(agent2);
        registry.register(gameTypes, 0.001 ether, 1 ether);

        assertEq(registry.agentIds(agent1), 1);
        assertEq(registry.agentIds(agent2), 2);
    }
}
