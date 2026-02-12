// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IIdentityRegistry.sol";

/// @title AgentRegistry — Agent registration, ELO tracking, and match history
/// @notice Agents register here to be discoverable for challenges.
///         Game contracts call updateELO() and recordMatch() after matches.
contract AgentRegistry is Ownable {
    // ─── Types ───────────────────────────────────────────────────────────

    enum GameType { RPS, Poker, Auction }

    struct AgentInfo {
        address wallet;
        GameType[] gameTypes;   // which games this agent plays
        uint256 minWager;       // minimum wager in wei
        uint256 maxWager;       // maximum wager in wei
        bool isOpen;            // accepting challenges?
        bool exists;            // registration flag
    }

    struct MatchRecord {
        address opponent;
        GameType gameType;
        bool won;               // true = win, false = loss (draws not recorded as match)
        uint256 wager;
        uint256 timestamp;
    }

    // ─── Storage ─────────────────────────────────────────────────────────

    /// @dev All registered agent addresses (for enumeration)
    address[] public agentList;

    /// @dev agent address => AgentInfo
    mapping(address => AgentInfo) private agents;

    /// @dev agent => gameType => ELO rating (default 1000)
    mapping(address => mapping(GameType => uint256)) public elo;

    /// @dev agent => match history array
    mapping(address => MatchRecord[]) private matchHistory;

    /// @dev Contracts authorized to call updateELO / recordMatch
    mapping(address => bool) public authorizedContracts;

    /// @dev ERC-8004 Identity Registry (address(0) = disabled)
    IIdentityRegistry public identityRegistry;

    /// @dev wallet => ERC-8004 agentId (centralized, replaces per-game mappings)
    mapping(address => uint256) public agentIds;

    // ─── Events ──────────────────────────────────────────────────────────

    event AgentRegistered(address indexed agent, GameType[] gameTypes, uint256 minWager, uint256 maxWager);
    event StatusUpdated(address indexed agent, bool isOpen);
    event ELOUpdated(address indexed agent, GameType gameType, uint256 newElo);
    event MatchRecorded(address indexed agent, address indexed opponent, GameType gameType, bool won, uint256 wager);
    event ContractAuthorized(address indexed contractAddr, bool authorized);
    event AgentIdAssigned(address indexed agent, uint256 agentId);
    event IdentityRegistrySet(address indexed identityRegistry);
    event IdentityRegistrationFailed(address indexed agent, bytes reason);

    // ─── Modifiers ───────────────────────────────────────────────────────

    modifier onlyAuthorized() {
        require(authorizedContracts[msg.sender], "AgentRegistry: not authorized");
        _;
    }

    // ─── Constructor ─────────────────────────────────────────────────────

    constructor() Ownable(msg.sender) {}

    // ─── Public Functions ────────────────────────────────────────────────

    /// @notice Register the caller as an agent
    /// @param _gameTypes Array of game types this agent supports
    /// @param _minWager  Minimum acceptable wager (wei)
    /// @param _maxWager  Maximum acceptable wager (wei)
    function register(
        GameType[] calldata _gameTypes,
        uint256 _minWager,
        uint256 _maxWager
    ) external {
        require(!agents[msg.sender].exists, "AgentRegistry: already registered");
        require(_gameTypes.length > 0, "AgentRegistry: need at least one game type");
        require(_maxWager >= _minWager, "AgentRegistry: maxWager < minWager");

        agents[msg.sender] = AgentInfo({
            wallet: msg.sender,
            gameTypes: _gameTypes,
            minWager: _minWager,
            maxWager: _maxWager,
            isOpen: true,
            exists: true
        });

        // Default ELO = 1000 for each game type
        for (uint256 i = 0; i < _gameTypes.length; i++) {
            elo[msg.sender][_gameTypes[i]] = 1000;
        }

        agentList.push(msg.sender);

        // Auto-register with ERC-8004 Identity Registry (non-blocking)
        if (address(identityRegistry) != address(0)) {
            try identityRegistry.registerAgent(msg.sender) returns (uint256 newAgentId) {
                agentIds[msg.sender] = newAgentId;
                emit AgentIdAssigned(msg.sender, newAgentId);
            } catch (bytes memory reason) {
                emit IdentityRegistrationFailed(msg.sender, reason);
            }
        }

        emit AgentRegistered(msg.sender, _gameTypes, _minWager, _maxWager);
    }

    /// @notice Toggle open-to-challenge status
    function updateStatus(bool _isOpen) external {
        require(agents[msg.sender].exists, "AgentRegistry: not registered");
        agents[msg.sender].isOpen = _isOpen;
        emit StatusUpdated(msg.sender, _isOpen);
    }

    /// @notice Get full agent info
    function getAgent(address _agent) external view returns (AgentInfo memory) {
        require(agents[_agent].exists, "AgentRegistry: agent not found");
        return agents[_agent];
    }

    /// @notice List all agents open for a specific game type
    /// @dev Iterates agentList — fine for small registries, not gas-efficient at scale
    function getOpenAgents(GameType _gameType) external view returns (address[] memory) {
        // First pass: count matches
        uint256 count = 0;
        for (uint256 i = 0; i < agentList.length; i++) {
            AgentInfo storage a = agents[agentList[i]];
            if (a.isOpen && _supportsGame(a, _gameType)) {
                count++;
            }
        }

        // Second pass: collect addresses
        address[] memory result = new address[](count);
        uint256 idx = 0;
        for (uint256 i = 0; i < agentList.length; i++) {
            AgentInfo storage a = agents[agentList[i]];
            if (a.isOpen && _supportsGame(a, _gameType)) {
                result[idx++] = agentList[i];
            }
        }
        return result;
    }

    /// @notice Get match history for an agent
    function getMatchHistory(address _agent) external view returns (MatchRecord[] memory) {
        return matchHistory[_agent];
    }

    /// @notice Get match count for an agent
    function getMatchCount(address _agent) external view returns (uint256) {
        return matchHistory[_agent].length;
    }

    /// @notice Get the ERC-8004 agentId for a wallet (used by game contracts)
    function getAgentId(address _agent) external view returns (uint256) {
        return agentIds[_agent];
    }

    /// @notice Agent sets their own agentId (if they already have one from ERC-8004)
    function setAgentId(uint256 _agentId) external {
        require(agents[msg.sender].exists, "AgentRegistry: not registered");
        agentIds[msg.sender] = _agentId;
        emit AgentIdAssigned(msg.sender, _agentId);
    }

    // ─── Authorized-Only Functions ───────────────────────────────────────

    /// @notice Update an agent's ELO. Only callable by authorized game contracts.
    /// @param _agent   Agent address
    /// @param _gameType Which game's ELO to update
    /// @param _newElo  New ELO value
    function updateELO(
        address _agent,
        GameType _gameType,
        uint256 _newElo
    ) external onlyAuthorized {
        require(agents[_agent].exists, "AgentRegistry: agent not found");
        elo[_agent][_gameType] = _newElo;
        emit ELOUpdated(_agent, _gameType, _newElo);
    }

    /// @notice Record a match result. Only callable by authorized game contracts.
    function recordMatch(
        address _agent,
        address _opponent,
        GameType _gameType,
        bool _won,
        uint256 _wager
    ) external onlyAuthorized {
        matchHistory[_agent].push(MatchRecord({
            opponent: _opponent,
            gameType: _gameType,
            won: _won,
            wager: _wager,
            timestamp: block.timestamp
        }));
        emit MatchRecorded(_agent, _opponent, _gameType, _won, _wager);
    }

    // ─── Owner Functions ─────────────────────────────────────────────────

    /// @notice Authorize or revoke a contract's ability to update ELO / record matches
    function authorizeContract(address _contract, bool _authorized) external onlyOwner {
        authorizedContracts[_contract] = _authorized;
        emit ContractAuthorized(_contract, _authorized);
    }

    /// @notice Owner sets agentId for any agent (admin override)
    function setAgentIdFor(address _agent, uint256 _agentId) external onlyOwner {
        agentIds[_agent] = _agentId;
        emit AgentIdAssigned(_agent, _agentId);
    }

    /// @notice Owner configures the ERC-8004 Identity Registry
    function setIdentityRegistry(address _identityRegistry) external onlyOwner {
        identityRegistry = IIdentityRegistry(_identityRegistry);
        emit IdentityRegistrySet(_identityRegistry);
    }

    // ─── Internal ────────────────────────────────────────────────────────

    /// @dev Check if an agent supports a specific game type
    function _supportsGame(AgentInfo storage _agent, GameType _gameType) internal view returns (bool) {
        for (uint256 i = 0; i < _agent.gameTypes.length; i++) {
            if (_agent.gameTypes[i] == _gameType) return true;
        }
        return false;
    }
}
