# DEFAI Project Composer Readme

## Overview

The DEFAI project is a modular, multi-program protocol on Solana, designed to provide a comprehensive suite of decentralized finance (DeFi) and digital asset management tools. It is composed of four core smart contracts (programs):

- **DEFAI Swap**
- **DEFAI Staking**
- **DEFAI Estate**
- **DEFAI App Factory**

Each program is independently deployable, but together they form a powerful, composable ecosystem for token swaps, staking, digital estate management, and decentralized application monetization. This document explains how these programs work together, their integration points, and the overall architecture of the DEFAI system.

---

## Architectural Overview

### System Diagram

```
graph TD;
  User["User Wallet"] --> Swap["DEFAI Swap"]
  User --> Staking["DEFAI Staking"]
  User --> Estate["DEFAI Estate"]
  User --> AppFactory["DEFAI App Factory"]
  Swap --> Staking
  Swap --> Estate
  Staking --> Estate
  AppFactory --> Estate
  AppFactory --> Staking
  AppFactory --> Swap
```

- **Shared Token (DEFAI Mint):** All programs use the DEFAI token as the primary currency for swaps, staking, app purchases, and estate operations.
- **Composable Accounts:** Users can interact with any combination of programs, and their assets/permissions are portable across the ecosystem.

---

## Program Roles and Interactions

### 1. DEFAI Swap
- **Purpose:** Enables users to swap DEFAI tokens for tiered NFTs with randomized bonus rewards and vesting. Implements a progressive tax system to prevent abuse.
- **Integration:**
  - Provides NFT rewards that can be used as proof of participation or access in other DEFAI programs.
  - Swapped tokens can be staked in the Staking program for additional yield.
  - Bonus NFTs and vesting claims can be referenced in estate planning (e.g., as part of digital inheritance).

### 2. DEFAI Staking
- **Purpose:** Allows users to stake DEFAI tokens in tiered pools for APY rewards, with compounding and penalty mechanisms for early withdrawal.
- **Integration:**
  - Accepts DEFAI tokens earned from swaps or app sales.
  - Staked positions and rewards can be included in estate management.
  - Compound rewards can be used to purchase app access or further swaps.

### 3. DEFAI Estate
- **Purpose:** Provides digital estate management, inheritance planning, real-world asset (RWA) tracking, and optional AI-powered trading. Supports multi-signature security and emergency recovery.
- **Integration:**
  - Can include DEFAI tokens, NFTs, and staked positions as estate assets.
  - Beneficiaries can inherit assets from any DEFAI program.
  - Trading features can utilize tokens earned from staking or swaps.
  - Multi-sig and timelock features protect high-value assets across the ecosystem.

### 4. DEFAI App Factory
- **Purpose:** A platform for developers to register and monetize decentralized applications using Semi-Fungible Tokens (SFTs) as access passes. Handles revenue sharing and access control.
- **Integration:**
  - Users purchase app access with DEFAI tokens (earned from swaps, staking, or inheritance).
  - App creators can receive revenue in DEFAI, which can be staked or swapped.
  - SFTs can be managed as estate assets or used in other DEFAI-enabled apps.

---

## User and Developer Flows

### User Flow Example
1. **Acquire DEFAI tokens** (via external exchange or airdrop)
2. **Swap DEFAI for NFTs** using the Swap program (potentially earning bonus rewards)
3. **Stake DEFAI** to earn APY and compound rewards
4. **Purchase app access** in the App Factory using DEFAI
5. **Manage digital estate**: Assign NFTs, tokens, and app access as inheritance to beneficiaries
6. **Benefit from security**: All actions are logged, and critical operations are protected by timelocks and multi-sig

### Developer Flow Example
1. **Register an app** in the App Factory, set pricing and supply
2. **Receive DEFAI revenue** from users
3. **Stake or swap earned DEFAI** for additional yield or liquidity
4. **Integrate SFTs** with other DEFAI programs (e.g., estate planning)

---

## Security and Upgradeability

- **Admin Timelocks:** All programs implement 48-hour timelocks for critical admin changes, preventing instant malicious actions.
- **Multi-Signature Support:** The Estate program supports multi-sig for high-value operations, and this pattern is being extended to other programs.
- **Event Emissions:** All major actions emit events for on-chain auditability and monitoring.
- **Overflow and Input Validation:** All programs use checked math and strict input validation.
- **Upgradeable Patterns:** While current programs are not proxy-upgradeable, future versions may introduce upgrade proxies for bug fixes and enhancements.
- **Randomness Security:** The Swap program uses multiple entropy sources for randomness, with a VRF module ready for integration.

---

## Unique Features and Integration Points

| Program         | Key Features                                      | Integration Points                                 |
|-----------------|---------------------------------------------------|----------------------------------------------------|
| DEFAI Swap      | Tiered NFT swaps, vesting, progressive tax, VRF   | Feeds NFTs/tokens to Staking, Estate, App Factory  |
| DEFAI Staking   | Tiered APY, compounding, penalties, escrow        | Accepts tokens from Swap/AppFactory, links to Estate|
| DEFAI Estate    | Inheritance, RWA, AI trading, multi-sig, timelock | Manages assets from all programs, multi-sig sec.   |
| DEFAI AppFactory| App/SFT registry, revenue split, access control   | Uses DEFAI for payments, SFTs as estate assets     |

---

## Guidance for Developers and Auditors

- **Understand the Token Flow:** DEFAI is the central asset; all value flows through it across programs.
- **Review Event Logs:** All programs emit events for major actions—use these for monitoring and auditing.
- **Check PDA Derivations:** All accounts use Program Derived Addresses for security and uniqueness.
- **Test Integration Points:** Simulate user flows that span multiple programs (e.g., swap → stake → app purchase → estate assignment).
- **Review Security Features:** Focus on timelocks, multi-sig, and input validation in your audit.
- **Upgrade Considerations:** Note that upgradeability is limited; plan for future proxy patterns.

---

## Conclusion

The DEFAI project is a robust, modular DeFi platform that leverages composable Solana programs to deliver a full spectrum of financial and asset management tools. Its architecture enables seamless user and developer experiences, strong security guarantees, and extensibility for future features. Understanding how these programs interact is key to leveraging the full power of the DEFAI ecosystem. 