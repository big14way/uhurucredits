# Uhuru Credit

> **The first on-chain uncollateralized BNPL (Buy Now Pay Later) credit protocol for Africa.**

Built for the **Chainlink Convergence Hackathon 2026** | [Demo Video](#) | [Live App](https://uhuru-credit.vercel.app)

---

## The Problem

**1.2 billion Africans are locked out of traditional credit systems.**

- **57% of Sub-Saharan Africa is unbanked** (World Bank, 2024) — no credit bureau coverage, no FICO scores, no access to lending products
- Traditional credit scoring requires years of formal banking history that most Africans simply don't have
- Existing DeFi lending (Aave, Compound) requires 150%+ overcollateralization — impossible for the people who need credit most
- Mobile money (M-Pesa, MTN MoMo) processes **$800B+ annually** across Africa, but this rich financial data is invisible to lenders
- Africa's BNPL market is projected to reach **$14.2B by 2029**, but current solutions are centralized, opaque, and limited to specific merchants

**The result**: Hundreds of millions of financially active Africans with verifiable income and spending patterns cannot access even $100 of credit.

## The Solution

Uhuru Credit builds **portable, privacy-preserving credit identity** using African financial data — then enables **uncollateralized USDC lending** directly from DeFi liquidity pools.

### How It Works

```
1. VERIFY    User proves unique personhood via World ID (Sybil resistance)
                                    |
2. CONNECT   Links African bank (Mono.co) or M-Pesa (Reclaim zkTLS)
                                    |
3. SCORE     Chainlink CRE privately computes credit score inside TEE
             (raw financial data NEVER leaves the secure enclave)
                                    |
4. IDENTITY  Score stored as soulbound NFT (ERC-5192) — portable credit identity
                                    |
5. BORROW    Access uncollateralized USDC loans from DeFi tranche vaults
                                    |
6. REPAY     4 installments, building on-chain credit history
                                    |
7. GROW      Better score = higher limits = financial inclusion flywheel
```

### What Makes Uhuru Credit Different

| Feature | Traditional Lending | DeFi Lending (Aave) | Uhuru Credit |
|---------|-------------------|-------------------|-------------|
| Collateral Required | Credit history | 150%+ crypto | **None** |
| African Data Sources | Not supported | Not supported | **50+ banks, M-Pesa** |
| Privacy | Data sold to bureaus | Public on-chain | **TEE-encrypted** |
| Credit Portability | Locked to one country | Not applicable | **Cross-chain (CCIP)** |
| Minimum Loan | $500+ | $1000+ | **$50** |
| Identity | SSN/National ID | Wallet address | **World ID (Sybil-proof)** |

## Architecture

```
+------------------+     +------------------+     +------------------+
|  World Mini App  |     |   Backend API    |     | Chainlink CRE    |
|  (Next.js)       |---->|  (Express)       |---->| (WASM/TEE)       |
|  MiniKit UI      |     |  Mono + Reclaim  |     | Credit Scoring   |
+------------------+     +------------------+     +------------------+
                                                          |
                                                          v
+------------------+     +------------------+     +------------------+
| CreditIdentity   |     |   LoanManager    |     |  CREConsumer     |
| (ERC-721/5192)   |<----|  (BNPL Logic)    |<----| (Report Rx)      |
| Soulbound NFT    |     |  4 installments  |     +------------------+
+------------------+     +------------------+
        |                         |
        v                         v
+------------------+     +------------------+
| CCIPSync         |     | Senior/Junior    |
| (Cross-chain)    |     | Tranche Vaults   |
| Base <-> Arb     |     | (ERC-4626)       |
+------------------+     +------------------+
```

## Technology Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Smart Contracts | Solidity 0.8.24, Foundry, OpenZeppelin v5 | On-chain credit protocol |
| Credit Scoring | **Chainlink CRE** (Runtime Environment), `@chainlink/cre-sdk`, WASM/TEE | Privacy-preserving score computation |
| Cross-chain | **Chainlink CCIP** (Base <-> Arbitrum Sepolia) | Portable credit scores across chains |
| Open Banking | **Mono.co** (50+ Nigerian banks, Ghana, Kenya) | African banking data ingestion |
| Mobile Money | **Reclaim Protocol** zkTLS (M-Pesa) | Mobile money verification without raw data |
| Identity | **World ID** (Sybil resistance) | One human = one credit profile |
| DeFi Vaults | ERC-4626 senior/junior tranche architecture | Structured capital for lending |
| Distribution | **World Mini App** (MiniKit) | 10M+ World App users in Africa |
| Frontend | Next.js 16, Tailwind CSS | Responsive mobile-first UI |
| Backend | Express, TypeScript, ethers.js | API layer for data orchestration |

## Project Structure

```
uhurucredit/
├── src/                    # Solidity smart contracts (7 contracts)
├── test/                   # Foundry test suite (25 tests)
├── script/                 # Deployment scripts (Base + Arbitrum Sepolia)
├── uhuru-cre/              # Official CRE CLI project
│   ├── credit-scoring/     # Credit scoring workflow (main.ts)
│   ├── por/                # Proof of Reserve template
│   ├── nav/                # NAV publishing template
│   ├── project.yaml        # CRE project config
│   └── secrets.yaml        # Secret references
├── cre-workflow/           # Scoring algorithm + tests (11 tests)
│   └── src/
│       ├── scoring-algorithm.ts
│       ├── scoring-algorithm.test.ts
│       ├── credit-scoring.ts
│       └── simulate.ts
├── backend/                # Express API server (7 routes)
├── frontend/               # Next.js World Mini App (4 pages)
└── foundry.toml            # Foundry configuration
```

## Smart Contracts

| Contract | Description | Key Features |
|----------|-------------|-------------|
| `CreditIdentity.sol` | Soulbound credit NFT | ERC-721 + ERC-5192, non-transferable, stores credit data |
| `SeniorTranche.sol` | Senior lending vault | ERC-4626, 80% yield share, 5% target APY |
| `JuniorTranche.sol` | Junior lending vault | ERC-4626, first-loss buffer, variable APY |
| `LoanManager.sol` | BNPL loan engine | Apply, repay (4 installments), default handling |
| `CREConsumer.sol` | CRE report receiver | Chainlink Forwarder integration |
| `CCIPSync.sol` | Cross-chain sync | CCIP sender + receiver for score portability |
| `WorldIDGate.sol` | Identity gate | World ID verification before profile creation |

### Deployed Contracts

**Base Sepolia (Chain ID: 84532)**

| Contract | Address |
|----------|---------|
| CreditIdentity | [`0x02cB407dF115c7Bf287dEd05aab870485fC800aB`](https://sepolia.basescan.org/address/0x02cB407dF115c7Bf287dEd05aab870485fC800aB) |
| SeniorTranche | [`0xe468781867732309f62aCD0Fa6Fb00549Bf96299`](https://sepolia.basescan.org/address/0xe468781867732309f62aCD0Fa6Fb00549Bf96299) |
| JuniorTranche | [`0x280979E7890bB8DDCaD92eF68c87F98452E5C856`](https://sepolia.basescan.org/address/0x280979E7890bB8DDCaD92eF68c87F98452E5C856) |
| LoanManager | [`0xA29373f508CABcB647aC677C329f24a939b29776`](https://sepolia.basescan.org/address/0xA29373f508CABcB647aC677C329f24a939b29776) |
| CREConsumer | [`0xa49Ae8a172017B6394310522c673A38d3D64b0A7`](https://sepolia.basescan.org/address/0xa49Ae8a172017B6394310522c673A38d3D64b0A7) |
| CCIPSync | [`0x92e92bc8118aAE7704d1D0b05ec3d20b95F46ADe`](https://sepolia.basescan.org/address/0x92e92bc8118aAE7704d1D0b05ec3d20b95F46ADe) |
| WorldIDGate | [`0xe0af52d2056fd0D55f5F26275e6F3464582a37E9`](https://sepolia.basescan.org/address/0xe0af52d2056fd0D55f5F26275e6F3464582a37E9) |

**Arbitrum Sepolia (Chain ID: 421614)**

| Contract | Address |
|----------|---------|
| CreditIdentity | [`0xFA938c958ebED1E484f92dd013DDBDc782a2Cf3D`](https://sepolia.arbiscan.io/address/0xFA938c958ebED1E484f92dd013DDBDc782a2Cf3D) |
| CCIPSync | [`0x714532c747322448eABB75Cc956AD07DA08F7545`](https://sepolia.arbiscan.io/address/0x714532c747322448eABB75Cc956AD07DA08F7545) |

### Credit Tiers

| Score | Tier | Max Loan | Interest Rate | Target User |
|-------|------|----------|---------------|-------------|
| 850+ | PREMIUM | $5,000 USDC | 5% | Established professionals |
| 700-849 | PRIME | $2,000 USDC | 5% | Regular salary earners |
| 550-699 | STANDARD | $500 USDC | 8% | Gig workers, small traders |
| 400-549 | MICRO | $100 USDC | 12% | First-time borrowers |
| <400 | INELIGIBLE | $0 | N/A | Need more financial history |

## CRE (Chainlink Runtime Environment)

Uhuru Credit uses Chainlink's CRE to privately compute credit scores. CRE workflows run inside a Trusted Execution Environment (TEE):

1. **Financial data never leaves the TEE** — Raw bank transactions from Mono.co are fetched and processed entirely within the secure enclave
2. **Only the final score is published on-chain** — The CREConsumer contract receives `(wallet, score, worldIdVerified, reclaimVerified)` — zero raw financial data on-chain
3. **DON consensus** — Multiple Chainlink nodes independently compute the score and reach consensus before writing on-chain
4. **WASM sandbox** — Scoring algorithm compiles to WASM via Javy/QuickJS with strict sandboxing (100MB memory, 5-min timeout, no filesystem access)

### CRE Workflow Architecture

The credit scoring workflow is built with the official **CRE SDK** (`@chainlink/cre-sdk`) and runs as a WASM binary inside Chainlink's DON:

```
┌─────────────────────────────────────────────────────────────┐
│  CRE Trusted Execution Environment (TEE)                    │
│                                                             │
│  1. CronTrigger fires on schedule                           │
│              │                                              │
│              ▼                                              │
│  2. HTTPClient fetches Mono.co bank transactions            │
│     (DON consensus across multiple nodes)                   │
│              │                                              │
│              ▼                                              │
│  3. Scoring Algorithm computes score (0-1000)               │
│     • Balance health, tx frequency, income regularity       │
│     • World ID + Reclaim zkTLS identity bonuses             │
│     • Penalty deductions for risk factors                   │
│              │                                              │
│              ▼                                              │
│  4. ABI encode: (address, uint16, bool, bool)               │
│              │                                              │
│              ▼                                              │
│  5. EVMClient.writeReport() → CREConsumer contract          │
│     (signed by DON consensus, verified on-chain)            │
└─────────────────────────────────────────────────────────────┘
```

### CRE Simulation Output

```
✓ Workflow compiled
[USER LOG] Running Uhuru Credit scoring CronTrigger
[USER LOG] Starting Uhuru Credit scoring workflow - Mono API: https://api.withmono.com
[USER LOG] Credit score computed: {"score": 400, "worldIdVerified": true, "reclaimVerified": false}
[USER LOG] Writing credit score on-chain: wallet=0x...001, score=400
[USER LOG] Credit score written on-chain: txHash=0x000...000
✓ Workflow Simulation Result: "Score: 400"
```

### Scoring Algorithm (0-1000)

| Factor | Max Points | Description |
|--------|-----------|-------------|
| Base Score | 300 | Starting score for all users |
| Balance Health | 200 | avg balance / avg monthly income ratio |
| Transaction Frequency | 150 | Consistent banking activity (30+ tx/month = max) |
| Income Regularity | 200 | Based on credit transaction amounts (NGN thresholds) |
| World ID Verification | 100 | Sybil-proof unique human verification |
| Reclaim zkTLS | 100 | M-Pesa mobile money data verification |
| **Penalties** | | |
| Negative Balance Days | -100 max | -3 per day with negative balance |
| Existing Loans | -50 | Active outstanding debt |

## Revenue Model

Uhuru Credit generates revenue through multiple sustainable streams:

### 1. Interest Rate Spread (Primary)
- Borrowers pay 5-12% interest depending on credit tier
- Senior vault depositors earn 5% APY (fixed target)
- **Protocol captures the spread** between borrower rate and depositor yield
- At scale: 3-7% net interest margin on all outstanding loans

### 2. Origination Fees
- 0.5% fee on each loan origination (deducted from disbursement)
- At $10M monthly origination volume = $50K/month revenue

### 3. Credit Score API (B2B)
- License the CRE-powered credit scoring as an API to:
  - Other DeFi protocols seeking African credit data
  - Traditional fintechs expanding into African markets
  - Microfinance institutions upgrading their scoring models
- SaaS pricing: $0.10-$1.00 per credit check

### 4. Cross-chain Portability Premium
- CCIP-based credit score syncing charges a small fee per cross-chain sync
- As more chains integrate, this becomes a credit data highway

### Projected Unit Economics (at scale)

| Metric | Value |
|--------|-------|
| Average Loan Size | $300 USDC |
| Average Interest Rate | 8% |
| Default Rate (target) | <5% |
| Net Interest Margin | 3-5% |
| Cost per Credit Check | $0.02 (CRE gas) |
| LTV (Lifetime Value) per borrower | $45/year |

## Future Roadmap

### Phase 1: Foundation (Current - Q1 2026)
- [x] 7 smart contracts with full test suite (25 tests passing)
- [x] CRE credit scoring workflow with Mono.co integration
- [x] Official CRE CLI workflow simulation passing (Score: 400)
- [x] World Mini App frontend (4 pages) — deployed at https://uhuru-credit.vercel.app
- [x] World ID device-level verification integrated and tested
- [x] Backend API with Reclaim Protocol M-Pesa verification
- [x] CCIP cross-chain score sync (Base <-> Arbitrum)
- [ ] Mainnet deployment on Base

### Phase 2: Growth (Q2 2026)
- [ ] Launch on Base mainnet with real USDC liquidity
- [ ] Integrate additional African data sources (MTN MoMo, Flutterwave, Paystack)
- [ ] Add Ghana and Kenya bank coverage via Mono.co expansion
- [ ] Launch credit score API for B2B partners
- [ ] Implement dynamic interest rates based on pool utilization

### Phase 3: Scale (Q3-Q4 2026)
- [ ] Expand to 10+ African countries
- [ ] Multi-chain deployment (Arbitrum, Polygon, Optimism)
- [ ] Merchant BNPL integration (pay-in-4 at African e-commerce checkout)
- [ ] Credit limit auto-increase based on repayment history
- [ ] Governance token launch for protocol decentralization

### Phase 4: Pan-African Credit Layer (2027+)
- [ ] Become the standard credit scoring layer for African DeFi
- [ ] Cross-protocol credit portability (use Uhuru score on any DeFi platform)
- [ ] Traditional finance partnerships (banks, MFIs using on-chain credit data)
- [ ] Savings products and credit builder tools
- [ ] Insurance integration for loan default protection

## Live Demo

| Resource | URL |
|----------|-----|
| **Live App (Vercel)** | https://uhuru-credit.vercel.app |
| **World App Mini App ID** | `app_364ae6dd4b355aa0e8fcbaf1ede63d04` |
| **Base Sepolia Explorer** | https://sepolia.basescan.org |
| **Arbitrum Sepolia Explorer** | https://sepolia.arbiscan.io |

### End-to-End Testing Guide

**Prerequisites:** World App installed on your phone (iOS/Android)

#### Step 1 — Open in World App
1. Go to **[developer.worldcoin.org](https://developer.worldcoin.org)** → your app → Mini App → Basic
2. Set App URL to `https://uhuru-credit.vercel.app` and save
3. Scan the **Developer Preview QR code** with World App on your phone
4. The Uhuru Credit home screen appears inside World App

**Expected:** Dark home screen with "Uhuru Credit", 3 feature cards, and "Verify with World ID" button

#### Step 2 — Verify Identity
1. Tap **"Verify with World ID"**
2. World App shows a verification prompt — confirm it
3. App calls backend, records World ID verification
4. Redirected to **Dashboard**

**Expected:** Dashboard loads with your wallet address, score card showing 0, and "World ID" verified badge

#### Step 3 — Request Credit Evaluation
1. On Dashboard, tap **"Request Credit Evaluation"**
2. Button subtitle changes to **"Submitted — score updates in ~60s"** with a green ✓
3. The backend triggers Chainlink CRE scoring workflow
4. After ~60s, score refreshes (base score ~400 for World ID verified users)

**Expected:** Score card animates to 400+, tier shows "MICRO" or higher, Apply button unlocks

#### Step 4 — Apply for a Loan
1. Tap **"Apply for a Loan →"** on the dashboard (unlocked once score ≥ 400)
2. Adjust loan amount with the slider ($50–$100 for MICRO tier)
3. Select repayment term (2, 4, or 8 weeks)
4. Review the loan summary (APR, total repayment, installment amount)
5. Tap **"Confirm — $XX USDC"**
6. World App shows transaction confirmation — approve it

**Expected:** Transaction signed via MiniKit, redirected to Repay page showing active loan

#### Step 5 — Repay an Installment
1. On Repay page, see loan details: borrowed, total due, progress timeline
2. Countdown shows days until next payment
3. Tap **"Pay $X.XX USDC"**
4. World App prompts USDC approval + repayment transaction — approve both
5. Page refreshes showing 1/4 installments paid, progress bar advances

**Expected:** Green progress bar fills 25%, installment marked ✓ in timeline

#### Step 6 — Check Score Improvement
1. After full repayment, navigate to **Dashboard**
2. Request another Credit Evaluation
3. Score increases due to repayment history

**Expected:** Score increases by ~50-100 points, tier may upgrade

---

### Browser-Only Testing (No World App)
Open https://uhuru-credit.vercel.app in any browser:
- Connect a MetaMask/browser wallet
- Dashboard shows read-only credit profile
- Apply/Repay require World App (transactions are gas-free via MiniKit)

---

## Local Setup

### Prerequisites

- [Foundry](https://book.getfoundry.sh/getting-started/installation)
- [Node.js](https://nodejs.org/) v18+
- [Bun](https://bun.sh/) v1.0+
- [CRE CLI](https://docs.chain.link/cre) v1.2.0+

### Smart Contracts

```bash
# Build
forge build

# Run tests (25 tests)
forge test -vvv

# Format check
forge fmt --check

# Deploy to Base Sepolia
forge script script/Deploy.s.sol --rpc-url https://sepolia.base.org --broadcast

# Deploy to Arbitrum Sepolia
forge script script/DeployArbitrum.s.sol --rpc-url https://sepolia-rollup.arbitrum.io/rpc --broadcast
```

### CRE Workflow (Official CLI)

```bash
# Install CRE CLI
curl -sSL https://cre.chain.link/install.sh | bash

# Authenticate
cre login

# Navigate to project
cd uhuru-cre

# Install dependencies
bun install --cwd ./credit-scoring

# Simulate the credit scoring workflow
cre workflow simulate credit-scoring
```

### CRE Scoring Tests

```bash
cd cre-workflow
bun install
bun test        # Run scoring algorithm tests (11 tests)
bun run build   # Build WASM bundle
```

### Backend

```bash
cd backend
npm install
cp .env.example .env  # Fill in API keys
npm run dev           # Starts on port 3001
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env.local  # Fill in contract addresses
npm run dev                  # Starts on port 3000
```

## Test Results

```
Smart Contracts (Foundry):   25/25 passing
CRE Scoring Algorithm:       11/11 passing
CRE Workflow Simulation:     ✓ Compiled & Simulated (Score: 400)
CI Pipeline:                 All checks passing
```

## Hackathon Tracks

- **DeFi & Tokenization**: ERC-4626 tranche vaults, uncollateralized lending, on-chain credit identity
- **World Mini App**: Full World App integration with MiniKit, World ID verification

## Team

Built by Uhuru Credit team for the Chainlink Convergence Hackathon 2026.

## License

MIT
