# Integration Development Plan — Type 1+2 Combined + Free Swap Pool

> **Technical definition**: Single platform implementing ad-view gas sponsorship (Type 1), point accrual/payment (Type 2), and self-operated LP swap pool. Wallet/app developers can integrate "ad reward → gas payment" via SDK or **smart contracts only**.

**Related docs**: [통합_기획서.md](./통합_기획서.md) · [BUSINESS_MODEL.md](./BUSINESS_MODEL.md)

---

## 1. Architecture Overview

### 1.1 Current Implementation Baseline

| Area | Current | Integrated extension |
|------|---------|----------------------|
| **Type 1 (instant free)** | `AdSponsorPaymaster.sol`, `AdWalletSponsoredTransfer.sol`, `GaslessSDK` + `Form1TransferUI` | Keep and reuse |
| **Type 2 (points)** | None | `AdWalletPoints.sol` + backend/Relayer |
| **Swap pool** | None | `AdWalletSwapPool.sol` |
| **Wallet/app integration** | SDK (Biconomy MEE) | **Contract interface** (`IAdWalletPoints`) for SDK-free integration |

### 1.2 System Diagram

```
[User / dApp / Wallet app]
         │
         ├── Option A: Type 1 ──→ [Ad view] → [GaslessSDK] → [Bundler/EntryPoint] → [Paymaster] → gas sponsored
         │
         ├── Option B: Type 2 ──→ [Ad view] → [Points: AdWalletPoints.mint]
         │                       [On tx] → [Deduct: spendForGas] → [Paymaster] → gas sponsored
         │
         ├── Option C: Swap ──→ [Ad view] → [AdWalletSwapPool.swap] (gas Paymaster)
         │
         └── Wallet/app dev ──→ [IAdWalletPoints.balanceOf / spendForGas] + [Paymaster] (contract-only)
```

### 1.3 Tech Stack (Integrated)

| Area | Tech |
|------|------|
| Smart contracts | Solidity ^0.8.20, OpenZeppelin, Hardhat (existing) + AdWalletPoints, AdWalletSwapPool |
| Type 1 | EIP-4337 Paymaster (`AdSponsorPaymaster`), meta-tx (`AdWalletSponsoredTransfer`) |
| SDK | TypeScript, Viem, Biconomy AbstractJS (existing `GaslessSDK`) |
| Frontend | Next.js, wagmi, extend `Form1TransferUI` · `AdminDepositPage` |
| Infrastructure | RPC, Bundler (or MEE), ad verification server, points backend (optional) |

---

## 1.4 Tech Stack, Architecture Design Decisions, and Implementation Approach

### Tech Stack

| Layer | Tech | Purpose |
|-------|------|---------|
| **Smart contracts** | Solidity ^0.8.20, OpenZeppelin, Hardhat | Paymaster, sponsored transfer, points & swap pool contracts |
| **Account abstraction** | EIP-4337 (EntryPoint, UserOperation, Paymaster) | Standard interface for gas sponsorship and point-based payment |
| **Signing & transactions** | EIP-712, Viem | Meta-tx signature verification and chain calls |
| **SDK** | TypeScript, Viem, (Biconomy AbstractJS / self-hosted Relayer) | Gasless, points, and swap calls from wallet/dApp |
| **Frontend** | Next.js 15, React 19, wagmi, Tailwind CSS | Web demo, admin, points/swap UI |
| **Mobile app** | Capacitor 6, WebView + ad-gas.vercel.app | Android/iOS native shell, AdMob integration |
| **Wallet integration** | WalletConnect, MetaMask, Rainbow Wallet | Multi-wallet and mobile support. Permit (gasless approve) requires eth_signTypedData_v4 support (e.g. MetaMask, Rainbow) |
| **Infrastructure** | Public RPC, Relayer server, (optional) Bundler/MEE | Tx relay, ad verification, point mint |

