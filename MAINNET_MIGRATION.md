# Molteee Mainnet Migration Guide

Full cutover from Monad Testnet (chain ID 10143) → Monad Mainnet (chain ID 143).
Centralizes all config into environment variables so future changes only require updating `.env` files.

---

## Mainnet Parameters

| Parameter | Testnet Value | Mainnet Value |
|-----------|--------------|---------------|
| Chain ID | `10143` | `143` |
| Alchemy RPC | `https://monad-testnet.g.alchemy.com/v2/uMvEY1mdMyM8svqTZD-p3` | `https://monad-mainnet.g.alchemy.com/v2/bl9zbJnm4_TpoPKha-QRB` |
| Public RPC | `https://testnet-rpc.monad.xyz` | `https://rpc.monad.xyz` |
| Block Explorer | `https://testnet.monadexplorer.com` | `https://monadscan.com` |
| Explorer API | `https://testnet.monadscan.com/api` | `https://monadscan.com/api` |
| Socialscan | `https://monad-testnet.socialscan.io` | `https://monad.socialscan.io` |
| MonadVision | `https://testnet.monadvision.com` | `https://monadvision.com` |
| Verification API | `https://agents.devnads.com/v1/verify` | Same (supports both chains) |
| ERC-8004 Identity | `0x8004A818BFB912233c491871b3d84c89A494BD9e` | `0x8004A169FB4a3325136EB29fA0ceB6D2e539a432` |
| ERC-8004 Reputation | `0x8004B663056A597Dffe9eCcC1965A193B7388713` | `0x8004BAa17C55a88189AE136b182e5fdA19dE9b63` |

---

## Step 1: Security — Fresh Wallets

Testnet private keys are committed to git in `.env`. **NEVER reuse them on mainnet.**

- [ ] Generate new deployer wallet: `cast wallet new`
- [ ] Generate new opponent bot wallets (if running bots on mainnet)
- [ ] Fund deployer wallet with real MON for gas + treasury
- [x] ERC-8004 registry addresses confirmed (see table above)

---

## Step 2: Update Environment Files

### 2a. Root `.env`

Replace the entire file with mainnet values:

```env
# Monad Mainnet Configuration
MONAD_RPC_URL=https://monad-mainnet.g.alchemy.com/v2/bl9zbJnm4_TpoPKha-QRB
MONAD_CHAIN_ID=143

# Deployer / Fighter wallet (NEW — never commit to git)
DEPLOYER_PRIVATE_KEY=<new_mainnet_private_key>
DEPLOYER_ADDRESS=<derived_from_key>

# Opponent wallets (NEW)
OPPONENT_1_PRIVATE_KEY=<new_key>
OPPONENT_1_ADDRESS=<derived>
OPPONENT_2_PRIVATE_KEY=<new_key>
OPPONENT_2_ADDRESS=<derived>
OPPONENT_3_PRIVATE_KEY=<new_key>
OPPONENT_3_ADDRESS=<derived>
OPPONENT_4_PRIVATE_KEY=<new_key>
OPPONENT_4_ADDRESS=<derived>
OPPONENT_5_PRIVATE_KEY=<new_key>
OPPONENT_5_ADDRESS=<derived>

# Contract addresses (filled AFTER Step 5 deployment)
AGENT_REGISTRY_ADDRESS=
ESCROW_ADDRESS=
RPS_GAME_ADDRESS=
POKER_GAME_ADDRESS=
AUCTION_GAME_ADDRESS=
TOURNAMENT_ADDRESS=
PREDICTION_MARKET_ADDRESS=
TOURNAMENT_V2_ADDRESS=

# ERC-8004 Registries (confirm mainnet addresses)
ERC8004_IDENTITY_REGISTRY=0x8004A169FB4a3325136EB29fA0ceB6D2e539a432
ERC8004_REPUTATION_REGISTRY=0x8004BAa17C55a88189AE136b182e5fdA19dE9b63

# ERC-8004 Fighter Agent (filled after registration)
ERC8004_AGENT_ID=
ERC8004_IPFS_HASH=

# Social Platform API Keys
MOLTBOOK_API_KEY=<existing_or_new>
MOLTX_API_KEY=<existing_or_new>
```

