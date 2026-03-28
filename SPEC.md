# Autonomous Institutional Treasury Agent - Spec

## Vision

Un agent IA autonome qui gere une treasury institutionnelle sur Rayls :
detection d'assets, attestation, gouvernance, bridge cross-chain, listing sur marketplace.
**"Humans watch; the agent operates."**

---

## Architecture

```
+----------------------------------------------------------+
|                    HARNESS (TypeScript)                    |
|                                                           |
|  +-------------------+    +---------------------------+   |
|  |   Agent Loop      |    |   Guardrails Engine       |   |
|  |                   |    |                           |   |
|  |  1. DETECT        |    |  - Max bridge amount      |   |
|  |  2. ATTEST        |    |  - Whitelist contracts    |   |
|  |  3. GOVERN        |    |  - Rate limiting          |   |
|  |  4. BRIDGE        |    |  - Dry-run mode           |   |
|  |  5. LIST          |    +---------------------------+   |
|  |  6. MONITOR       |                                    |
|  +-------------------+    +---------------------------+   |
|                           |   Structured Logger        |   |
|  +-------------------+    |                           |   |
|  |   LLM Provider    |    |  - Every decision logged  |   |
|  |   (LiteLLM/direct)|    |  - On-chain tx hashes    |   |
|  |                   |    |  - Reasoning traces       |   |
|  |  Claude / GPT /   |    +---------------------------+   |
|  |  Local model      |                                    |
|  +-------------------+                                    |
|                                                           |
|  +----------------------------------------------------+  |
|  |                   TOOLS (viem)                       |  |
|  |                                                      |  |
|  |  Privacy Node (chain 800005)    Public Chain (7295799)|  |
|  |  - deployToken()                - deployMarketplace() |  |
|  |  - mintToken()                  - listAsset()         |  |
|  |  - getBalances()                - getListings()       |  |
|  |  - bridgeToPublic()             - attestOnChain()     |  |
|  +----------------------------------------------------+  |
+----------------------------------------------------------+
         |                                    |
         v                                    v
   Privacy Node 5                      Rayls Public Testnet
   RPC: privacy-node-5.rayls.com       RPC: testnet-rpc.rayls.com
   Chain ID: 800005                    Chain ID: 7295799
```

---

## Agent Loop (5 phases du hackathon)

### Phase 1 : DETECT
- Scan le Privacy Node pour les assets deployes
- Identifie les tokens (ERC20/721/1155), balances, metadata
- L'agent LLM analyse : "Quels assets sont prets a etre attestes ?"

### Phase 2 : ATTEST
- L'agent genere une attestation signee (preuve d'existence)
- Deploie/appelle `Attestation.sol` sur la public chain
- L'attestation ne revele PAS les details prives, juste l'existence

### Phase 3 : GOVERN
- L'agent LLM joue le role de "compliance reviewer"
- Analyse le token : est-il pret pour le bridge ?
- Produit une recommendation structuree (JSON)
- Log la decision avec le raisonnement complet

### Phase 4 : BRIDGE
- Si gouvernance OK, initie le bridge Privacy -> Public
- Utilise le mecanisme de bridge Rayls (lock + mint miroir)
- Guardrail : montant max, dry-run d'abord

### Phase 5 : LIST
- Deploie/utilise `Marketplace.sol` sur la public chain
- Liste le token bridge avec prix en USDR
- L'asset est maintenant publiquement tradeable

### Phase 6 : MONITOR (bonus)
- Boucle continue : surveille les nouveaux assets
- Re-execute le pipeline pour chaque nouvel asset detecte

---

## Stack Technique

| Composant         | Choix                  | Pourquoi                              |
|-------------------|------------------------|---------------------------------------|
| Runtime           | Node.js + TypeScript   | Maitrise de l'equipe                  |
| LLM               | Claude (Anthropic SDK) | Principal, direct API call            |
| Fallback LLM      | OpenRouter (free tier) | Backup, DeepSeek/Llama               |
| Blockchain client | viem                   | Moderne, type-safe, EVM standard     |
| Smart contracts   | Starter kit Foundry    | Fourni par Rayls                      |
| Logger            | pino                   | Structured JSON logs, rapide          |
| Config            | dotenv + zod           | Validation des env vars               |

---

## Fichiers a creer

