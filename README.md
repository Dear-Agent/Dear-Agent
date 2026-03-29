# Dear Agent — Autonomous Institutional Treasury Agent on Rayls

> **"Humans watch; the agent operates."**

---

## What is it?

Dear Agent is an **autonomous AI agent** that manages an institutional treasury on the [Rayls](https://rayls.com) network. It autonomously detects private assets, attests their existence on-chain, performs AI-driven compliance review, bridges them from a privacy node to the public chain, and lists them on a marketplace — all without human intervention.

---

## The Problem

Institutional asset managers operating on privacy-preserving blockchains face a bottleneck: moving assets from private to public markets requires coordinated multi-step workflows (attestation, compliance, bridging, listing) that are manual, error-prone, and slow. There's no autonomous system that can handle this end-to-end while respecting privacy boundaries.

---

## The Solution

An AI agent loop that runs continuously across two Rayls chains:

| Chain | Role |
|---|---|
| Privacy Node 5 (`800005`) | Where private assets live |
| Rayls Public Testnet (`7295799`) | Where attested assets are traded |

### Agent Pipeline

```
DETECT → ATTEST → GOVERN → BRIDGE → LIST → MONITOR → (loop)
```

1. **DETECT** — Scans the Privacy Node for deployed ERC20/721/1155 tokens. The LLM analyzes which assets are ready for the pipeline.
2. **ATTEST** — Deploys a minimal on-chain attestation (proof of existence) to the public chain — without revealing private details.
3. **GOVERN** — The LLM acts as compliance reviewer: is this asset ready to bridge? Produces a structured JSON decision with full reasoning, logged permanently.
4. **BRIDGE** — If governance approves, initiates the Privacy → Public bridge (lock + mirror mint). Dry-run first, always.
5. **LIST** — Lists the bridged asset on the Marketplace smart contract with a price in USDR. The asset is now publicly tradeable with full provenance.
6. **MONITOR** — Continuous loop: watches for new assets and re-runs the full pipeline automatically.

---

## Architecture

```
+----------------------------------------------------------+
|                    HARNESS (TypeScript)                   |
|                                                           |
|  +-------------------+    +---------------------------+  |
|  |   Agent Loop      |    |   Guardrails Engine       |  |
|  |  DETECT           |    |  - Max bridge amount      |  |
|  |  ATTEST           |    |  - Whitelist contracts    |  |
|  |  GOVERN           |    |  - Rate limiting          |  |
|  |  BRIDGE           |    |  - Dry-run mode           |  |
|  |  LIST             |    +---------------------------+  |
|  |  MONITOR          |                                   |
|  +-------------------+    +---------------------------+  |
|                           |   Structured Logger       |  |
|  +-------------------+    |  - Every decision logged  |  |
|  |   LLM Provider    |    |  - On-chain tx hashes     |  |
|  |  Claude (primary) |    |  - Full reasoning traces  |  |
|  |  OpenRouter (fbk) |    +---------------------------+  |
|  +-------------------+                                   |
|                                                           |
|  +----------------------------------------------------+  |
|  |                   TOOLS (viem)                     |  |
|  |  Privacy Node          Public Chain                |  |
|  |  - deployToken()       - deployMarketplace()       |  |
|  |  - mintToken()         - listAsset()               |  |
|  |  - getBalances()       - getListings()             |  |
|  |  - bridgeToPublic()    - attestOnChain()           |  |
|  +----------------------------------------------------+  |
+----------------------------------------------------------+
         |                              |
         v                              v
   Privacy Node 5              Rayls Public Testnet
   Chain ID: 800005            Chain ID: 7295799
```

---

## Tech Stack

| Component | Choice | Why |
|---|---|---|
| Runtime | Node.js + TypeScript | Type-safe, fast iteration |
| LLM | Claude (Anthropic SDK) | Primary reasoning engine |
| Fallback LLM | OpenRouter | DeepSeek/Llama backup |
| Blockchain client | viem | Modern, type-safe EVM |
| Smart contracts | Foundry (Rayls starter kit) | Battle-tested, provided by Rayls |
| Logger | pino | Structured JSON logs |
| Config | dotenv + zod | Runtime env validation |

---

## Guardrails

The agent enforces safety rules at every step:

| Rule | Default |
|---|---|
| Max bridge per transaction | 10,000 tokens |
| Max bridge per hour | 50,000 tokens |
| Dry-run before any execution | `true` |
| Contract whitelist | Only deployed contracts |
| Cooldown between actions | 5 seconds |
| Timeout per phase | 30 seconds |

---

## Running the Agent

### Prerequisites

```bash
npm install
```

### Environment

Copy and fill in `.env`:

```env
PRIVACY_NODE_RPC_URL=https://privacy-node-5.rayls.com
PRIVACY_NODE_CHAIN_ID=800005
PUBLIC_CHAIN_RPC_URL=https://testnet-rpc.rayls.com
PUBLIC_CHAIN_ID=7295799
DEPLOYER_PRIVATE_KEY=<your-key>
ANTHROPIC_API_KEY=<your-key>
DRY_RUN=true
MAX_BRIDGE_AMOUNT=10000
AGENT_LOOP_INTERVAL_MS=30000
```

### Start the agent

```bash
npm run dev       # development (ts-node)
npm start         # production (compiled)
```

### Deploy contracts

```bash
npm run deploy
```

---

## What the Jury Sees Live

1. **Terminal** — Structured real-time logs: every agent decision with its full LLM reasoning
2. **Block explorers** — Transactions visible on both Rayls explorers (Privacy Node + Public Testnet)
3. **Autonomy** — The agent runs the full pipeline without human input
4. **Guardrails in action** — Dry-run logs, threshold enforcement, rate limiting visible in output
5. **AI reasoning** — Not just a script: the agent reasons, decides, and justifies every action in JSON

---

## Project Structure

```
src/
  index.ts              # Entry point + graceful shutdown
  agent/
    loop.ts             # Main pipeline: DETECT→ATTEST→GOVERN→BRIDGE→LIST→MONITOR
    llm.ts              # Anthropic SDK wrapper + OpenRouter fallback
    tools.ts            # On-chain tool definitions
    guardrails.ts       # Safety rules, rate limits, dry-run
  chain/
    privacy.ts          # viem client for Privacy Node
    public.ts           # viem client for Public Chain
    contracts.ts        # ABIs + contract addresses
  logger/
    index.ts            # pino structured logger
  types/
    index.ts            # Shared TypeScript types
  deploy.ts             # Contract deployment script
contracts/
  src/HackathonToken.sol  # ERC20 token for demo
```

---

Built at **Rayls Hackathon 2026** by the Dear Agent team.