### 2b. `.env.example`

Update template to show mainnet defaults:
- Line 2: `MONAD_RPC_URL=https://rpc.monad.xyz` (public fallback)
- Line 3: `MONAD_CHAIN_ID=143`

### 2c. `agent/.env`

```env
PRIVATE_KEY=<new_mainnet_private_key>
RPC_URL=https://monad-mainnet.g.alchemy.com/v2/bl9zbJnm4_TpoPKha-QRB
PINATA_JWT=<existing>
```

### 2d. `frontend/.env.local` (create new file)

```env
NEXT_PUBLIC_MONAD_RPC_URL=https://monad-mainnet.g.alchemy.com/v2/bl9zbJnm4_TpoPKha-QRB
NEXT_PUBLIC_MONAD_CHAIN_ID=143
NEXT_PUBLIC_MONAD_CHAIN_NAME=Monad
NEXT_PUBLIC_MONAD_EXPLORER_URL=https://monadscan.com
NEXT_PUBLIC_AGENT_REGISTRY_ADDRESS=<filled_after_deploy>
NEXT_PUBLIC_ESCROW_ADDRESS=<filled_after_deploy>
NEXT_PUBLIC_RPS_GAME_ADDRESS=<filled_after_deploy>
NEXT_PUBLIC_POKER_GAME_ADDRESS=<filled_after_deploy>
NEXT_PUBLIC_AUCTION_GAME_ADDRESS=<filled_after_deploy>
NEXT_PUBLIC_PREDICTION_MARKET_ADDRESS=<filled_after_deploy>
NEXT_PUBLIC_TOURNAMENT_V2_ADDRESS=<filled_after_deploy>
NEXT_PUBLIC_ERC8004_IDENTITY_REGISTRY=0x8004A169FB4a3325136EB29fA0ceB6D2e539a432
NEXT_PUBLIC_ERC8004_REPUTATION_REGISTRY=0x8004BAa17C55a88189AE136b182e5fdA19dE9b63
```

---

## Step 3: Update Foundry Config

**File:** `contracts/foundry.toml`

**Current (lines 23-28):**
```toml
[rpc_endpoints]
monad_testnet = "https://monad-testnet.g.alchemy.com/v2/uMvEY1mdMyM8svqTZD-p3"

[etherscan]
monad_testnet = { key = "", chain = 10143, url = "https://testnet.monadscan.com/api" }
```

**Change to:**
```toml
[rpc_endpoints]
monad_mainnet = "https://monad-mainnet.g.alchemy.com/v2/bl9zbJnm4_TpoPKha-QRB"

[etherscan]
monad_mainnet = { key = "", chain = 143, url = "https://monadscan.com/api" }
```

---

## Step 4: Update Deployment Script

**File:** `contracts/script/DeployV5.s.sol`

### Line 28 — Update usage comment:
```
--rpc-url monad_testnet    →    --rpc-url monad_mainnet
```

### Lines 40-41 — Load ERC-8004 from env instead of hardcoded:
```solidity
// BEFORE:
address identityRegistry = 0x8004A818BFB912233c491871b3d84c89A494BD9e;
address reputationRegistry = 0x8004B663056A597Dffe9eCcC1965A193B7388713;

// AFTER:
address identityRegistry = vm.envAddress("ERC8004_IDENTITY_REGISTRY");
address reputationRegistry = vm.envAddress("ERC8004_REPUTATION_REGISTRY");
```

### Line 45 — Consider lowering treasury default for mainnet:
```solidity
// BEFORE:
uint256 treasuryFund = vm.envOr("TREASURY_FUND", uint256(1 ether));

// AFTER (suggested — real MON on mainnet):
uint256 treasuryFund = vm.envOr("TREASURY_FUND", uint256(0.1 ether));
```

---

## Step 5: Deploy Contracts to Mainnet

```bash
cd contracts
source ../.env
forge script script/DeployV5.s.sol:DeployV5 \
  --rpc-url monad_mainnet \
  --broadcast
```

