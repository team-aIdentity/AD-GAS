# Integration Development Plan — Type 1+2 + Free Swap Pool

> **Technical definition**: Single platform implementing ad-view gas sponsorship (Type 1), point accrual/payment (Type 2), and self-operated LP swap pool. Wallet/app developers can integrate "ad reward → gas payment" via SDK or **smart contracts only**.

**Related docs**: [integration_plan.md](./integration_plan.md) · [business_model.md](./business_model.md)

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

## 2. Smart Contract Spec

### 2.1 Existing Contracts (Reference)

#### AdSponsorPaymaster (`contracts/contracts/AdSponsorPaymaster.sol`)
- **Role**: EIP-4337 Paymaster, per-call/daily gas limits, whitelist, pause
- **Integration**: Deposit to EntryPoint, `validatePaymasterUserOp` / `postOp`
- **Integrated**: Extend policy so swap and point-payment transactions can use same Paymaster

#### AdWalletSponsoredTransfer (`contracts/contracts/AdWalletSponsoredTransfer.sol`)
- **Role**: Verify user signature (EIP-712), send native/ERC20; sponsor pays gas
- **Admin**: `admin`, `depositNative` / `withdrawNative`, `getNativeDepositPool`
- **Integrated**: Keep Type 1 "instant free send"; frontend keeps `Form1TransferUI` etc.

### 2.2 New: AdWalletPoints (Type 2 + wallet/app integration)

#### Interface (for contract-only integration)

```solidity
// Same as integration_plan.md 4.1.3
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
- **mint**: `onlyRole(MINTER)` or authorized Relayer; `proof` for ad view (off-chain verification then signature etc.)
- **burn / spendForGas**: Only Paymaster or authorized Executor; deduct points before sponsoring gas
- **pointsToWei**: Admin-configurable or fixed rate (e.g. 1 point = 1e12 wei)
- **Events**: `Transfer` (accrual/deduction), `SpendForGas(user, amount)`

#### Deploy and integrate
- Publish **contract address + ABI** per chain
- Wallet/app shows balance via `balanceOf(user)`; Paymaster calls `spendForGas` in UserOperation flow

### 2.3 New: AdWalletSwapPool (free swap)

#### Core functions
- `addLiquidity(uint256 amountAVAX, uint256 amountToken) external payable returns (uint256 lpTokens)`
- `removeLiquidity(uint256 lpTokens) external`
- `swap(address tokenIn, address tokenOut, uint256 amountIn, uint256 minAmountOut, bytes calldata adProof) external`
- `getReserves() external view returns (uint256 reserve0, uint256 reserve1)`

#### Rules
- AMM: Uniswap V2 style `x * y = k`, 0.3% fee → LP or distributed
- Swap gas paid by Paymaster (same-chain AdSponsorPaymaster or dedicated Paymaster)
- `adProof`: Ad completion proof (Type 1) or point deduction handled by Paymaster/external before call

#### Security
- ReentrancyGuard, optional daily swap limit, min liquidity checks

### 2.4 Paymaster Extension (Integrated)

- **Type 1**: Unchanged UserOperation gas sponsorship
- **Type 2**: In `validatePaymasterUserOp` (or separate Executor), call `IAdWalletPoints(...).spendForGas(sender, cost)` then proceed
- **Swap**: Same Paymaster sponsors gas for swap pool calls

---

## 3. SDK Extension (Current Code Base)

### 3.1 Existing GaslessSDK (`src/core/GaslessSDK.ts`)

- **Implemented**: `setAdTrigger`, `getAdTrigger`, `sendGaslessTransaction` (beforeTransaction → ad view → tx)
- **Config**: `SdkConfig` — `publicClient`, `walletClient`, `apiKey` (Biconomy)
- **Integrated**: Keep Type 1 as-is; add Type 2 methods e.g. `getPointsBalance(address?)`, `sendTransactionWithPoints(tx)` as new methods

### 3.2 Target APIs (Integrated)

| API | Description |
|-----|-------------|
| `getPointsBalance(account?)` | `IAdWalletPoints.balanceOf(account ?? wallet)` |
| `sendTransactionWithPoints(tx)` | Deduct points + submit UserOperation (Paymaster calls spendForGas) |
| `swapGasless(tokenIn, tokenOut, amountIn, minOut, paymentMethod)` | Call swap pool; paymentMethod: 'ad' \| 'points' |
| `addLiquidity(amountAVAX, amountToken, tokenAddress)` | LP deposit |
| `removeLiquidity(lpTokens)` | LP withdraw |
| `getPoolInfo(poolAddress?)` | Pool reserves, fee, etc. |

### 3.3 Ad trigger (existing)

- `AdTrigger.beforeTransaction`: Used for Type 1 and swap (ad payment)
- Type 2 accrual: app "Watch ad" → ad view → backend/Relayer calls `mint`

---

## 4. Frontend (Current Code Base)

### 4.1 Existing

- **Form1TransferUI** (`frontend/src/components/Form1TransferUI.tsx`): Type 1 "watch ad, free send", AdTrigger
- **AdminDepositPage** (`frontend/src/components/admin/AdminDepositPage.tsx`): Admin deposit/withdraw, `AdWalletSponsoredTransfer`
- **wagmi**: `wagmi.config.ts`, `useAccount`, `useConnect`, etc.

### 4.2 UI Extension (Integrated)

- **Tabs/menu**: "Instant free send" (Type 1) / "Earn points" / "Pay with points" / "Free swap"
- **Point balance**: Top or sidebar via `IAdWalletPoints.balanceOf(address)`
- **Swap UI**: Token select, amount, "Watch ad to swap" or "Swap with points"
- **LP UI**: Deposit/withdraw, LP balance and revenue (Phase 2)

### 4.3 Environment Variables (example)

```env
# Existing
NEXT_PUBLIC_ADWALLET_CONTRACT_ADDR_AVALANCHE=
NEXT_PUBLIC_BICONOMY_API_KEY=

