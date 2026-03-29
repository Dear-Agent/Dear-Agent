# DEAR - Autonomous Institutional Treasury Agent

Detect . Attest . Govern . Bridge . List

An autonomous AI agent that manages institutional treasury operations on the [Rayls](https://www.rayls.com/) network. It continuously scans a Privacy Node for tokenized assets, performs compliance analysis via a local LLM, makes governance decisions, bridges approved assets, and lists them on a marketplace -- all without human intervention.

---

## Quick Start

```bash
# Clone
git clone https://github.com/Dear-Agent/Dear-Agent.git
cd Dear-Agent

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env: fill in DEPLOYER_PRIVATE_KEY and USER_PRIVATE_KEY

# Pull an LLM model (local, zero cloud dependency)
ollama pull qwen3:8b
# or: ollama pull deepseek-r1:14b

# Deploy contracts on Privacy Node (token + attestation + marketplace)
npm run deploy
npm run deploy:public

# Run the agent (use the token address from deploy output)
KNOWN_TOKENS=0xd0141e899a65c95a556fe2b27e5982a6de7fdd7a npm start
```

### Prerequisites

- **Node.js** >= 18
- **Ollama** installed and running (`ollama serve`)
- **Foundry** for contract compilation (optional, pre-compiled artifacts included)
- macOS recommended for full audio feedback (system sounds + voice narration)

---

## Agent Pipeline

```
DETECT --> ATTEST --> GOVERN --> BRIDGE --> LIST --> MONITOR --> (loop)
```

1. **DETECT** -- Scans the Privacy Node for deployed ERC20 tokens with non-zero balance
2. **ATTEST** -- LLM analyzes asset type, risk score, compliance status. On-chain attestation recorded on Privacy Node (proof of existence, no private details revealed)
3. **GOVERN** -- LLM acts as compliance committee: approves or rejects the asset for bridge with structured reasoning
4. **BRIDGE** -- If approved, records bridge intent on Privacy Node (backend API with on-chain fallback)
5. **LIST** -- Lists the asset on the Marketplace contract with AI-suggested pricing
6. **MONITOR** -- Checks marketplace state, loops back to DETECT

Each phase produces structured colored logs with audio feedback and voice narration on macOS.

---

## Architecture

```
+----------------------------------------------------------+
|                    HARNESS (TypeScript)                   |
|                                                          |
|  +-------------------+    +---------------------------+  |
|  |   Agent Loop      |    |   Guardrails Engine       |  |
|  |  DETECT           |    |  - Max bridge amount      |  |
|  |  ATTEST           |    |  - Rate limiting          |  |
|  |  GOVERN           |    |  - Cooldown enforcement   |  |
|  |  BRIDGE           |    +---------------------------+  |
|  |  LIST             |                                   |
|  |  MONITOR          |    +---------------------------+  |
|  +-------------------+    |   Structured Logger       |  |
|                           |  - Colored terminal output|  |
|  +-------------------+    |  - Full reasoning traces  |  |
|  |   LLM Provider    |    |  - Audio + voice feedback |  |
|  |  Ollama (local)   |    +---------------------------+  |
|  |  qwen3 / deepseek |                                   |
|  +-------------------+                                   |
|                                                          |
|  +----------------------------------------------------+  |
|  |              SMART CONTRACTS (Privacy Node)         |  |
|  |  HackathonToken    Attestation    Marketplace       |  |
|  |  - ERC20 + mint    - attest()     - list()          |  |
|  |  - balanceOf()     - getAttest()  - buy()           |  |
|  |  - transfer()      - events       - getListing()    |  |
|  +----------------------------------------------------+  |
+----------------------------------------------------------+
         |                              |
         v                              v
   Privacy Node 5              Rayls Public Testnet
   Chain ID: 800005            Chain ID: 7295799
```

---

## Deployed Contracts (Privacy Node 5)

| Contract | Address |
|----------|---------|
| HackathonToken | `0xd0141e899a65c95a556fe2b27e5982a6de7fdd7a` |
| Attestation | `0x07882ae1ecb7429a84f1d53048d35c4bb2056877` |
| Marketplace | `0x22753e4264fddc6181dc7cce468904a80a363e44` |

Explorer: https://blockscout-privacy-node-5.rayls.com

---

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PRIVACY_NODE_RPC_URL` | Rayls Privacy Node 5 RPC | `https://privacy-node-5.rayls.com` |
| `PUBLIC_CHAIN_RPC_URL` | Rayls Public Testnet RPC | `https://testnet-rpc.rayls.com` |
| `DEPLOYER_PRIVATE_KEY` | Private key for transactions | Required |
| `USER_PRIVATE_KEY` | Secondary private key | Required |
| `OLLAMA_MODEL` | Ollama model to use | `qwen3:8b` |
| `DRY_RUN` | Simulate transactions without sending | `false` |
| `MAX_BRIDGE_AMOUNT` | Max tokens per bridge transaction | `10000` |
| `AGENT_LOOP_INTERVAL_MS` | Delay between cycles in ms | `30000` |
| `KNOWN_TOKENS` | Comma-separated token addresses to monitor | - |
| `ATTESTATION_ADDRESS` | Attestation contract address | - |
| `MARKETPLACE_ADDRESS` | Marketplace contract address | - |

---

## Deploy Contracts

```bash
# Compile (requires Foundry, optional if artifacts exist)
cd contracts && forge build && cd ..

# Deploy HackathonToken on Privacy Node
npm run deploy

# Deploy Attestation + Marketplace on Privacy Node
npm run deploy:public
```

---

## Guardrails

| Rule | Default |
|------|---------|
| Max bridge per transaction | 10,000 tokens |
| Cooldown between actions | 10 seconds |
| LLM timeout | 120 seconds |

Set `DRY_RUN=true` to simulate transactions without sending.

---

## Project Structure

```
src/
  index.ts              Entry point, env validation, chain connections
  deploy.ts             Token deployment script (Privacy Node)
  deploy-public.ts      Attestation + Marketplace deployment (Privacy Node)
  agent/
    loop.ts             Main DETECT->LIST->MONITOR cycle
    llm.ts              Ollama client (native API, JSON mode, think:false)
    tools.ts            On-chain read/write functions
    guardrails.ts       Rate limits, max amounts, cooldown
    sounds.ts           macOS audio feedback + voice narration
  chain/
    privacy.ts          viem client for Privacy Node (chain 800005)
    public.ts           viem client for Public Chain (chain 7295799)
    contracts.ts        ABIs + addresses (loaded from env)
  logger/
    index.ts            Colored terminal output + pino structured logs
  types/
    index.ts            TypeScript types + zod env schema
contracts/
  src/
    HackathonToken.sol  ERC20 with mint
    Attestation.sol     On-chain attestation registry
    Marketplace.sol     Asset listing and trading
```

---

## Tech Stack

| Component | Choice | Why |
|-----------|--------|-----|
| Runtime | Node.js + TypeScript | Type-safe, fast iteration |
| LLM | Ollama (qwen3:8b / deepseek-r1:14b) | Local, zero cloud, full sovereignty |
| Blockchain | viem | Modern, type-safe EVM client |
| Contracts | Foundry (solc 0.8.20) | Battle-tested toolchain |
| Logs | pino | Structured JSON output |
| Config | dotenv + zod | Runtime env validation |

---

## Explorers

- Privacy Node 5: https://blockscout-privacy-node-5.rayls.com
- Public Testnet: https://testnet-explorer.rayls.com

---

Built at **Rayls Hackathon #2 -- Cannes 2026**