The script deploys 8 contracts in order with all cross-contract authorization. After deployment, copy the printed addresses back into:
- `.env` (lines 22-29)
- `frontend/.env.local` (all `NEXT_PUBLIC_*_ADDRESS` vars)

### Verify contracts on explorer:
```bash
# For each contract, generate verification payload and POST to API:
forge verify-contract <ADDR> <CONTRACT> \
  --chain 143 \
  --show-standard-json-input > /tmp/standard-input.json

curl -X POST https://agents.devnads.com/v1/verify \
  -H "Content-Type: application/json" \
  -d '{
    "chainId": 143,
    "contractAddress": "<ADDR>",
    "contractName": "src/<Contract>.sol:<Contract>",
    "compilerVersion": "v0.8.28",
    "standardJsonInput": <contents_of_standard-input.json>
  }'
```

---

## Step 6: Update Python Agent Config

### 6a. `skills/fighter/lib/contracts.py`

| Line | Current | Change To |
|------|---------|-----------|
| 2 | `"...on Monad testnet."` | `"...on Monad mainnet."` |
| 38 | Comment: `"ERC-8004 Registry Addresses (deployed singletons on Monad Testnet)"` | `"...on Monad Mainnet"` |
| 40 | `ERC8004_IDENTITY_REGISTRY = "0x8004A818..."` | `ERC8004_IDENTITY_REGISTRY = os.getenv("ERC8004_IDENTITY_REGISTRY", "")` |
| 41 | `ERC8004_REPUTATION_REGISTRY = "0x8004B663..."` | `ERC8004_REPUTATION_REGISTRY = os.getenv("ERC8004_REPUTATION_REGISTRY", "")` |
| 43 | Comment: `"Monad Testnet Config"` | `"Monad Config"` |
| 45 | `MONAD_RPC_URL = os.getenv("MONAD_RPC_URL", "https://monad-testnet.g.alchemy.com/v2/uMvEY1mdMyM8svqTZD-p3")` | `MONAD_RPC_URL = os.getenv("MONAD_RPC_URL", "https://monad-mainnet.g.alchemy.com/v2/bl9zbJnm4_TpoPKha-QRB")` |
| 46 | `MONAD_CHAIN_ID = 10143` | `MONAD_CHAIN_ID = int(os.getenv("MONAD_CHAIN_ID", "143"))` |

### 6b. `skills/spectator/lib/contracts.py`

Same pattern as 6a — update RPC URL default, chain ID, ERC-8004 addresses to load from env.

### 6c. `skills/fighter/lib/moltx.py` (lines 49-51)

**Current:**
```python
AGENT_REGISTRY = "0x218b5f1254e77E08f2fF9ee4b4a0EC8a3fe5d101"
ESCROW = "0x3F07E6302459eDb555FDeCDefE2817f0fe5DCa7E"
RPS_GAME = "0xCe117380073c1B425273cf0f3cB098eb6e54F147"
```

**Change to:**
```python
from lib.contracts import AGENT_REGISTRY_ADDRESS as AGENT_REGISTRY
from lib.contracts import ESCROW_ADDRESS as ESCROW
from lib.contracts import RPS_GAME_ADDRESS as RPS_GAME
```

### 6d. `skills/fighter/lib/moltbook.py` (lines 46-48)

Same as 6c — replace 3 hardcoded addresses with imports from `contracts.py`.

### 6e. `opponents/base_bot.py` (lines 31-32)

| Line | Current | Change To |
|------|---------|-----------|
| 31 | `MONAD_RPC_URL = "https://monad-testnet.g.alchemy.com/v2/uMvEY1mdMyM8svqTZD-p3"` | `MONAD_RPC_URL = os.getenv("MONAD_RPC_URL", "https://monad-mainnet.g.alchemy.com/v2/bl9zbJnm4_TpoPKha-QRB")` |
| 32 | `MONAD_CHAIN_ID = 10143` | `MONAD_CHAIN_ID = int(os.getenv("MONAD_CHAIN_ID", "143"))` |

---

## Step 7: Centralize Frontend Config (env-driven)

### 7a. `frontend/lib/contracts.ts` — Central config file