### Architecture Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Gas sponsorship** | EIP-4337 Paymaster + meta-tx (signature verification) | Standardized account abstraction for multi-chain and multi-wallet; Type 1 implementable immediately via signature-based Relayer |
| **Type 1 vs Type 2** | Both Type 1 (instant free) and Type 2 (points) | Broader user choice; wallets/apps only need points balance and spendForGas |
| **Wallet/app integration** | Publish contract interfaces (e.g. IAdWalletPoints), SDK optional | Minimize SDK dependency; balance and payment via contract address and ABI only |
| **Ad verification** | Off-chain verification then signature/proof → Relayer or contract | No ad logic on-chain; only verified result passed as proof for security and flexibility |
| **Swap pool** | Uniswap V2–style AMM, Paymaster sponsors swap gas | Simpler x*y=k model for audit and ops; extend existing Paymaster policy only |
| **Frontend vs app** | Single web (Next.js) deploy + Capacitor WebView app | One codebase for web and app; app handles native shell (AdMob, stores) only |

### Implementation Approach

- **Phase 1**: Keep Type 1; add AdWalletPoints and Paymaster integration; publish wallet/app integration docs and ABI → Validate points accrual/payment and “contract-only” integration.
- **Phase 2**: AdWalletSwapPool MVP; Paymaster sponsors swap gas; SDK and frontend swap/LP UI → Validate free swap and liquidity pool.
- **Phase 3**: Ad→swap/points flows, LP dashboard, security and performance hardening → Scale to full integrated platform.
- **Code and docs**: Keep existing Type 1 contracts, SDK, and UI; add new (Points, SwapPool) as separate modules and scripts for incremental integration.

---

## 1.5 Architecture Design Overview

### Layer Structure

```
┌─────────────────────────────────────────────────────────────────────────┐
│  User / dApp / Wallet app (Next.js web, Capacitor app, external wallets) │
└─────────────────────────────────────────────────────────────────────────┘
                                      │
                    ┌─────────────────┼─────────────────┐
                    ▼                 ▼                 ▼
            ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
            │  wagmi/      │  │  GaslessSDK  │  │ IAdWallet*   │
            │  wallet      │  │  (Type 1/2/  │  │ (balanceOf,  │
            │  connect &  │  │  swap API)   │  │  spendForGas)│
            │  sign        │  │              │  │              │
            └──────┬───────┘  └──────┬───────┘  └──────┬───────┘
                   │                │                 │
                   └────────────────┼─────────────────┘
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  Off-chain: Relayer / Ad verification / (optional) Bundler·MEE            │
│  - Ad view verification → issue proof → mint / sponsor tx relay         │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  On-chain (EVM-compatible)                                                │
│  ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐        │
│  │ AdSponsor        │ │ AdWallet         │ │ AdWalletPoints    │        │
│  │ Paymaster        │ │ SponsoredTransfer│ │ (Type 2)          │        │
│  └──────────────────┘ └──────────────────┘ └──────────────────┘        │
│  ┌──────────────────┐ ┌──────────────────┐                              │
│  │ AdWalletSwapPool │ │ EntryPoint       │                              │
│  │ (free swap)      │ │ (EIP-4337)       │                              │
│  └──────────────────┘ └──────────────────┘                              │
└─────────────────────────────────────────────────────────────────────────┘
```

### Component Roles

| Component | Role |
|-----------|------|
| **Client (web/app)** | Wallet connect, sign requests, points/swap UI, ad view trigger |
| **SDK** | Type 1 meta-tx; (Type 2) points query and payment; (Phase 2) swap/LP call wrappers |
| **Relayer / ad verification** | Ad view verification, proof issuance, mint/sponsor tx submission |
| **Paymaster** | UserOperation validation and gas sponsorship; calls spendForGas when needed |
| **AdWalletSponsoredTransfer** | EIP-712 verification then native/ERC20 transfer (Type 1) |
| **AdWalletPoints** | Points balance, mint, spendForGas (Type 2 and wallet integration) |
| **AdWalletSwapPool** | Liquidity and swap (Phase 2); gas sponsored by Paymaster |

