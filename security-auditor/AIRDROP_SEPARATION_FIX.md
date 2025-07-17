# Airdrop Separation Fix Documentation

## Overview
This document clarifies the separation between two distinct distribution mechanisms in the defai_swap program:

1. **OG Tier 0 NFT Minting with Vesting** (MAY20DEFAIHolders.csv)
2. **Pure Airdrop Vesting** (10_1AIR-Sheet1.csv)

## Key Differences

### Function 1: `swap_og_tier0_for_pnft_v6`
- **Data Source**: MAY20DEFAIHolders.csv
- **Purpose**: OG holders mint a Tier 0 NFT AND receive 1:1 vesting
- **Process**:
  - User provides merkle proof from MAY20DEFAIHolders.csv
  - Mints a special Tier 0 NFT (no payment required)
  - Sets up 1:1 vesting based on the Quantity column
  - NFT includes bonus mechanism (though tier 0 bonus is 0%)
  - One-time claim per wallet

### Function 2: `claim_airdrop`
- **Data Source**: 10_1AIR-Sheet1.csv  
- **Purpose**: Pure vesting distribution, NO NFT involved
- **Process**:
  - User provides merkle proof from 10_1AIR-Sheet1.csv
  - Sets up vesting based on the AIRDROP column amount
  - NO NFT is minted
  - Vesting tokens come from escrow PDA (must be funded)
  - One-time claim per wallet

## Implementation Details

### Merkle Roots
```rust
pub struct CollectionConfig {
    // MAY20DEFAIHolders.csv: OG Tier 0 holders who can mint NFT + get 1:1 vesting
    pub og_tier_0_merkle_root: [u8; 32],
    
    // 10_1AIR-Sheet1.csv: Airdrop recipients who get vesting only (NO NFT)
    pub airdrop_merkle_root: [u8; 32],
}
```

### Account Structures

**OG Tier 0 (with NFT)**:
- Requires NFT mint accounts
- Creates BonusStateV6 account
- Creates VestingStateV6 account
- Creates OgTier0Claim account

**Pure Airdrop (no NFT)**:
- Only creates AirdropVesting account
- No NFT-related accounts needed

## Vesting Details

Both mechanisms use the same vesting parameters:
- **Duration**: 90 days
- **Cliff**: 2 days
- **Linear vesting**: After cliff period

## Claiming Vested Tokens

- **OG Tier 0**: Use `claim_vested_v6` (requires NFT ownership)
- **Pure Airdrop**: Use `claim_vested_airdrop` (no NFT required)

## Summary

The separation ensures:
1. MAY20DEFAIHolders get their special OG Tier 0 NFT plus vesting
2. 10_1AIR recipients get only vesting without any NFT
3. Both use separate merkle trees for verification
4. Both have separate claiming mechanisms
5. No confusion between the two distribution types 