**Lines 3-5 — RPC URLs:**
```ts
// BEFORE:
const ALCHEMY_RPC = "https://monad-testnet.g.alchemy.com/v2/uMvEY1mdMyM8svqTZD-p3";
const MONAD_PUBLIC_RPC = "https://testnet-rpc.monad.xyz";

// AFTER:
const ALCHEMY_RPC = process.env.NEXT_PUBLIC_MONAD_RPC_URL || "https://monad-mainnet.g.alchemy.com/v2/bl9zbJnm4_TpoPKha-QRB";
const MONAD_PUBLIC_RPC = "https://rpc.monad.xyz";
```

**Lines 7-18 — Chain definition:**
```ts
// BEFORE:
// Monad testnet chain definition
export const monadTestnet = defineChain({
  id: 10143,
  name: "Monad Testnet",
  nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
  rpcUrls: { default: { http: [ALCHEMY_RPC] } },
  blockExplorers: {
    default: { name: "Monad Explorer", url: "https://testnet.monadexplorer.com" },
  },
});

// AFTER:
// Monad chain definition
export const monadChain = defineChain({
  id: parseInt(process.env.NEXT_PUBLIC_MONAD_CHAIN_ID || "143"),
  name: process.env.NEXT_PUBLIC_MONAD_CHAIN_NAME || "Monad",
  nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
  rpcUrls: { default: { http: [ALCHEMY_RPC] } },
  blockExplorers: {
    default: { name: "Monadscan", url: process.env.NEXT_PUBLIC_MONAD_EXPLORER_URL || "https://monadscan.com" },
  },
});
```

**Line 21 — Comment:**
```ts
// BEFORE: Monad testnet RPCs are rate-limited.
// AFTER:  Monad RPCs are rate-limited.
```

**Lines 28-29 — isMonadRpc() domain check:**
```ts
// BEFORE:
return url.includes("monad-testnet.g.alchemy.com") || url.includes("testnet-rpc.monad.xyz");

// AFTER:
return url.includes("monad-mainnet.g.alchemy.com") || url.includes("rpc.monad.xyz");
```

**Line 34-35 — publicClient:**
```ts
// BEFORE: chain: monadTestnet,
// AFTER:  chain: monadChain,
```

**Line 74 — Comment:**
```ts
// BEFORE: Deployed contract addresses on Monad testnet (V5 deployment)
// AFTER:  Deployed contract addresses on Monad mainnet
```

**Lines 75-83 — ADDRESSES object:**
```ts
// BEFORE:
export const ADDRESSES = {
  agentRegistry: "0x218b5f1254e77E08f2fF9ee4b4a0EC8a3fe5d101" as const,
  escrow: "0x3F07E6302459eDb555FDeCDefE2817f0fe5DCa7E" as const,
  rpsGame: "0xCe117380073c1B425273cf0f3cB098eb6e54F147" as const,
  pokerGame: "0x2Ad3a193F88f93f3B06121aF530ee626c50aD113" as const,
  auctionGame: "0x0Cd3cfAFDEb25a446e1fa7d0476c5B224913fC15" as const,
  predictionMarket: "0xf38C7642a6B21220404c886928DcD6783C33c2b1" as const,
  tournamentV2: "0xECcbb759CD3642333D8E8D91350a40D8E02aBe65" as const,
} as const;

// AFTER:
export const ADDRESSES = {
  agentRegistry: (process.env.NEXT_PUBLIC_AGENT_REGISTRY_ADDRESS || "") as `0x${string}`,
  escrow: (process.env.NEXT_PUBLIC_ESCROW_ADDRESS || "") as `0x${string}`,
  rpsGame: (process.env.NEXT_PUBLIC_RPS_GAME_ADDRESS || "") as `0x${string}`,
  pokerGame: (process.env.NEXT_PUBLIC_POKER_GAME_ADDRESS || "") as `0x${string}`,
  auctionGame: (process.env.NEXT_PUBLIC_AUCTION_GAME_ADDRESS || "") as `0x${string}`,
  predictionMarket: (process.env.NEXT_PUBLIC_PREDICTION_MARKET_ADDRESS || "") as `0x${string}`,
  tournamentV2: (process.env.NEXT_PUBLIC_TOURNAMENT_V2_ADDRESS || "") as `0x${string}`,
} as const;
```