### Data Flow Summary

- **Type 1 (instant free)**: User signs → Relayer calls AdWalletSponsoredTransfer → Paymaster pays gas for that tx.
- **Type 2 (points)**: Ad view → verify and proof → Relayer mints → On user tx, Paymaster (or Executor) calls spendForGas then sponsors gas.
- **Swap**: Add/remove liquidity or call swap with adProof (or points) → Paymaster sponsors swap tx gas.
- **Wallet/app integration**: balanceOf query + UserOperation submission with Paymaster calling spendForGas → integration via contracts only.

---

## 2. Smart Contract Spec

### 2.1 Existing Contracts (Reference)

#### AdSponsorPaymaster (`contracts/contracts/AdSponsorPaymaster.sol`)
- **Role**: EIP-4337 Paymaster; per-call and daily gas limits, whitelist, emergency pause
- **Integration**: Deposit with EntryPoint; `validatePaymasterUserOp` / `postOp`
- **Integration phase**: Extend policy so swap and point-payment txs can also be sponsored by same Paymaster

#### AdWalletSponsoredTransfer (`contracts/contracts/AdWalletSponsoredTransfer.sol`)
- **Role**: Verify user signature (EIP-712) then native/ERC20 transfer; sponsor pays gas
- **Admin**: `admin`, `depositNative` / `withdrawNative`, `getNativeDepositPool`
- **Integration phase**: Keep Type 1 “instant free transfer”; frontend remains Form1TransferUI etc.

### 2.2 New: AdWalletPoints (Type 2 + wallet/app integration)

#### Interface (for wallet/app contract-only integration)

```solidity
// Same as docs/통합_기획서.md 4.1.3
interface IAdWalletPoints {
    function balanceOf(address account) external view returns (uint256);
    function mint(address to, uint256 amount, bytes calldata proof) external;
    function burn(address from, uint256 amount) external;
    function spendForGas(address user, uint256 pointCost) external returns (bool);
    function pointsToWei(uint256 points) external view returns (uint256);
}
```

#### Implementation requirements
- **Storage**: `mapping(address => uint256) public balanceOf;`
- **mint**: `onlyRole(MINTER)` or authorized Relayer; verify ad view via `proof` (off-chain verification then signature etc.)
- **burn / spendForGas**: Only Paymaster or authorized Executor; deduct points before sponsoring gas
- **pointsToWei**: Admin-configurable or fixed rate (e.g. 1 point = 1e12 wei)
- **Events**: `Transfer` (accrual/deduction), `SpendForGas(user, amount)`

#### Deployment and integration
- Publish **contract address + ABI** per chain after deployment
- Wallets/apps show balance via `balanceOf(user)`; Paymaster calls `spendForGas` on UserOperation

### 2.3 New: AdWalletSwapPool (free swap)

#### Core functions
- `addLiquidity(uint256 amountAVAX, uint256 amountToken) external payable returns (uint256 lpTokens)`
- `removeLiquidity(uint256 lpTokens) external`
- `swap(address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut, bytes calldata adProof) external`
- `getReserves() external view returns (uint256 reserve0, uint256 reserve1)`

#### Rules
- AMM: Uniswap V2–style `x * y = k`; 0.3% fee → LP or distribution
- Swap gas sponsored by Paymaster (same-chain AdSponsorPaymaster or dedicated Paymaster)
- `adProof`: Ad view completion proof (Type 1) or point deduction handled by Paymaster/external before call

#### Security
- ReentrancyGuard; optional daily swap limit; minimum liquidity checks

### 2.4 Paymaster Extension (integrated)

- **Type 1**: Unchanged UserOperation gas sponsorship
- **Type 2**: In `validatePaymasterUserOp` (or separate Executor) call `IAdWalletPoints(spendForGas).spendForGas(sender, cost)` then proceed
- **Swap**: Same Paymaster sponsors gas for swap pool call tx