# Integrated
NEXT_PUBLIC_ADWALLET_POINTS_ADDRESS=
NEXT_PUBLIC_ADWALLET_SWAP_POOL_ADDRESS=
```

---

## 5. Backend / Infrastructure

### 5.1 Ad verification

- Type 1: As today, client or backend verifies "ad view complete" then proceed
- Type 2: On ad complete → **accrue points** — backend verifies, then Relayer calls `AdWalletPoints.mint(user, amount, proof)`

### 5.2 Point accrual flow

1. Client: Ad SDK callback (view complete) → send (userAddress, adId, timestamp, etc.) to backend
2. Backend: Verify, issue one-time token/signature or request Relayer to mint
3. Relayer: Submit `AdWalletPoints.mint(to, amount, proof)` (platform pays gas)

### 5.3 Wallet/app developers (contract-only)

- **Needed**: AdWalletPoints address, AdSponsorPaymaster address, EntryPoint address, ABI
- **No own backend**: Balance via `balanceOf`; payment via UserOperation + Paymaster calling `spendForGas`
- **Docs**: "Wallet/app integration guide" with call order, ABI, sample code

---

## 6. Deployment and Environment

### 6.1 Chains (existing, same)

- **Primary**: Avalanche, Base, BNB, etc. (current `AdWalletSponsoredTransfer` chains)
- **Secondary**: Sepolia etc. for testing

### 6.2 Deploy Order (recommended)

1. **AdSponsorPaymaster** (existing) — keep
2. **AdWalletSponsoredTransfer** (existing) — keep
3. **AdWalletPoints** — new; set MINTER/Relayer roles
4. **AdWalletSwapPool** — new; set token pair and fee
5. Update Paymaster policy (allow swap and point-payment transactions)

### 6.3 Scripts (reference)

- `contracts/scripts/deploy.ts`: AdSponsorPaymaster
- `contracts/scripts/deploy-sponsored-transfer.ts`: AdWalletSponsoredTransfer
- Add: `deploy-points.ts`, `deploy-swap-pool.ts`

---

## 7. Testing

### 7.1 Unit tests

- **AdWalletPoints**: mint/burn/spendForGas, roles, balance consistency
- **AdWalletSwapPool**: addLiquidity/removeLiquidity, swap (x*y=k), fee
- **Paymaster**: Existing + verification when points are integrated

### 7.2 Integration tests

- Type 1: Existing E2E (ad view → free send)
- Type 2: Ad view → mint → tx with points → spendForGas → success
- Swap: Add liquidity → ad (or points) → swap → confirm gas sponsored
- Wallet integration: Simulate balanceOf + UserOperation(spendForGas) with external contract only

### 7.3 Security

- Reentrancy, limit overflow, unauthorized mint/burn/spendForGas
- Swap pool: Slippage/min output, revert when liquidity exhausted

---

## 8. Integrated Development Checklist

### Phase 1: Type 1+2 + wallet/app contract integration

- [ ] **AdWalletPoints.sol** (IAdWalletPoints, mint/burn/spendForGas, pointsToWei)
- [ ] Paymaster (or Executor) points integration (spendForGas then sponsor gas)
- [ ] Points backend/Relayer (ad verification → mint)
- [ ] SDK: getPointsBalance, sendTransactionWithPoints (optional)
- [ ] Frontend: Point balance, "Pay with points" option
- [ ] **Wallet/app integration doc**: Contract addresses, ABI, flow, examples
- [x] Type 1 existing (AdSponsorPaymaster, AdWalletSponsoredTransfer, Form1TransferUI) kept

### Phase 2: Swap pool MVP

- [ ] AdWalletSwapPool.sol (addLiquidity, removeLiquidity, swap, getReserves)
- [ ] Paymaster gas sponsorship for swap transactions
- [ ] SDK: swapGasless, addLiquidity, removeLiquidity, getPoolInfo
- [ ] Frontend: Swap UI, LP deposit/withdraw UI

### Phase 3: Integration and optimization

- [ ] Ad view → swap flow (adProof)
- [ ] Pay swap gas with points
- [ ] LP dashboard (revenue, balance)
- [ ] Security audit (Paymaster, Points, SwapPool)

---

## 9. Document and Code Index (Current)

| Area | Path |
|------|------|
| Type 1 Paymaster | `contracts/contracts/AdSponsorPaymaster.sol` |
| Type 1 sponsored transfer | `contracts/contracts/AdWalletSponsoredTransfer.sol` |
| Gasless SDK | `src/core/GaslessSDK.ts` |
| Type 1 UI | `frontend/src/components/Form1TransferUI.tsx` |
| Admin page | `frontend/src/components/admin/AdminDepositPage.tsx` |
| Deploy scripts | `contracts/scripts/deploy*.ts` |
| Plan | `docs/integration_plan.md` |
| Business model | `docs/business_model.md` |

This document defines the **integrated platform** development spec; product scope and KPIs are in **integration_plan.md**, business direction in **business_model.md**.
