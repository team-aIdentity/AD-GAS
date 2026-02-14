# Ad-Based Gas Fee Business Strategy (Two Types)

## Overview

We run the service that reduces users’ gas burden in exchange for watching ads in **two business types**.

| | Type 1: Contract (call) | Type 2: Wallet (points) |
|--|-------------------------|-------------------------|
| **Core** | Ad view → **instant gas sponsorship** | Ad view → **accrue points** → pay gas with points at tx time |
| **Bearer** | dApp/service via Paymaster | User’s in-wallet points (later token) |
| **User feel** | “Send once for free” | “Pay gas with points from ads” |

---

## Type 1: Contract = call (ad view → gas sponsored)

### Concept
- After the user **watches an ad**, the **call (transaction)** gas is paid by the **contract (Paymaster)**.
- “One ad view ≈ one free transaction.”

### Flow
```
[User] Ad view complete
    → [dApp/backend] Verify ad completion (or issue signature/session)
    → [SDK] Build UserOperation + Paymaster
    → [Paymaster contract] Validate and sponsor gas
    → [Bundler/EntryPoint] Execute transaction
```

### Characteristics
- **Immediate**: One free transaction right after the ad.
- **dApp-centric**: dApp/advertiser prepays gas; ad revenue offsets it.
- **Tech**: EIP-4337 Paymaster, whitelist, gas limits, etc., aligned with current “contract approach.”

### Revenue (example)
- **Advertiser**: Pays CPM/CPA.
- **Platform (us)**: Use part of ad revenue for gas + margin.
- **User**: No gas cost.

### Use cases
- dApp “first tx free,” “event: one free send”
- One gas sponsorship for NFT mint/claim
- Game/app “watch ad, get reward” then execute on-chain

---

## Type 2: Wallet = points (ad view → points → gas payment)

### Concept
- User **accrues points** each time they watch an ad.
- When a **transaction (gas)** happens, the user **pays gas with points**.
- Points can later be **tokenized** (internal points → ERC-20, etc.).

### Flow
```
[User] Watch ad
    → [Backend/off-chain] Verify view, accrue points (per wallet)
[User] Request transaction (wallet/SDK)
    → [Wallet/SDK] Choose “pay gas with points”
    → [Backend] Deduct points + sponsor gas (or pay on user’s behalf)
    → [Chain] Execute transaction
```

### Characteristics
- **Accrual and spend separate**: Ad view and transaction can be at different times.
- **Wallet/account-centric**: “This wallet’s points” pay gas later.
- **Token extension**: Points → ERC-20 later enables listing, other dApp payments, etc.

### Revenue (example)
- **Advertiser**: CPM/CPA → converted to point issuance cost.
- **Platform**: Ad revenue covers point issuance and gas sponsorship + margin.
- **User**: Pay gas with points → effectively free UX.

### Use cases
- “Watch ads, save points, pay fees/gas” wallet app
- Web3 app reward points for gas payment
- Later: gas discount for ad-reward token holders

---

## Comparison

| | Type 1: Contract (call) | Type 2: Wallet (points) |
|--|------------------------|-------------------------|
| **Gas bearer** | Paymaster (contract/platform) | User points → platform sponsors or pays |
| **Ad timing** | Required right before/after tx | Can accrue anytime |
| **Tech focus** | Paymaster, EIP-4337, Bundler | Wallet/backend points, payment integration |
| **Regulation/token** | Gas sponsorship only → no token needed | Points→token: consider securities/payment rules |
| **User perception** | “Watch ad, send for free” | “Pay gas with points” |

---

## Integrated Business Model (Type 1 + Type 2 + Free Swap Pool)

### Overview
Combine both types in **one platform**, add **self-operated LP swap pool** and **wallet/app developer contract integration**. Details in [integration_plan.md](./integration_plan.md).

### Integrated product position

