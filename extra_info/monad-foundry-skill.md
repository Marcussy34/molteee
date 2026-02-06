# Monad Foundry Development Skill (Full SKILL.md)

> Source: ClawHub portdeveloper/monad-development v1.0.0
> For additional questions: https://docs.monad.xyz/llms.txt

---

## Defaults

- **Network:** Always use testnet (chain ID 10143) unless user says "mainnet"
- **Verification:** Always verify contracts after deployment unless user says not to
- **Framework:** Use Foundry (not Hardhat)
- **Wallet:** If you generate a wallet, MUST persist it (see Wallet Persistence)

---

## Explorers (Testnet + Mainnet)

| Explorer    | Testnet                                  | Mainnet                          |
|-------------|------------------------------------------|----------------------------------|
| Socialscan  | https://monad-testnet.socialscan.io      | https://monad.socialscan.io      |
| MonadVision | https://testnet.monadvision.com          | https://monadvision.com          |
| Monadscan   | https://testnet.monadscan.com            | https://monadscan.com            |

---

## EVM Version (Critical)

Always set `evmVersion: "prague"`. Requires Solidity **0.8.27+**.

```toml
# foundry.toml
[profile.default]
evm_version = "prague"
solc_version = "0.8.28"
```

---

## Wallet Persistence

**CRITICAL for agents:** If you generate a wallet, you MUST persist it for future use.

When generating a new wallet:
1. Create wallet: `cast wallet new`
2. Immediately save the address and private key
3. Inform the user where the wallet details are stored
4. Fund the wallet via faucet before deployment

**Storage options:**
- Write to `~/.monad-wallet` with `chmod 600`
- Store in a project-specific `.env` file (add to `.gitignore`)
- Return credentials to user and ask them to save securely

---

## Deployment Workflow

Use `forge script` for deployments (**NOT** `forge create`):

```bash
forge script script/Deploy.s.sol:DeployScript \
  --rpc-url https://testnet-rpc.monad.xyz \
  --private-key $PRIVATE_KEY \
  --broadcast
```

**Deploy script template:**
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;
import "forge-std/Script.sol";
import "../src/MyContract.sol";

contract DeployScript is Script {
    function run() external {
        vm.startBroadcast();
        MyContract myContract = new MyContract();
        console.log("Contract deployed at:", address(myContract));
        vm.stopBroadcast();
    }
}
```

### Deploy Script Gotchas

```solidity
// CORRECT — reads private key from --private-key flag
function run() external {
    vm.startBroadcast();
    new MyContract();
    vm.stopBroadcast();
}

// WRONG — hardcodes address, causes "No associated wallet" error
function run() external {
    vm.startBroadcast(0x1234...);
}
```

---

## Foundry Tips

### Flags that DON'T exist (don't use):
- `--no-commit` — not valid for `forge init` or `forge install`

### forge create is buggy:
- `forge create --broadcast` is buggy and often ignored
- **Always use `forge script` instead**

---

## Verification

### Primary: Agent Verification API (all 3 explorers at once)

```bash
# 1. Get verification data
forge verify-contract <ADDR> <CONTRACT> \
  --chain 10143 \
  --show-standard-json-input > /tmp/standard-input.json

cat out/<Contract>.sol/<Contract>.json | jq '.metadata' > /tmp/metadata.json
COMPILER_VERSION=$(jq -r '.metadata | fromjson | .compiler.version' out/<Contract>.sol/<Contract>.json)

# 2. Call verification API
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

**With constructor args:** Add `constructorArgs` (ABI-encoded, WITHOUT 0x prefix):
```bash
ARGS=$(cast abi-encode "constructor(string,string,uint256)" "MyToken" "MTK" 1000000000000000000000000)
ARGS_NO_PREFIX=${ARGS#0x}
# Add to request: "constructorArgs": "$ARGS_NO_PREFIX"
```

### Fallback: Manual verification (if API fails)
```bash
forge verify-contract <ADDR> <CONTRACT> --chain 10143 \
  --verifier sourcify \
  --verifier-url "https://sourcify-api-monad.blockvision.org/"
```

---

## Frontend Integration

Import from `viem/chains`. **Do NOT define custom chain:**

```typescript
import { monadTestnet } from "viem/chains";
```

**With wagmi:**
```typescript
import { createConfig, http } from 'wagmi'
import { monadTestnet } from 'viem/chains'

const config = createConfig({
  chains: [monadTestnet],
  transports: {
    [monadTestnet.id]: http()
  }
})
```

---

## Full Example: Deploy ERC20

### 1. Create project
```bash
forge init my-token
cd my-token
```

### 2. Configure foundry.toml
```toml
[profile.default]
src = "src"
out = "out"
libs = ["lib"]
evm_version = "prague"
solc_version = "0.8.28"
```

### 3. Create contract `src/MyToken.sol`
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MyToken is ERC20 {
    constructor(uint256 initialSupply) ERC20("MyToken", "MTK") {
        _mint(msg.sender, initialSupply);
    }
}
```

### 4. Install dependencies
```bash
forge install OpenZeppelin/openzeppelin-contracts --no-commit
```

### 5. Create deploy script `script/Deploy.s.sol`
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;
import "forge-std/Script.sol";
import "../src/MyToken.sol";

contract DeployScript is Script {
    function run() external {
        vm.startBroadcast();
        MyToken token = new MyToken(1000000 * 10**18);
        console.log("Token deployed at:", address(token));
        vm.stopBroadcast();
    }
}
```

### 6. Deploy
```bash
forge script script/Deploy.s.sol:DeployScript \
  --rpc-url https://testnet-rpc.monad.xyz \
  --private-key $PRIVATE_KEY \
  --broadcast
```

### 7. Verify
```bash
# Use verification API (verifies on all explorers)
STANDARD_INPUT=$(forge verify-contract <TOKEN_ADDRESS> src/MyToken.sol:MyToken \
  --chain 10143 --show-standard-json-input)
COMPILER_VERSION=$(jq -r '.metadata | fromjson | .compiler.version' \
  out/MyToken.sol/MyToken.json)

curl -X POST https://agents.devnads.com/v1/verify \
  -H "Content-Type: application/json" \
  -d "{
    \"chainId\": 10143,
    \"contractAddress\": \"<TOKEN_ADDRESS>\",
    \"contractName\": \"src/MyToken.sol:MyToken\",
    \"compilerVersion\": \"v${COMPILER_VERSION}\",
    \"standardJsonInput\": $STANDARD_INPUT,
    \"constructorArgs\": \"$(cast abi-encode 'constructor(uint256)' 1000000000000000000000000 | sed 's/0x//')\"
  }"
```
