// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./Escrow.sol";

/// @title PredictionMarket — Constant-product AMM for match outcome betting
/// @notice Binary outcome markets (YES/NO) linked to Escrow matches.
///         YES = player1 wins, NO = player2 wins.
///         Resolution is trustless — reads winner from Escrow.winners(matchId).
contract PredictionMarket is ReentrancyGuard {
    // ─── Types ───────────────────────────────────────────────────────────

    struct Market {
        uint256 matchId;        // Escrow match ID
        uint256 reserveYES;     // YES token reserve (virtual)
        uint256 reserveNO;      // NO token reserve (virtual)
        uint256 seedLiquidity;  // initial seed amount (each side)
        address player1;        // YES = player1 wins
        address player2;        // NO = player2 wins
        bool resolved;
        address winner;         // address(0) until resolved
    }

    // ─── Storage ─────────────────────────────────────────────────────────

    Escrow public escrow;

    /// @dev Auto-incrementing market ID
    uint256 public nextMarketId;

    /// @dev marketId => Market data
    mapping(uint256 => Market) public markets;

    /// @dev marketId => user => YES token balance
    mapping(uint256 => mapping(address => uint256)) public yesBalances;

    /// @dev marketId => user => NO token balance
    mapping(uint256 => mapping(address => uint256)) public noBalances;

    /// @dev marketId => total MON collected (for redemption pool)
    mapping(uint256 => uint256) public totalCollected;

    /// @dev marketId => total YES tokens ever distributed to users
    mapping(uint256 => uint256) public totalYESDistributed;

    /// @dev marketId => total NO tokens ever distributed to users
    mapping(uint256 => uint256) public totalNODistributed;

    /// @dev matchId => marketId (prevent duplicate markets per match)
    mapping(uint256 => uint256) public matchToMarket;

    /// @dev matchId => whether a market exists
    mapping(uint256 => bool) public marketExists;

    // ─── Events ──────────────────────────────────────────────────────────

    event MarketCreated(uint256 indexed marketId, uint256 indexed matchId, address player1, address player2, uint256 seedLiquidity);
    event TokensBought(uint256 indexed marketId, address indexed buyer, bool isYES, uint256 monIn, uint256 tokensOut);
    event TokensSold(uint256 indexed marketId, address indexed seller, bool isYES, uint256 tokensIn, uint256 monOut);
    event MarketResolved(uint256 indexed marketId, address indexed winner);
    event MarketResolvedDraw(uint256 indexed marketId);
    event Redeemed(uint256 indexed marketId, address indexed user, uint256 payout);

    // ─── Constructor ─────────────────────────────────────────────────────

    /// @param _escrow Address of the Escrow contract (v3 with winners mapping)
    constructor(address _escrow) {
        escrow = Escrow(_escrow);
    }

    // ─── Market Lifecycle ────────────────────────────────────────────────

    /// @notice Create a prediction market for an active escrow match
    /// @dev Seeds both sides with equal liquidity (msg.value split 50/50)
    /// @param _matchId Escrow match ID (must be Active)
    /// @return marketId The new market ID
    function createMarket(uint256 _matchId) external payable returns (uint256 marketId) {
        require(msg.value > 0, "PM: seed liquidity required");
        require(!marketExists[_matchId], "PM: market already exists for match");

        // Verify match exists and is active
        Escrow.Match memory m = escrow.getMatch(_matchId);
        require(m.status == Escrow.MatchStatus.Active, "PM: match not Active");

        marketId = nextMarketId++;

        // Seed liquidity: split equally between YES and NO reserves
        uint256 seed = msg.value / 2;
        require(seed > 0, "PM: seed too small");

        markets[marketId] = Market({
            matchId: _matchId,
            reserveYES: seed,
            reserveNO: seed,
            seedLiquidity: seed,
            player1: m.player1,
            player2: m.player2,
            resolved: false,
            winner: address(0)
        });

        // Track the MON collected (seed stays in contract as backing)
        totalCollected[marketId] = msg.value;

        // Link match to market
        matchToMarket[_matchId] = marketId;
        marketExists[_matchId] = true;

        emit MarketCreated(marketId, _matchId, m.player1, m.player2, seed);
    }

    /// @notice Buy YES tokens (betting on player1 winning)
    /// @dev Uses constant-product formula: tokensOut = reserveYES - (k / (reserveNO + monIn))
    /// @param _marketId Market ID
    function buyYES(uint256 _marketId) external payable nonReentrant {
        require(msg.value > 0, "PM: must send MON");
        Market storage m = markets[_marketId];
        require(!m.resolved, "PM: market resolved");
        require(m.reserveYES > 0, "PM: market not initialized");

        // Constant product: k = reserveYES * reserveNO
        uint256 k = m.reserveYES * m.reserveNO;

        // Buying YES = adding MON to NO side, taking YES tokens out
        uint256 newReserveNO = m.reserveNO + msg.value;
        uint256 newReserveYES = k / newReserveNO;
        uint256 tokensOut = m.reserveYES - newReserveYES;

        require(tokensOut > 0, "PM: zero tokens");

        m.reserveYES = newReserveYES;
        m.reserveNO = newReserveNO;
        totalCollected[_marketId] += msg.value;
        totalYESDistributed[_marketId] += tokensOut;

        yesBalances[_marketId][msg.sender] += tokensOut;

        emit TokensBought(_marketId, msg.sender, true, msg.value, tokensOut);
    }

    /// @notice Buy NO tokens (betting on player2 winning)
    /// @dev Uses constant-product formula: tokensOut = reserveNO - (k / (reserveYES + monIn))
    /// @param _marketId Market ID
    function buyNO(uint256 _marketId) external payable nonReentrant {
        require(msg.value > 0, "PM: must send MON");
        Market storage m = markets[_marketId];
        require(!m.resolved, "PM: market resolved");
        require(m.reserveNO > 0, "PM: market not initialized");

        // Constant product: k = reserveYES * reserveNO
        uint256 k = m.reserveYES * m.reserveNO;

        // Buying NO = adding MON to YES side, taking NO tokens out
        uint256 newReserveYES = m.reserveYES + msg.value;
        uint256 newReserveNO = k / newReserveYES;
        uint256 tokensOut = m.reserveNO - newReserveNO;

        require(tokensOut > 0, "PM: zero tokens");

        m.reserveNO = newReserveNO;
        m.reserveYES = newReserveYES;
        totalCollected[_marketId] += msg.value;
        totalNODistributed[_marketId] += tokensOut;

        noBalances[_marketId][msg.sender] += tokensOut;

        emit TokensBought(_marketId, msg.sender, false, msg.value, tokensOut);
    }

    /// @notice Sell YES tokens back to the pool
    /// @param _marketId Market ID
    /// @param _amount   Number of YES tokens to sell
    function sellYES(uint256 _marketId, uint256 _amount) external nonReentrant {
        require(_amount > 0, "PM: zero amount");
        Market storage m = markets[_marketId];
        require(!m.resolved, "PM: market resolved");
        require(yesBalances[_marketId][msg.sender] >= _amount, "PM: insufficient YES tokens");

        // Selling YES = returning tokens to YES reserve, taking MON from NO reserve
        uint256 k = m.reserveYES * m.reserveNO;
        uint256 newReserveYES = m.reserveYES + _amount;
        uint256 newReserveNO = k / newReserveYES;
        uint256 monOut = m.reserveNO - newReserveNO;

        require(monOut > 0, "PM: zero payout");

        m.reserveYES = newReserveYES;
        m.reserveNO = newReserveNO;
        totalCollected[_marketId] -= monOut;
        totalYESDistributed[_marketId] -= _amount;

        yesBalances[_marketId][msg.sender] -= _amount;

        (bool success, ) = msg.sender.call{value: monOut}("");
        require(success, "PM: transfer failed");

        emit TokensSold(_marketId, msg.sender, true, _amount, monOut);
    }

    /// @notice Sell NO tokens back to the pool
    /// @param _marketId Market ID
    /// @param _amount   Number of NO tokens to sell
    function sellNO(uint256 _marketId, uint256 _amount) external nonReentrant {
        require(_amount > 0, "PM: zero amount");
        Market storage m = markets[_marketId];
        require(!m.resolved, "PM: market resolved");
        require(noBalances[_marketId][msg.sender] >= _amount, "PM: insufficient NO tokens");

        // Selling NO = returning tokens to NO reserve, taking MON from YES reserve
        uint256 k = m.reserveYES * m.reserveNO;
        uint256 newReserveNO = m.reserveNO + _amount;
        uint256 newReserveYES = k / newReserveNO;
        uint256 monOut = m.reserveYES - newReserveYES;

        require(monOut > 0, "PM: zero payout");

        m.reserveNO = newReserveNO;
        m.reserveYES = newReserveYES;
        totalCollected[_marketId] -= monOut;
        totalNODistributed[_marketId] -= _amount;

        noBalances[_marketId][msg.sender] -= _amount;

        (bool success, ) = msg.sender.call{value: monOut}("");
        require(success, "PM: transfer failed");

        emit TokensSold(_marketId, msg.sender, false, _amount, monOut);
    }

    /// @notice Resolve a market after the linked match is settled
    /// @dev Fully trustless — reads winner from Escrow.winners(matchId)
    /// @param _marketId Market ID
    function resolve(uint256 _marketId) external {
        Market storage m = markets[_marketId];
        require(!m.resolved, "PM: already resolved");

        // Read winner from Escrow's winners mapping (set during settle())
        address winner = escrow.winners(m.matchId);
        require(winner != address(0), "PM: match not settled or was draw");

        m.resolved = true;
        m.winner = winner;

        emit MarketResolved(_marketId, winner);
    }

    /// @notice Resolve a market as a draw — refunds all bettors proportionally
    /// @dev For draws, Escrow.winners(matchId) == address(0) and match status == Settled
    /// @param _marketId Market ID
    function resolveAsDraw(uint256 _marketId) external {
        Market storage m = markets[_marketId];
        require(!m.resolved, "PM: already resolved");

        // Verify the match is settled but has no winner (draw)
        Escrow.Match memory escrowMatch = escrow.getMatch(m.matchId);
        require(escrowMatch.status == Escrow.MatchStatus.Settled, "PM: match not settled");
        require(escrow.winners(m.matchId) == address(0), "PM: match has a winner, use resolve()");

        m.resolved = true;
        // winner stays address(0) — signals draw for redemption logic

        emit MarketResolvedDraw(_marketId);
    }

    /// @notice Redeem winning tokens for MON after market resolution
    /// @dev If winner = player1, YES holders redeem. If winner = player2, NO holders redeem.
    ///      If draw (winner = address(0)), both YES and NO holders redeem proportionally.
    /// @param _marketId Market ID
    function redeem(uint256 _marketId) external nonReentrant {
        Market storage m = markets[_marketId];
        require(m.resolved, "PM: not resolved");

        uint256 payout;
        uint256 marketPool = totalCollected[_marketId];

        if (m.winner == address(0)) {
            // Draw — refund proportionally based on token holdings
            uint256 yesTokens = yesBalances[_marketId][msg.sender];
            uint256 noTokens = noBalances[_marketId][msg.sender];
            require(yesTokens > 0 || noTokens > 0, "PM: no tokens to redeem");

            uint256 totalTokens = totalYESDistributed[_marketId] + totalNODistributed[_marketId];
            if (totalTokens > 0) {
                payout = (marketPool * (yesTokens + noTokens)) / totalTokens;
            }

            yesBalances[_marketId][msg.sender] = 0;
            noBalances[_marketId][msg.sender] = 0;
        } else if (m.winner == m.player1) {
            // YES wins — YES token holders redeem
            uint256 tokens = yesBalances[_marketId][msg.sender];
            require(tokens > 0, "PM: no winning tokens");

            // Payout proportional to share of total YES tokens distributed
            uint256 totalYES = totalYESDistributed[_marketId];
            if (totalYES > 0) {
                payout = (marketPool * tokens) / totalYES;
            }

            yesBalances[_marketId][msg.sender] = 0;
        } else {
            // NO wins — NO token holders redeem
            uint256 tokens = noBalances[_marketId][msg.sender];
            require(tokens > 0, "PM: no winning tokens");

            // Payout proportional to share of total NO tokens distributed
            uint256 totalNO = totalNODistributed[_marketId];
            if (totalNO > 0) {
                payout = (marketPool * tokens) / totalNO;
            }

            noBalances[_marketId][msg.sender] = 0;
        }

        require(payout > 0, "PM: zero payout");

        // Cap payout to available balance (rounding protection)
        if (payout > totalCollected[_marketId]) {
            payout = totalCollected[_marketId];
        }
        totalCollected[_marketId] -= payout;

        (bool success, ) = msg.sender.call{value: payout}("");
        require(success, "PM: transfer failed");

        emit Redeemed(_marketId, msg.sender, payout);
    }

    // ─── Match-Based Resolution (called by Escrow) ─────────────────────

    /// @notice Resolve a market by match ID — convenience wrapper for Escrow auto-resolve
    /// @dev Looks up the market for this match and resolves it. No-op if no market exists.
    /// @param _matchId Escrow match ID
    function resolveByMatch(uint256 _matchId) external {
        require(marketExists[_matchId], "PM: no market for match");
        uint256 marketId = matchToMarket[_matchId];
        Market storage m = markets[marketId];
        require(!m.resolved, "PM: already resolved");

        address winner = escrow.winners(m.matchId);
        require(winner != address(0), "PM: match not settled or was draw");

        m.resolved = true;
        m.winner = winner;

        emit MarketResolved(marketId, winner);
    }

    /// @notice Resolve a market as draw by match ID — convenience wrapper for Escrow auto-resolve
    /// @param _matchId Escrow match ID
    function resolveDrawByMatch(uint256 _matchId) external {
        require(marketExists[_matchId], "PM: no market for match");
        uint256 marketId = matchToMarket[_matchId];
        Market storage m = markets[marketId];
        require(!m.resolved, "PM: already resolved");

        Escrow.Match memory escrowMatch = escrow.getMatch(m.matchId);
        require(escrowMatch.status == Escrow.MatchStatus.Settled, "PM: match not settled");
        require(escrow.winners(m.matchId) == address(0), "PM: match has a winner");

        m.resolved = true;

        emit MarketResolvedDraw(marketId);
    }

    // ─── View Functions ──────────────────────────────────────────────────

    /// @notice Get current YES/NO prices (scaled to 1e18 = 1.0)
    /// @return yesPrice Price of YES token (higher = more likely player1 wins)
    /// @return noPrice  Price of NO token
    function getPrice(uint256 _marketId) external view returns (uint256 yesPrice, uint256 noPrice) {
        Market storage m = markets[_marketId];
        uint256 total = m.reserveYES + m.reserveNO;
        if (total == 0) return (0, 0);

        // Price = opposite_reserve / total (probability approximation)
        yesPrice = (m.reserveNO * 1e18) / total;
        noPrice = (m.reserveYES * 1e18) / total;
    }

    /// @notice Get full market data
    function getMarket(uint256 _marketId) external view returns (Market memory) {
        return markets[_marketId];
    }

    /// @notice Get user's token balances for a market
    function getUserBalances(uint256 _marketId, address _user) external view returns (uint256 yes, uint256 no) {
        yes = yesBalances[_marketId][_user];
        no = noBalances[_marketId][_user];
    }

    /// @dev Allow contract to receive MON
    receive() external payable {}
}