### 7b. `frontend/lib/constants.ts`

| Line | Current | Change To |
|------|---------|-----------|
| 5 | `export const EXPLORER_URL = "https://testnet.monadexplorer.com"` | `export const EXPLORER_URL = process.env.NEXT_PUBLIC_MONAD_EXPLORER_URL \|\| "https://monadscan.com"` |
| 8 | `export const AGENT_SCAN_URL = "https://testnet.8004scan.io/agents/monad-testnet"` | `export const AGENT_SCAN_URL = process.env.NEXT_PUBLIC_8004SCAN_URL \|\| "https://8004scan.io/agents/monad"` |

### 7c. `frontend/lib/wagmi.ts`

Rename import to match the new export name:
```ts
// BEFORE:
import { monadTestnet } from "./contracts";
// In chains array: [monadTestnet]

// AFTER:
import { monadChain } from "./contracts";
// In chains array: [monadChain]
```

### 7d. `frontend/pages/bot.tsx` (lines 36-51)

**Remove inline address arrays. Import from shared config instead:**
```ts
// BEFORE (lines 38-51):
const CONTRACTS = [
  { name: "AgentRegistry", address: "0x218b5f1254e77E08f2fF9ee4b4a0EC8a3fe5d101" },
  { name: "Escrow", address: "0x3F07E6302459eDb555FDeCDefE2817f0fe5DCa7E" },
  // ... 5 more
];
const ERC8004_CONTRACTS = [
  { name: "Identity Registry", address: "0x8004A818BFB912233c491871b3d84c89A494BD9e" },
  { name: "Reputation Registry", address: "0x8004B663056A597Dffe9eCcC1965A193B7388713" },
];

// AFTER:
import { ADDRESSES } from "@/lib/contracts";
const CONTRACTS = [
  { name: "AgentRegistry", address: ADDRESSES.agentRegistry },
  { name: "Escrow", address: ADDRESSES.escrow },
  { name: "RPSGame", address: ADDRESSES.rpsGame },
  { name: "PokerGame (Budget Poker)", address: ADDRESSES.pokerGame },
  { name: "AuctionGame", address: ADDRESSES.auctionGame },
  { name: "TournamentV2", address: ADDRESSES.tournamentV2 },
  { name: "PredictionMarket", address: ADDRESSES.predictionMarket },
];
const ERC8004_CONTRACTS = [
  { name: "Identity Registry", address: process.env.NEXT_PUBLIC_ERC8004_IDENTITY_REGISTRY || "" },
  { name: "Reputation Registry", address: process.env.NEXT_PUBLIC_ERC8004_REPUTATION_REGISTRY || "" },
];
```

Also update line 36 comment: `"V5 deployment on Monad testnet"` → `"Monad mainnet"`

### 7e. `frontend/pages/api/skill-md.ts` (lines 14-28)

**Remove inline address objects. Import from shared config:**
```ts
// BEFORE (lines 14-28):
const CONTRACTS = {
  agentRegistry: "0x218b5f1254e77E08f2fF9ee4b4a0EC8a3fe5d101",
  escrow: "0x3F07E6302459eDb555FDeCDefE2817f0fe5DCa7E",
  // ... etc
};
const ERC8004 = {
  identityRegistry: "0x8004A818BFB912233c491871b3d84c89A494BD9e",
  reputationRegistry: "0x8004B663056A597Dffe9eCcC1965A193B7388713",
};

// AFTER:
import { ADDRESSES } from "@/lib/contracts";
const CONTRACTS = ADDRESSES;
const ERC8004 = {
  identityRegistry: process.env.ERC8004_IDENTITY_REGISTRY || process.env.NEXT_PUBLIC_ERC8004_IDENTITY_REGISTRY || "",
  reputationRegistry: process.env.ERC8004_REPUTATION_REGISTRY || process.env.NEXT_PUBLIC_ERC8004_REPUTATION_REGISTRY || "",
};
```

Also search the generated markdown string in this file for all occurrences of:
- `"Monad testnet"` → `"Monad"`
- `"Monad Testnet"` → `"Monad"`
- `10143` → `143`
- `testnet-rpc.monad.xyz` → `rpc.monad.xyz`

