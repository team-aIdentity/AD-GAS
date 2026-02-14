# Integration Plan — Type 1+2 Combined + Free Swap Pool

> **Definition**: A unified platform combining ad-view gas sponsorship (Type 1), point accrual/payment (Type 2), and a self-operated LP-based free swap pool.

---

## 1. Product Overview

### 1.1 One-Line Summary
Users earn points by watching ads and can choose either "pay gas with points" or "watch ad for instant free tx" at transaction time. In addition, the platform operates its own LP (liquidity pool) so swaps can be executed without gas fees.

### 1.2 Core Feature Matrix

| Feature | Type 1 | Type 2 | Integrated |
|---------|--------|--------|------------|
| **Ad view** | ✅ | ✅ | ✅ (shared) |
| **Instant free transaction** | ✅ | ❌ | ✅ (optional) |
| **Point accrual** | ❌ | ✅ | ✅ (optional) |
| **Pay gas with points** | ❌ | ✅ | ✅ (optional) |
| **Free swap pool** | ❌ | ❌ | ✅ (new) |

### 1.3 Target Users
- **Primary**: dApp/app developers — "watch ad for free send" + "point accrual" + "free swap" in one place
- **Secondary**: End users — send, swap, mint NFTs, etc. without paying gas
- **Tertiary**: Liquidity providers — supply LP to the swap pool and earn fees
- **Quaternary**: Wallet/app developers — teams that want to add **"ad reward → gas payment"** to their wallet or app  
  → Support both **SDK/API** and **smart-contract-only** integration (third-party wallets can integrate by calling our Points and Paymaster contracts only)

---

## 2. Integrated User Flows

### 2.1 Flows (3 Options)

#### Option A: Type 1 (Instant free)
1. User clicks "Send for free"
2. **Watch ad** (interstitial/rewarded)
3. Ad completion verified
4. **Transaction executed immediately** (gas paid by Paymaster)
5. Done

#### Option B: Type 2 (Point accrual / payment)
1. User clicks "Watch ad"
2. **Ad view** completed
3. **Points accrued** (after backend verification)
4. At transaction time, user selects **"Pay with points"**
5. Points deducted + transaction executed (gas paid by Paymaster)

#### Option C: Free swap (new)
1. User clicks "Free swap"
2. **Ad view** completed
3. Token exchange via swap pool (gas paid by Paymaster)
4. Swap fee (0.3%) is deducted from LP or offset by ad revenue

### 2.2 Integrated UI/UX
- **Main screen**: Tabs for "Instant free send" / "Earn points" / "Free swap"
- **Point balance**: Shown at top when using Type 2
- **Gas payment choice**: At transaction time — "Native gas" / "Pay with points" / "Watch ad for free"

---

## 3. Free Swap Pool Design

### 3.1 Architecture

```
┌─────────────────────────────────────────┐
│         User (ad view)                   │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│    AdWallet Swap Pool Contract          │
│  ┌──────────────────────────────────┐  │
│  │  LP Pool (AVAX + token)            │  │
│  │  - LPs deposit                     │  │
│  │  - Swap fee revenue to LPs         │  │
│  └──────────────────────────────────┘  │
│  ┌──────────────────────────────────┐  │
│  │  Swap Logic (Uniswap V2 style)   │  │
│  │  - x * y = k (constant product)   │  │
│  │  - Gas paid by Paymaster          │  │
│  └──────────────────────────────────┘  │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│      Paymaster (gas sponsorship)        │
└─────────────────────────────────────────┘
```

### 3.2 Swap Pool Contract Features

#### Core
- **LP deposit/withdraw**: LPs deposit AVAX + token pair and receive LP tokens
- **Swap**: User exchanges token A → token B (gas-free)
- **Fee**: 0.3% swap fee → distributed to LPs
- **Gas sponsorship**: Swap transaction gas paid by Paymaster

#### Ad integration
- **Ad completion verification** before swap (Type 1), or **point deduction** (Type 2)
- Swap executes after verification

### 3.3 LP Revenue Model
- **LPs**: Earn 0.3% swap fees
- **Platform**: Offset gas with ad revenue
- **Users**: Swap without paying gas

---

## 4. Technical Spec

### 4.1 Smart Contracts

