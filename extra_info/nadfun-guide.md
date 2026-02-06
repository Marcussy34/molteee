# Nad.fun — Token Launchpad on Monad

> Source: nad.fun/skill.md + hackathon resources

---

## What is Nad.fun?

A Monad blockchain token launchpad with bonding curves. Trade tokens, launch new ones, and monitor events.

- **Mainnet API:** https://api.nadapp.net
- **Testnet API:** https://dev-api.nad.fun
- **Skill Docs:** https://nad.fun/skill.md

---

## Documentation Modules

| Module | URL | Purpose |
|--------|-----|---------|
| Architecture & Setup | skill.md | Constants and initialization |
| Smart Contracts | ABI.md | Contract interfaces |
| Pricing | QUOTE.md | Curve state and quotes |
| Trading | TRADING.md | Buy/sell and permit signatures |
| Token Management | TOKEN.md | Balances and transfers |
| Creation | CREATE.md | Launch tokens with image upload |
| Historical Data | INDEXER.md | Event querying |
| REST API | AGENT-API.md | API key management |
| Wallet Generation | WALLET.md | Account creation |
| Cross-chain Swaps | AUSD.md | MON to aUSD conversion |

---

## Key Concepts

### Bonding Curves
- Token price increases as more people buy
- Deterministic pricing based on supply

### Graduation
- When reserve targets are reached, tokens transition from bonding curves to Uniswap V3
- This is the "launch" moment for a token

### Permit Signatures
- Gasless approve via EIP-2612 signing
- Fetch permit nonces immediately before signing

---

## Contract Addresses

### Mainnet (Chain ID: 143)
```
BondingCurveRouter = 0x6F6B8F1a20703309951a5127c45B49b1CD981A22
Curve              = 0xA7283d07812a02AFB7C09B60f8896bCEA3F90aCE
Lens               = 0x7e78A8DE94f21804F7a17F4E8BF9EC2c872187ea
```

---

## Token Creation Flow

### Step 1: Upload Image
```
POST /agent/token/image
→ returns image_uri
```

### Step 2: Upload Metadata
```
POST /agent/token/metadata
→ returns metadata_uri
```

### Step 3: Mine Salt (vanity address)
```
POST /agent/salt
→ returns salt + vanity address (7777)
```

### Step 4: Create On-Chain
```
Call BondingCurveRouter.create() with params
Deploy fee: ~10 MON (check Curve.feeConfig()[0])
```

---

## ClawHub Skills for Nad.fun

```bash
# Main nad.fun skill
# https://www.clawhub.ai/portdeveloper/nadfun

# Detailed token creation flow
# https://www.clawhub.ai/therealharpaljadeja/nadfun-token-creation
```

---

## Critical Implementation Notes

- Always estimate gas before transactions
- Use future timestamps for deadlines
- Apply slippage buffers (e.g., 1%) to output calculations
- Fetch permit nonces immediately before signing
- Login is optional — only needed for API key management
- Trading and token creation work without authentication

---

## Network Config

### Testnet (Chain ID: 10143)
- RPC: https://testnet-rpc.monad.xyz
- API: https://dev-api.nad.fun

### Mainnet (Chain ID: 143)
- RPC: https://rpc.monad.xyz
- API: https://api.nadapp.net