### 7f. `frontend/pages/api/agent-card.ts` (lines 79-97)

**Import from shared config:**
```ts
import { ADDRESSES, monadChain } from "@/lib/contracts";
```

Update:
- Line 13-14: Description `"on Monad testnet"` → `"on Monad"`
- Lines 79-88: Replace hardcoded contract addresses with `ADDRESSES.*`
- Lines 91-97: Replace hardcoded network object with values from `monadChain`:
  ```ts
  network: {
    chainId: monadChain.id,
    name: monadChain.name,
    rpcUrl: "https://rpc.monad.xyz",
    explorerUrl: monadChain.blockExplorers.default.url,
  }
  ```

### 7g. `frontend/pages/about.tsx`

- Import `ADDRESSES` from `@/lib/contracts`
- Replace inline contract address arrays with imported values
- Update text: `"Monad Testnet"` → `"Monad"`, `"Chain ID 10143"` → `"Chain ID 143"`
- Update 8004scan link URL

---

## Step 8: Update NPM Package

**File:** `packages/arena-tools/src/config.ts`

| Line | Current | Change To |
|------|---------|-----------|
| 15 | `RPC_URL = "https://monad-testnet.g.alchemy.com/v2/..."` | `RPC_URL = process.env.MONAD_RPC_URL \|\| "https://monad-mainnet.g.alchemy.com/v2/bl9zbJnm4_TpoPKha-QRB"` |
| 17 | `WS_RPC_URL = "wss://monad-testnet.g.alchemy.com/v2/..."` | `WS_RPC_URL = "wss://monad-mainnet.g.alchemy.com/v2/bl9zbJnm4_TpoPKha-QRB"` |
| 19 | `FALLBACK_RPC_URL = "https://testnet-rpc.monad.xyz"` | `FALLBACK_RPC_URL = "https://rpc.monad.xyz"` |
| 20 | `CHAIN_ID = 10143` | `CHAIN_ID = 143` |
| 21 | `CHAIN_NAME = "Monad Testnet"` | `CHAIN_NAME = "Monad"` |
| 22 | `EXPLORER_URL = "https://testnet.monadexplorer.com"` | `EXPLORER_URL = "https://monadscan.com"` |
| 44-52 | All 7 contract addresses (hardcoded testnet) | Load from `process.env` with empty string fallbacks, or update to mainnet addresses after deployment |

After updating: `cd packages/arena-tools && npm run build && npm publish`

---

## Step 9: Update Agent Discovery Files

### `agent/.well-known/agent-card.json`

Update:
- `description`: Remove "testnet" references
- `contracts` object: All addresses → mainnet deployed addresses
- `network.chainId`: `10143` → `143`
- `network.rpcUrl`: → `https://rpc.monad.xyz`
- `network.explorerUrl`: → `https://monadscan.com`

### `agent/registration.json`

Update:
- `metadata.chain`: `"Monad Testnet"` → `"Monad"`
- `metadata.chainId`: `10143` → `143`

---

## Step 10: Update Documentation

### `README.md`
- "on Monad testnet" → "on Monad"
- "Chain 10143" → "Chain 143"
- Contract address table (lines ~86-99): Replace all 10 addresses with mainnet values
- Deployment commands: `--rpc-url monad_testnet` → `--rpc-url monad_mainnet`
- Remove faucet references (mainnet uses real MON)

### `skills/fighter/SKILL.md`
- "Monad testnet" → "Monad"
- Any contract addresses referenced → mainnet

### `skills/spectator/SKILL.md`
- Same changes

---

## Step 11: Post-Deployment Verification