#### 4.1.1 AdWalletSwapPool.sol (new)
```solidity
contract AdWalletSwapPool {
    // LP token accounting
    mapping(address => uint256) public liquidity;
    
    // Token pair (AVAX + ERC20)
    address public tokenA; // AVAX (native)
    address public tokenB; // ERC20 token
    
    // Swap (gas-free)
    function swap(
        address tokenIn,
        address tokenOut,
        uint256 amountIn,
        uint256 minAmountOut,
        bytes calldata adProof // ad view proof
    ) external;
    
    // LP deposit
    function addLiquidity(
        uint256 amountAVAX,
        uint256 amountToken
    ) external payable returns (uint256 lpTokens);
    
    // LP withdraw
    function removeLiquidity(uint256 lpTokens) external;
}
```

#### 4.1.2 Existing contract extension
- **AdSponsorPaymaster**: Support gas sponsorship for swap transactions
- **Points contract** (Type 2): Option to deduct points for swap

#### 4.1.3 Wallet/app developer contract integration (Type 2)

So that wallet/app developers can attach "ad reward → gas payment" **without SDK**, by calling only our smart contracts, we provide the following.

##### Points management contract (on-chain)

```solidity
/// @title Interface for wallet/app to query and deduct points
interface IAdWalletPoints {
    /// @notice Point balance per wallet address
    function balanceOf(address account) external view returns (uint256);
    
    /// @notice Accrue points (only ad verification server or authorized Relayer)
    function mint(address to, uint256 amount, bytes calldata proof) external;
    
    /// @notice Deduct points (called by Paymaster or authorized module when sponsoring gas)
    function burn(address from, uint256 amount) external;
    
    /// @notice Pay gas with points: deduct on behalf of user and return true (called by Paymaster/Executor)
    function spendForGas(address user, uint256 pointCost) external returns (bool);
    
    /// @notice Points ↔ gas conversion (e.g. 1 point = N wei)
    function pointsToWei(uint256 points) external view returns (uint256);
}
```

##### Paymaster integration (when paying with points)

- Before executing UserOperation, Paymaster calls `IAdWalletPoints.spendForGas(sender, requiredPoints)` to deduct points
- Gas is sponsored only if deduction succeeds
- Wallet/app shows balance via `balanceOf(user)`; for "pay with points" they only need to build a UserOperation that uses our Paymaster + Points contract

##### Wallet/app integration scenario (contract-only)

| Step | Actor | Action |
|------|--------|--------|
| 1 | Wallet/app | Call `IAdWalletPoints.balanceOf(user)` → show point balance |
| 2 | User | Select "Pay gas with points" and sign transaction |
| 3 | Wallet/app | Submit UserOperation with Paymaster address + Points contract address |
| 4 | Paymaster | Call `IAdWalletPoints.spendForGas(user, cost)` → deduct points then sponsor gas |

(Point accrual is done by backend/Relayer calling `mint(to, amount, proof)` after ad verification.)

##### Deployment and integration info to provide

- **AdWalletPoints** contract address (per chain)
- **AdSponsorPaymaster** address (per chain)
- **EntryPoint** address
- Interface ABI and integration guide

This allows third-party wallets/apps to add "ad reward → gas payment" **without their own backend**, by calling only our deployed contracts.

### 4.2 SDK Extension

#### 4.2.1 New APIs
```typescript
// Free swap
async swapGasless(
  tokenIn: string,
  tokenOut: string,
  amountIn: string,
  minAmountOut: string,
  paymentMethod: 'ad' | 'points' // ad or points
): Promise<string>

// LP deposit
async addLiquidity(
  amountAVAX: string,
  amountToken: string,
  tokenAddress: string
): Promise<string>

// LP withdraw
async removeLiquidity(lpTokens: string): Promise<string>

// Pool info
async getPoolInfo(): Promise<{
  reserveAVAX: string,
  reserveToken: string,
  totalLPTokens: string,
  swapFee: number
}>
```

### 4.3 Backend / infrastructure
- **Points server** (Type 2): Point accrual/deduction API
- **Ad verification server**: Ad view completion verification
- **Monitoring**: LP balance, swap volume, fee revenue

---

## 5. Integrated Scope

### 5.1 In scope

#### Type 1
- ✅ Instant free transaction after ad view
- ✅ Paymaster gas sponsorship
- ✅ Gas limits and whitelist management

#### Type 2
- ✅ Point accrual (on ad view)
- ✅ Pay gas with points
- ✅ Point balance/history
- ✅ **Wallet/app developer contract integration** — attach "ad reward → gas payment" by calling **only** Points and Paymaster contracts (no SDK required)

