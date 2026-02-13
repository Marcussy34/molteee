# Monad Development Guide (AI Agent Reference)

> Source: Monad AGENTS.md + docs.monad.xyz
> Use retrieval-led reasoning — Monad is rapidly evolving.

---

## Network Information

### Mainnet (Chain ID: 143)
- **RPC Endpoints:**
  - https://rpc.monad.xyz (QuickNode, 25 rps, batch: 100)
  - https://rpc1.monad.xyz (Alchemy, 15 rps, batch: 100)
  - https://rpc2.monad.xyz (Goldsky Edge, 300 per 10s, batch: 10)
  - https://rpc3.monad.xyz (Ankr, 300 per 10s, batch: 10)
- **Explorers:** https://monadscan.com | https://monadvision.com | https://monad.socialscan.io
- **Currency:** MON

### Testnet (Chain ID: 10143)
- **RPC:** https://testnet-rpc.monad.xyz
- **Faucet:** https://faucet.monad.xyz
- **Explorer:** https://monadvision.com

### Canonical Contracts (Mainnet)
```
WMON                = 0x3bd359C1119dA7Da1D913D1C4D2B7c461115433A
Multicall3          = 0xcA11bde05977b3631167028862bE2a173976CA11
EntryPoint-v0.6     = 0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789
EntryPoint-v0.7     = 0x0000000071727De22E5E9d8BAf0edAc6f37da032
Create2Deployer     = 0x13b0D85CcB8bf860b6b79AF3029fCA081AE9beF2
CreateX             = 0xba5Ed099633D3B313e4D5F7bdc1305d3c28ba5Ed
Permit2             = 0x000000000022d473030f116ddee9f6b43ac78ba3
```

---

## Agent-Specific APIs

### Agent Faucet (Testnet Funding)
```bash
curl -X POST https://agents.devnads.com/v1/faucet \
  -H "Content-Type: application/json" \
  -d '{"chainId": 10143, "address": "0xYOUR_ADDRESS"}'
```

### Agent Verification API (All Explorers)
Verifies on all 3 explorers (MonadVision, Socialscan, Monadscan) with one call.

**Step 1: Get verification data**
```bash
# Generate standard JSON input
forge verify-contract <CONTRACT_ADDRESS> <CONTRACT_NAME> \
  --chain 10143 \
  --show-standard-json-input > /tmp/standard-input.json

# Extract metadata
cat out/<Contract>.sol/<Contract>.json | jq '.metadata' > /tmp/metadata.json

# Get compiler version
COMPILER_VERSION=$(jq -r '.metadata | fromjson | .compiler.version' \
  out/<Contract>.sol/<Contract>.json)
```

**Step 2: Call verification API**
```bash
STANDARD_INPUT=$(cat /tmp/standard-input.json)
FOUNDRY_METADATA=$(cat /tmp/metadata.json)

cat > /tmp/verify.json << EOF
{
  "chainId": 10143,
  "contractAddress": "0xYOUR_CONTRACT_ADDRESS",
  "contractName": "src/MyContract.sol:MyContract",
  "compilerVersion": "v${COMPILER_VERSION}",
  "standardJsonInput": $STANDARD_INPUT,
  "foundryMetadata": $FOUNDRY_METADATA
}
EOF

curl -X POST https://agents.devnads.com/v1/verify \
  -H "Content-Type: application/json" \
  -d @/tmp/verify.json
```

**With constructor arguments:** Add `constructorArgs` (ABI-encoded, WITHOUT 0x prefix):
```bash
ARGS=$(cast abi-encode "constructor(string,string,uint256)" "MyToken" "MTK" 1000000000000000000000000)
ARGS_NO_PREFIX=${ARGS#0x}
# Add to request JSON: "constructorArgs": "$ARGS_NO_PREFIX"
```

---

## ClawHub Monad Development Skill

```bash
npx clawhub install monad-development
```

**Includes:** Foundry deployment workflows, Safe multisig setup, frontend integration (viem/wagmi), contract verification automation, EVM compatibility helpers (Prague fork), testnet/mainnet configs.

**View:** https://www.clawhub.ai/portdeveloper/monad-development

---

## Critical Monad Concepts

### Asynchronous Execution
- Consensus happens **before** execution (not after like Ethereum)
- Nodes agree on transaction order first, execute later
- State root is delayed by 3 blocks
- Execution completes in <800ms after consensus

### Parallel Execution
- Transactions execute in parallel (optimistically)
- Results committed in original serial order
- Re-execution if inputs changed (efficient with caching)

### MonadBFT Performance
| Metric | Value |
|--------|-------|
| TPS | 10,000+ |
| Block time | 400ms |
| Finality | 800ms (2 blocks) |
| Gas throughput | 500M gas/sec |

### Block States
```
Proposed(t=0) → Voted(t=400ms) → Finalized(t=800ms) → Verified(t=1200ms)
```
- **UI updates (balances, NFT ownership):** Wait for Voted (400ms)
- **Financial logic (payments, settlements):** Wait for Finalized (800ms)
- **State verification (zkApps, fraud proofs):** Wait for Verified (1200ms)

---

## Key Differences from Ethereum

### Gas Model
- Monad charges on **gas_limit** (not gas_used) — set limits accurately!
- Formula: `total_cost = value + (gas_price * gas_limit)`

### Contract Size
- Ethereum: 24.5kb max → Monad: **128kb max**

### Storage Access Pricing
- SLOAD cold: 8100 gas (vs Ethereum's 2100) — repriced for parallel execution

### EIP-7702 Reserve Balance
- Delegated EOAs need **10 MON** minimum reserve

### No Blob Transactions
- EIP-4844 blob txs NOT supported. Use types 0, 1, 2, 4.

### Tooling Version Requirements
- Foundry: 1.5.1+
- viem: 2.40.0+

---

## Documentation Links
- **Complete Index:** https://docs.monad.xyz/llms.txt
- **Main Docs:** https://docs.monad.xyz
- **Deploy (Foundry):** https://docs.monad.xyz/guides/deploy-smart-contract/foundry
- **Verify (Foundry):** https://docs.monad.xyz/guides/verify-smart-contract/foundry
- **Gas Pricing:** https://docs.monad.xyz/developer-essentials/gas-pricing
- **Differences:** https://docs.monad.xyz/developer-essentials/differences
- **Best Practices:** https://docs.monad.xyz/developer-essentials/best-practices
- **Ecosystem Protocols:** https://github.com/monad-crypto/protocols
- **Token List:** https://github.com/monad-crypto/token-list