### On-chain checks:
```bash
# Verify game contracts are authorized in Escrow
cast call <ESCROW> "authorizedContracts(address)(bool)" <RPS_GAME> --rpc-url https://monad-mainnet.g.alchemy.com/v2/bl9zbJnm4_TpoPKha-QRB

# Verify game contracts are authorized in AgentRegistry
cast call <AGENT_REGISTRY> "authorizedContracts(address)(bool)" <RPS_GAME> --rpc-url https://monad-mainnet.g.alchemy.com/v2/bl9zbJnm4_TpoPKha-QRB

# Verify PredictionMarket linked
cast call <ESCROW> "predictionMarket()(address)" --rpc-url https://monad-mainnet.g.alchemy.com/v2/bl9zbJnm4_TpoPKha-QRB

# Verify identity registry set
cast call <AGENT_REGISTRY> "identityRegistry()(address)" --rpc-url https://monad-mainnet.g.alchemy.com/v2/bl9zbJnm4_TpoPKha-QRB

# Verify treasury funded
cast call <ESCROW> "treasury()(uint256)" --rpc-url https://monad-mainnet.g.alchemy.com/v2/bl9zbJnm4_TpoPKha-QRB
```

### Agent registration test:
```bash
python3 skills/fighter/scripts/arena.py status
python3 skills/fighter/scripts/arena.py register
python3 skills/fighter/scripts/arena.py status   # confirm registered
```

### Frontend build test:
```bash
cd frontend && npm run build   # must succeed with no errors
npm run dev                    # verify dashboard loads, shows correct chain
```

### End-to-end match test:
1. Register fighter agent on mainnet
2. Start one opponent bot
3. Challenge and play a full RPS match
4. Verify: escrow settles, winner receives MON, ELO updates, prediction market auto-created

---

## Complete File Inventory (29 files)

| # | File | What Changes |
|---|------|-------------|
| **Environment** | | |
| 1 | `.env` | RPC → mainnet Alchemy, chain ID → 143, new wallet keys, all contract addresses |
| 2 | `.env.example` | Template with mainnet defaults |
| 3 | `agent/.env` | RPC URL + private key |
| 4 | `frontend/.env.local` | **New file** — all NEXT_PUBLIC_* env vars |
| **Contracts** | | |
| 5 | `contracts/foundry.toml` | RPC profile → monad_mainnet, chain 143, explorer API URL |
| 6 | `contracts/script/DeployV5.s.sol` | ERC-8004 addresses from vm.envAddress(), comment update, treasury default |
| **Python Agent** | | |
| 7 | `skills/fighter/lib/contracts.py` | RPC fallback → mainnet, chain ID → env var, ERC-8004 → env vars |
| 8 | `skills/spectator/lib/contracts.py` | Same as #7 |
| 9 | `skills/fighter/lib/moltx.py` | Import addresses from contracts.py (remove 3 hardcoded) |
| 10 | `skills/fighter/lib/moltbook.py` | Import addresses from contracts.py (remove 3 hardcoded) |
| 11 | `opponents/base_bot.py` | RPC fallback → mainnet, chain ID → env var |
| **Frontend** | | |
| 12 | `frontend/lib/contracts.ts` | RPC → env var, chain def → env-driven, rename monadTestnet→monadChain, ADDRESSES → env vars |
| 13 | `frontend/lib/constants.ts` | EXPLORER_URL + AGENT_SCAN_URL → env vars |
| 14 | `frontend/lib/wagmi.ts` | Import rename: monadTestnet → monadChain |
| 15 | `frontend/pages/bot.tsx` | Import ADDRESSES from shared config, remove inline arrays |
| 16 | `frontend/pages/api/skill-md.ts` | Import from shared config, update "Monad Testnet" text |
| 17 | `frontend/pages/api/agent-card.ts` | Import from shared config, update network object + description |
| 18 | `frontend/pages/about.tsx` | Import from shared config, update text references |
| **NPM Package** | | |
| 19 | `packages/arena-tools/src/config.ts` | RPC → mainnet, chain ID → 143, explorer → monadscan, contract addresses |
| **Agent Discovery** | | |
| 20 | `agent/.well-known/agent-card.json` | Chain 143, mainnet URLs, contract addresses |
| 21 | `agent/registration.json` | metadata.chain + chainId |
| **Documentation** | | |
| 22 | `README.md` | Address table, chain references, deployment commands |
| 23 | `skills/fighter/SKILL.md` | "Monad testnet" → "Monad" |
| 24 | `skills/spectator/SKILL.md` | Same |
| 25-29 | Various scripts, other docs | Lower-priority testnet references |