---

## 3. SDK Extension (Current Code Baseline)

### 3.1 Existing GaslessSDK (`src/core/GaslessSDK.ts`)

- **Implemented**: `setAdTrigger`, `getAdTrigger`, `sendGaslessTransaction` (beforeTransaction → ad view → tx)
- **Config**: `SdkConfig` — `publicClient`, `walletClient`, `apiKey` (Biconomy)
- **Integration**: Keep Type 1 as-is; add Type 2 methods e.g. `getPointsBalance(address?)`, `sendTransactionWithPoints(tx)` as new methods

### 3.2 Target APIs for Integration

| API | Description |
|-----|-------------|
| `getPointsBalance(account?)` | Query `IAdWalletPoints.balanceOf(account ?? wallet)` |
| `sendTransactionWithPoints(tx)` | Deduct points + submit UserOperation (Paymaster calls spendForGas) |
| `swapGasless(tokenIn, tokenOut, amountIn, minOut, paymentMethod)` | Call swap pool; paymentMethod: 'ad' \| 'points' |
| `addLiquidity(amountAVAX, amountToken, tokenAddress)` | Add LP |
| `removeLiquidity(lpTokens)` | Withdraw LP |
| `getPoolInfo(poolAddress?)` | Swap pool reserves, fees, etc. |

### 3.3 Ad Trigger (unchanged)

- `AdTrigger.beforeTransaction`: Used for Type 1 and swap (ad payment)
- Type 2 point accrual: App “Watch ad” → ad view → backend/Relayer calls `mint`

---

## 4. Frontend (Current Code Baseline)

### 4.1 Existing Implementation

- **Form1TransferUI** (`frontend/src/components/Form1TransferUI.tsx`): Type 1 “watch ad, send free”; AdTrigger integration
- **AdminDepositPage** (`frontend/src/components/admin/AdminDepositPage.tsx`): Admin deposit/withdraw; `AdWalletSponsoredTransfer` integration
- **wagmi**: `wagmi.config.ts`, `useAccount`, `useConnect`, etc.

### 4.2 UI Extension for Integration

- **Tabs or menu**: “Instant free send” (Type 1) / “Earn points” / “Pay with points” / “Free swap”
- **Points balance**: Show `IAdWalletPoints.balanceOf(address)` in header or sidebar
- **Swap UI**: Token select, amount input, “Watch ad to swap” or “Swap with points”
- **LP UI**: Add/remove liquidity, LP balance and yield (Phase 2)

### 4.3 Environment Variables (Additional)

```env
# Existing
NEXT_PUBLIC_ADWALLET_CONTRACT_ADDR_AVALANCHE=
NEXT_PUBLIC_BICONOMY_API_KEY=

# Integration
NEXT_PUBLIC_ADWALLET_POINTS_ADDRESS=
NEXT_PUBLIC_ADWALLET_SWAP_POOL_ADDRESS=
```

---

## 5. Backend / Infrastructure

### 5.1 Ad Verification

- Type 1: As today, client or backend verifies “ad view complete” then proceeds
- Type 2: On ad view complete **accrue points** — backend verifies then Relayer calls `AdWalletPoints.mint(user, amount, proof)`

### 5.2 Point Accrual Flow

1. Client: Ad SDK callback (view complete) → send (userAddress, adId, timestamp, etc.) to backend
2. Backend: Verify; issue one-time token/signature or request Relayer to mint
3. Relayer: Submit `AdWalletPoints.mint(to, amount, proof)` tx (platform pays gas)

### 5.3 Wallet/App Developers (Contract-Only Integration)

- **Required**: AdWalletPoints address, AdSponsorPaymaster address, EntryPoint address, ABI
- **No custom backend**: Balance via `balanceOf`; payment via UserOperation + Paymaster calling `spendForGas`
- **Docs**: “Wallet/app integration guide” with contract call order, ABI, and example code

---

## 6. Deployment and Environment

