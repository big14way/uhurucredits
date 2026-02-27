# Uhuru Credit

> **The first on-chain uncollateralized BNPL (Buy Now Pay Later) credit protocol for Africa.**

Built for the **Chainlink Convergence Hackathon 2026** | [Demo Video](#) | [Live App](#)

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
| Credit Scoring | **Chainlink CRE** (Runtime Environment), WASM/TEE | Privacy-preserving score computation |
| Cross-chain | **Chainlink CCIP** (Base <-> Arbitrum Sepolia) | Portable credit scores across chains |
| Open Banking | **Mono.co** (50+ Nigerian banks, Ghana, Kenya) | African banking data ingestion |
| Mobile Money | **Reclaim Protocol** zkTLS (M-Pesa) | Mobile money verification without raw data |
| Identity | **World ID** (Sybil resistance) | One human = one credit profile |
| DeFi Vaults | ERC-4626 senior/junior tranche architecture | Structured capital for lending |
| Distribution | **World Mini App** (MiniKit) | 10M+ World App users in Africa |
| Frontend | Next.js 16, Tailwind CSS | Responsive mobile-first UI |
| Backend | Express, TypeScript, ethers.js | API layer for data orchestration |

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

### Networks

- **Primary**: Base Sepolia (Chain ID: 84532)
- **Secondary**: Arbitrum Sepolia (Chain ID: 421614)

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

### Scoring Algorithm (0-1000)

| Factor | Max Points | Description |
|--------|-----------|-------------|
| Balance Health | 200 | avg balance / avg monthly income ratio |
| Transaction Frequency | 150 | Consistent banking activity (30+ tx/month = max) |
| Income Regularity | 200 | Based on credit transaction amounts (NGN thresholds) |
| World ID Verification | 100 | Sybil-proof unique human verification |
| Reclaim zkTLS | 100 | M-Pesa mobile money data verification |
| Base Score | 300 | Starting score for all users |
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
- [x] World Mini App frontend (4 pages)
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

## Local Setup

### Prerequisites

- [Foundry](https://book.getfoundry.sh/getting-started/installation)
- [Node.js](https://nodejs.org/) v18+
- [Bun](https://bun.sh/) v1.0+

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

### CRE Workflow

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
Smart Contracts (Foundry): 25/25 passing
CRE Scoring Algorithm:     11/11 passing
CI Pipeline:               All checks passing
```

## Hackathon Tracks

- **DeFi & Tokenization**: ERC-4626 tranche vaults, uncollateralized lending, on-chain credit identity
- **World Mini App**: Full World App integration with MiniKit, World ID verification

## Team

Built by Uhuru Credit team for the Chainlink Convergence Hackathon 2026.

## License

MIT