```
rayls/
  package.json
  tsconfig.json
  .env                     # Creds Privacy Node + Public Chain + API keys
  src/
    index.ts               # Entry point, lance la boucle agent
    agent/
      loop.ts              # Boucle principale DETECT->LIST->MONITOR
      llm.ts               # Wrapper LLM (Anthropic SDK + fallback)
      tools.ts             # Definitions des tools pour l'agent
      guardrails.ts        # Regles de securite, seuils, rate limits
    chain/
      privacy.ts           # Client viem pour Privacy Node
      public.ts            # Client viem pour Public Chain
      contracts.ts         # ABIs + addresses des contrats
    logger/
      index.ts             # Pino logger structure
    types/
      index.ts             # Types partages
```

---

## Guardrails

| Regle                          | Valeur par defaut         |
|--------------------------------|---------------------------|
| Max bridge par transaction     | 10,000 tokens             |
| Max bridge par heure           | 50,000 tokens             |
| Dry-run obligatoire avant exec | true                      |
| Whitelist de contrats          | Seulement ceux deployes   |
| Cooldown entre actions         | 5 secondes                |
| Timeout par phase              | 30 secondes               |

---

## Flow d'un cycle agent

```
1. Agent demarre
2. DETECT: scan Privacy Node -> trouve HackathonToken (ERC20, supply 1M)
3. LLM analyse: "Token ERC20, supply raisonnable, metadata complete -> READY"
4. ATTEST: appelle Attestation.sol sur public chain
   -> tx hash logged, attestation ID stocke
5. GOVERN: LLM review compliance
   -> "Asset atteste, supply < seuil, metadata OK -> APPROVED"
   -> Decision + reasoning logged en JSON
6. BRIDGE: dry-run OK -> execute bridge Privacy -> Public
   -> Lock tx sur Privacy Node, attend mint miroir (30-60s)
   -> tx hashes logged
7. LIST: appelle Marketplace.sol, liste a prix X USDR
   -> Listing tx hash logged
8. MONITOR: attend 30s, re-scan, boucle
```

---

## Ce que le jury voit

1. **Terminal** : logs structures en temps reel, chaque decision de l'agent avec son raisonnement
2. **Explorers** : transactions visibles sur les deux block explorers Rayls
3. **Autonomie** : l'agent tourne sans intervention humaine
4. **Guardrails** : le jury voit les regles appliquees (dry-run, seuils)
5. **AI Integration** : pas juste un script -- l'agent raisonne, decide, justifie

---

## Criteres du jury mappes

| Critere jury              | Comment on repond                                           |
|---------------------------|-------------------------------------------------------------|
| Sovereignty               | Tout demarre sur Privacy Node, rien de visible avant bridge |
| Disclosure Design         | L'agent decide quoi reveler via attestation minimale        |
| AI Integration            | LLM a chaque phase, decisions tracees on-chain              |
| Public Market Viability   | Marketplace fonctionnel avec provenance attestee            |
| Working Prototype         | Live demo, tx visibles sur explorers                        |

---

## Env vars requises

```env
# Privacy Node
PRIVACY_NODE_RPC_URL=https://privacy-node-5.rayls.com
DEPLOYMENT_PROXY_REGISTRY=0x75Da1758161588FD2ccbFd23AB87f373b0f73c8F
PRIVACY_NODE_CHAIN_ID=800005

# Public Chain
PUBLIC_CHAIN_RPC_URL=https://testnet-rpc.rayls.com
PUBLIC_CHAIN_ID=7295799

# Backend API
BACKEND_URL=https://rayls-backend-privacy-node-5.rayls.com
USER_AUTH_KEY=ce87c003337354d7e906d4dbd30d133affce711449801f16b58ff1c6b2ddf327
OPERATOR_AUTH_KEY=ce87c003337354d7e906d4dbd30d133affce711449801f16b58ff1c6b2ddf327

# Private Keys (a generer)
DEPLOYER_PRIVATE_KEY=
USER_PRIVATE_KEY=

# LLM
ANTHROPIC_API_KEY=
OPENROUTER_API_KEY=    # fallback, optionnel

# Agent Config
DRY_RUN=true
MAX_BRIDGE_AMOUNT=10000
AGENT_LOOP_INTERVAL_MS=30000
```

---

## Priorites (2h)

### Must have (1h30)
- [ ] Setup projet TS + viem + Anthropic SDK
- [ ] Agent loop basique (DETECT -> ATTEST -> GOVERN -> BRIDGE -> LIST)
- [ ] Connexion Privacy Node + Public Chain
- [ ] Logger structure
- [ ] Au moins un cycle complet qui tourne

### Nice to have (30min)
- [ ] Guardrails engine
- [ ] Boucle MONITOR continue
- [ ] Multi-model fallback
- [ ] Dashboard logs pour la demo

### Won't do (pas le temps)
- MCP server
- UI web
- Tests unitaires
- CI/CD