### 6.1 Chains (Existing, Unchanged)

- **Primary**: Avalanche, Base, BNB, etc. (current `AdWalletSponsoredTransfer` deployment chains)
- **Secondary**: Sepolia etc. for testing

### 6.2 Recommended Deployment Order

1. **AdSponsorPaymaster** (existing) — keep
2. **AdWalletSponsoredTransfer** (existing) — keep
3. **AdWalletPoints** — new deployment; set MINTER/Relayer roles
4. **AdWalletSwapPool** — new deployment; set token pair and fee
5. Update Paymaster policy (allow swap and point txs)

### 6.3 Scripts (Existing Reference)

- `contracts/scripts/deploy.ts`: AdSponsorPaymaster
- `contracts/scripts/deploy-sponsored-transfer.ts`: AdWalletSponsoredTransfer
- Add: `deploy-points.ts`, `deploy-swap-pool.ts`

---

## 7. Testing

### 7.1 Unit Tests

- **AdWalletPoints**: mint/burn/spendForGas, permissions, balance consistency
- **AdWalletSwapPool**: addLiquidity/removeLiquidity, swap (x*y=k), fees
- **Paymaster**: Existing + point-deduction integration verification

### 7.2 Integration Tests

- Type 1: Existing E2E (ad view → free send)
- Type 2: Ad view → mint → tx with points → spendForGas success
- Swap: Add liquidity → ad (or points) → swap → confirm gas sponsored
- Wallet integration: Simulate balanceOf + UserOperation(spendForGas) with external contracts only

### 7.3 Security

- Reentrancy, limit overflow, unauthorized mint/burn/spendForGas
- Swap pool: Slippage and min output; revert when liquidity exhausted

---

## 8. Integration Development Checklist

### Phase 1: Type 1+2 + Wallet/App Contract Integration

- [ ] **AdWalletPoints.sol** (IAdWalletPoints, mint/burn/spendForGas, pointsToWei)
- [ ] Paymaster (or Executor) point integration (spendForGas then gas sponsor)
- [ ] Points accrual backend/Relayer (ad verification → mint)
- [ ] SDK: getPointsBalance, sendTransactionWithPoints (optional)
- [ ] Frontend: Points balance display, “Pay with points” option
- [ ] **Wallet/app integration doc**: Contract addresses, ABI, scenarios, examples
- [x] Type 1 existing (AdSponsorPaymaster, AdWalletSponsoredTransfer, Form1TransferUI) kept

### Phase 2: Swap Pool MVP

- [ ] AdWalletSwapPool.sol (addLiquidity, removeLiquidity, swap, getReserves)
- [ ] Paymaster sponsorship for swap txs
- [ ] SDK: swapGasless, addLiquidity, removeLiquidity, getPoolInfo
- [ ] Frontend: Swap UI, LP add/remove UI

### Phase 3: Integration and Optimization

- [ ] Ad view → swap flow (adProof)
- [ ] Swap gas payment with points
- [ ] LP dashboard (yield, balance)
- [ ] Security audit (Paymaster, Points, SwapPool)

---

## 9. Document and Code Index (Current Baseline)

| Area | Path |
|------|------|
| Type 1 Paymaster | `contracts/contracts/AdSponsorPaymaster.sol` |
| Type 1 sponsored transfer | `contracts/contracts/AdWalletSponsoredTransfer.sol` |
| Gasless SDK | `src/core/GaslessSDK.ts` |
| Type 1 UI | `frontend/src/components/Form1TransferUI.tsx` |
| Admin page | `frontend/src/components/admin/AdminDepositPage.tsx` |
| Deploy scripts | `contracts/scripts/deploy*.ts` |
| Product plan | `docs/통합_기획서.md` |
| Business model | `docs/BUSINESS_MODEL.md` |

This document defines the **integrated platform** development spec. Product scope and KPIs are in **통합_기획서.md**; business direction in **BUSINESS_MODEL.md**.
