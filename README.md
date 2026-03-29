# DEAR - Autonomous Institutional Treasury Agent

Detect . Attest . Govern . Bridge . List

An autonomous AI agent that manages institutional treasury operations on the [Rayls](https://www.rayls.com/) network. It continuously scans a Privacy Node for tokenized assets, performs compliance analysis via a local LLM, makes governance decisions, bridges approved assets to the public chain, and lists them on a marketplace -- all without human intervention.

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

# Pull the LLM model (local, zero cloud dependency)
ollama pull deepseek-r1:14b

# Run the agent
KNOWN_TOKENS=0x34b40ba116d5dec75548a9e9a8f15411461e8c70 npx tsx src/index.ts
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
2. **ATTEST** -- LLM analyzes asset type, risk score, compliance status. Minimal on-chain attestation on the public chain (proof of existence, no private details revealed)
3. **GOVERN** -- LLM acts as compliance committee: approves or rejects the asset for bridge with structured reasoning
4. **BRIDGE** -- If approved, initiates Privacy Node to Public Chain bridge (dry-run first)
5. **LIST** -- Lists the bridged asset on the Marketplace contract with a suggested price
6. **MONITOR** -- Checks marketplace state, loops back to DETECT

Each phase produces structured colored logs with audio feedback on macOS.

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
|  |  GOVERN           |    |  - Dry-run mode           |  |
|  |  BRIDGE           |    |  - Cooldown enforcement   |  |
|  |  LIST             |    +---------------------------+  |
|  |  MONITOR          |                                   |
|  +-------------------+    +---------------------------+  |
|                           |   Structured Logger       |  |
|  +-------------------+    |  - Colored terminal output|  |
|  |   LLM Provider    |    |  - Full reasoning traces  |  |
|  |  Ollama (local)   |    |  - Audio + voice feedback |  |
|  |  deepseek-r1:14b  |    +---------------------------+  |
|  +-------------------+                                   |
|                                                          |
|  +----------------------------------------------------+  |
|  |                   TOOLS (viem)                      |  |
|  |  Privacy Node 5         Public Testnet              |  |
|  |  - detectAssets()       - attestOnChain()           |  |
|  |  - balanceOf()          - listOnMarketplace()       |  |
|  |  - bridgeAsset()        - getMarketplaceListings()  |  |
|  +----------------------------------------------------+  |
+----------------------------------------------------------+
         |                              |
         v                              v
   Privacy Node 5              Rayls Public Testnet
   Chain ID: 800005            Chain ID: 7295799
```

---

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PRIVACY_NODE_RPC_URL` | Rayls Privacy Node 5 RPC | `https://privacy-node-5.rayls.com` |
| `PUBLIC_CHAIN_RPC_URL` | Rayls Public Testnet RPC | `https://testnet-rpc.rayls.com` |
| `DEPLOYER_PRIVATE_KEY` | Private key for transactions | Required |
| `USER_PRIVATE_KEY` | Secondary private key | Required |
| `OLLAMA_MODEL` | Ollama model to use | `deepseek-r1:14b` |
| `DRY_RUN` | Simulate transactions without sending | `true` |
| `MAX_BRIDGE_AMOUNT` | Max tokens per bridge transaction | `10000` |
| `AGENT_LOOP_INTERVAL_MS` | Delay between cycles in ms | `30000` |
| `KNOWN_TOKENS` | Comma-separated token addresses to monitor | - |

---

## Deploy a Token

```bash
# Compile the contract (requires Foundry)
cd contracts && forge build && cd ..

# Deploy to Privacy Node
npx tsx src/deploy.ts
```

The script outputs the deployed token address. Use it with `KNOWN_TOKENS`:

```bash
KNOWN_TOKENS=0xYOUR_TOKEN_ADDRESS npx tsx src/index.ts
```

---

## Guardrails

| Rule | Default |
|------|---------|
| Max bridge per transaction | 10,000 tokens |
| Dry-run before execution | Enabled |
| Cooldown between actions | 10 seconds |
| LLM timeout | 120 seconds |

Set `DRY_RUN=false` to execute real on-chain transactions.

---

## Project Structure

```
src/
  index.ts              Entry point, env validation, chain connections
  deploy.ts             Token deployment script
  agent/
    loop.ts             Main DETECT->LIST->MONITOR cycle
    llm.ts              Ollama client (OpenAI-compatible API)
    tools.ts            On-chain read/write functions
    guardrails.ts       Rate limits, dry-run, max amounts
    sounds.ts           macOS audio feedback + voice narration
  chain/
    privacy.ts          viem client for Privacy Node (chain 800005)
    public.ts           viem client for Public Chain (chain 7295799)
    contracts.ts        ABIs for HackathonToken, Attestation, Marketplace
  logger/
    index.ts            Colored terminal output + pino structured logs
  types/
    index.ts            TypeScript types + zod env schema
contracts/
  src/HackathonToken.sol  Minimal ERC20 with mint
demo/
  capture-logs.ts       Record agent output as JSON timeline
  timeline-mock.json    Pre-built timeline for video rendering
  REMOTION_PROMPT.md    Spec for generating the Remotion demo video
```

---

## Tech Stack

| Component | Choice | Why |
|-----------|--------|-----|
| Runtime | Node.js + TypeScript | Type-safe, fast iteration |
| LLM | Ollama (deepseek-r1:14b) | Local, zero cloud, full sovereignty |
| Blockchain | viem | Modern, type-safe EVM client |
| Contracts | Foundry (solc 0.8.20) | Battle-tested toolchain |
| Logs | pino | Structured JSON output |
| Config | dotenv + zod | Runtime env validation |

---

## Explorers

- Privacy Node 5: https://blockscout-privacy-node-5.rayls.com
- Public Testnet: https://testnet-explorer.rayls.com

---

## Demo Video

To capture a run for the Remotion demo video:

```bash
KNOWN_TOKENS=0x... npx tsx demo/capture-logs.ts
# Wait for one full cycle, then Ctrl+C
# Output: demo/timeline.json
```

See `demo/REMOTION_PROMPT.md` for the full Remotion video generation spec.

---

Built at **Rayls Hackathon #2 -- Cannes 2026**