| | Content |
|--|--------|
| **Core** | Ad view → (instant free / points) + pay gas with points + **free swap pool** (gas sponsored) |
| **Actors** | Paymaster (gas) + Points contract (accrual/deduction) + Swap pool (LP/swap) |
| **User feel** | Choose “free send / pay with points / swap without gas” |

### Revenue and cost (integrated)

| Revenue | Actor | Note |
|---------|--------|-----|
| Ad revenue (CPM/CPA) | Platform | Type 1 & 2 |
| Swap fee (0.3%) | LPs / platform | Swap pool |
| Gas margin (ad > gas) | Platform | Type 1 & 2 |

| Cost | Actor | Note |
|------|--------|-----|
| Gas sponsorship | Platform (Paymaster) | Send, swap, point payment |
| Point issuance | Platform | Type 2 accrual |
| Infrastructure (RPC, Bundler, servers) | Platform | Shared |

### Target customers (integrated)

- **dApp/app developers**: “Free send + points + free swap” in one place
- **End users**: Send, swap, mint without gas
- **Liquidity providers**: Earn swap fees via LP
- **Wallet/app developers**: Want **“ad reward → gas payment”** in their wallet/app  
  → Support **SDK/API** or **smart-contract-only** (contract addresses, ABI, guide for Points and Paymaster)

### Integrated rollout

1. **Phase 1**  
   Keep Type 1; add Type 2 points contract and Paymaster integration; document wallet/app contract integration.
2. **Phase 2**  
   Swap pool MVP (LP, swap, gas sponsorship).
3. **Phase 3**  
   Unified UI/dashboard, security audit, profitability monitoring.

---

## Technology and product mapping (current project)

- **Type 1**  
  - Implemented as **Paymaster contract** and **SDK `sendGaslessTransaction`** (one sponsorship after ad view).  
  - Same as “call-style ad view → gas sponsored” in requirements.

- **Type 2**  
  - **Wallet app + points backend** to be designed.  
  - Features: point accrual (ad view), balance/history, “pay gas with points,” (later) point tokenization.  
  - **Integrated**: With on-chain **AdWalletPoints**, wallets/apps can integrate “ad reward → gas payment” **without SDK** by calling contracts only ([integration_plan.md](./integration_plan.md) 4.1.3).

- **Integrated (Type 1+2+swap pool)**  
  - Plan: [integration_plan.md](./integration_plan.md)  
  - Dev: [integration_dev_plan.md](./integration_dev_plan.md)  
  - Current: AdSponsorPaymaster, AdWalletSponsoredTransfer, GaslessSDK, Form1TransferUI, AdminDepositPage, etc., kept and extended.

---

## Business rollout proposal

1. **Short term**  
   Complete **Type 1**: Paymaster + SDK “ad view → one gas sponsored,” validate and onboard partner dApps. (Current: AdSponsorPaymaster, AdWalletSponsoredTransfer, Form1TransferUI)
2. **Medium term**  
   Design and build **Type 2**: Points contract (AdWalletPoints), accrual/use API, wallet UI “pay gas with points” + **wallet/app contract integration** doc and ABI.
3. **Integrated**  
   Type 1+2 platform + **free swap pool** (self LP, gas sponsored) per [integration_plan.md](./integration_plan.md) and [integration_dev_plan.md](./integration_dev_plan.md).
4. **Long term**  
   Evaluate **tokenization** of Type 2 points (legal and regulatory).

This document defines business direction for both types and **integration**; detailed specs are in the plan and dev docs below.

---

## Plan and dev doc index (current docs)

| Document | Purpose |
|----------|---------|
| [integration_plan.md](./integration_plan.md) | Product overview, user flows, swap pool design, tech spec, KPIs, risks, roadmap |
| [integration_dev_plan.md](./integration_dev_plan.md) | Architecture, contract/SDK/frontend spec, deploy and test, phase checklists |
| [business_model.md](./business_model.md) | Type 1 & 2 business structure, integrated revenue/cost, target customers, rollout |

- Type 1 (contract/call) and Type 2 (wallet/points) details are consolidated in the **integration docs**.