#### Swap pool (new)
- ✅ Self-operated LP pool
- ✅ Free swap (gas sponsored)
- ✅ LP deposit/withdraw
- ✅ Swap fee distribution

### 5.2 Out of scope
- Point tokenization (later phase)
- Advanced AMM (concentrated liquidity, oracles, etc.)
- Cross-chain swap (later phase)

---

## 6. User Scenarios (Integrated)

### 6.1 Scenario 1: Instant free send (Type 1)
```
User → Click "Send for free"
     → Watch ad (30s)
     → Ad completion verified
     → Transaction executed (no gas)
     → Done
```

### 6.2 Scenario 2: Earn points then use (Type 2)
```
User → Click "Watch ad" (multiple times)
     → Points accrued (e.g. 100 pts per ad)
     → Balance: 500 pts
     → Click "Send token"
     → Select "Pay with points"
     → 200 pts deducted
     → Transaction executed (no gas)
     → Balance: 300 pts
```

### 6.3 Scenario 3: Free swap (new)
```
User → Click "Free swap"
     → Select AVAX → USDC
     → Watch ad (30s)
     → Ad completion verified
     → Swap executed (no gas)
     → 0.3% fee from LP
     → Done
```

### 6.4 Scenario 4: LP provider
```
LP → Click "Provide liquidity"
   → Deposit 1 AVAX + 1000 USDC
   → Receive LP tokens
   → Earn fee when others swap
   → Can withdraw LP anytime
```

---

## 7. Business Model

### 7.1 Revenue

| Source | Description | Recipient |
|--------|-------------|-----------|
| **Ad revenue** | CPM/CPA per ad view | Platform |
| **Swap fee** | 0.3% per swap | LPs (and/or platform) |
| **Gas margin** | Ad revenue > gas cost | Platform |

### 7.2 Costs

| Item | Description | Bearer |
|------|-------------|--------|
| **Gas sponsorship** | Gas for all sponsored tx | Platform (Paymaster) |
| **Infrastructure** | Servers, RPC, Bundler | Platform |
| **LP operations** | Initial liquidity (optional) | Platform or community |

---

## 8. Development Roadmap

### Phase 1: Type 1+2 integration (1–2 months)
- [ ] **Points contract** (`AdWalletPoints.sol` / `IAdWalletPoints`) — balance, mint, burn, `spendForGas`
- [ ] Paymaster ↔ points (deduct points then sponsor gas)
- [ ] Points backend (ad verification → `mint` call)
- [ ] UI: "Instant free" / "Earn points" selectable
- [ ] **Wallet/app integration**: Publish contract addresses, ABI, integration guide (contract-only "ad reward → gas payment")

### Phase 2: Swap pool MVP (2–3 months)
- [ ] AdWalletSwapPool contract
- [ ] LP deposit/withdraw
- [ ] Basic swap (x * y = k)
- [ ] Paymaster integration for swap

### Phase 3: Integration and optimization (3–4 months)
- [ ] Ad view → swap flow
- [ ] Pay swap gas with points
- [ ] LP dashboard (revenue, balance)
- [ ] Security audit

---

## 9. Tech Stack (Additional)

### 9.1 Swap pool contract
- **AMM**: Uniswap V2 style (x * y = k)
- **Fee**: 0.3% to LPs
- **Gas**: Minimize gas for swap

### 9.2 Frontend
- **Swap UI**: Token select, amount, preview
- **LP UI**: Deposit/withdraw, revenue
- **Unified dashboard**: Point balance + swap + send

---

## 10. Success Metrics (KPI)

### 10.1 Product
- **Swap success rate** > 99%
- **Average swap time** < 5s
- **TVL** target
- **Daily swap volume**

### 10.2 Business
- **Ad revenue vs gas cost** (profitability)
- **Number of LPs**
- **Point accrual → usage conversion**

---

## 11. Risks & Mitigation

| Risk | Mitigation |
|------|------------|
| **Insufficient LP, no swap** | Bootstrap liquidity, LP incentive program |
| **Price manipulation (swap pool)** | Min liquidity, price oracle (later) |
| **Gas spikes** | Dynamic limits, ad pricing adjustment |
| **Point abuse** | Daily accrual/spend limits |

---

## 12. Next Steps

1. Detail **swap pool contract** design
2. Decide **LP token** standard (ERC-20 based)
3. Define **initial liquidity** strategy
4. Plan **security audit**

This document defines the plan for **Type 1+2 integration + free swap pool**.
