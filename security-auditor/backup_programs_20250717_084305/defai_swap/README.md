# DeFi Swap Program - Security Audit Documentation

## Program Overview
**Program ID:** `5pmceM9vG9gpLCM8W7wTC92m8GsXnZEpE7wmbbHpFUeT`

The DeFi Swap program is a comprehensive token swap and NFT minting platform that allows users to swap DEFAI tokens for bonus NFTs with tiered rewards, vesting mechanisms, and dynamic tax systems. The program includes features for whitelist management, VRF (Verifiable Random Function) integration, and admin-controlled operations.

## Architecture

### Core Components
- **Token Swapping**: DEFAI to bonus NFT conversion
- **Tiered Rewards**: Five tiers with different bonus ranges
- **Vesting System**: Time-based token vesting with cliff periods
- **Dynamic Tax**: Progressive tax system based on swap frequency
- **VRF Integration**: Cryptographically secure randomness
- **Whitelist Management**: OG NFT holder privileges
- **Admin Controls**: Timelock-protected administrative functions

### Key Constants
- `INITIAL_TAX_BPS`: 500 (5% initial tax)
- `TAX_INCREMENT_BPS`: 100 (1% tax increment per swap)
- `TAX_CAP_BPS`: 3000 (30% maximum tax)
- `TAX_RESET_DURATION`: 24 hours
- `ADMIN_TIMELOCK_DURATION`: 48 hours
- `VESTING_DURATION`: 90 days
- `CLIFF_DURATION`: 2 days

### Bonus Tiers
- **Tier 0 (OG)**: 0% bonus (whitelist only)
- **Tier 1 (Train)**: 0-15% bonus
- **Tier 2 (Boat)**: 15-50% bonus
- **Tier 3 (Plane)**: 20-100% bonus
- **Tier 4 (Rocket)**: 50-300% bonus

## Functions & Instructions

### Initialization Functions

#### 1. `initialize`
**Purpose**: Initialize the swap program configuration

**Parameters**:
- `prices: Vec<u64>` - Array of 5 tier prices

**Accounts**:
- `admin` - Program admin (signer)
- `old_mint` - Legacy SPL-Token mint
- `new_mint` - DEFAI Token-2022 mint
- `collection` - Bonus-NFT collection mint
- `treasury` - Treasury wallet
- `config` - PDA with seed `["config"]`
- `escrow` - PDA with seed `["escrow"]`
- `tax_state` - PDA with seed `["tax_state"]`

**Security Considerations**:
- ✅ Admin authorization
- ✅ Price array validation (exactly 5 prices)
- ✅ Mint address validation
- ✅ Treasury address validation

**Case Study - Invalid Price Array Attack**:
```rust
// Attacker tries to initialize with wrong number of prices
let malicious_prices = vec![1000, 2000, 3000]; // Only 3 prices
initialize(ctx, malicious_prices)?; // Should fail
```
**Mitigation**: `require!(prices.len() == 5, ErrorCode::InvalidInput)`

#### 2. `initialize_whitelist`
**Purpose**: Initialize the OG NFT whitelist

**Accounts**:
- `admin` - Program admin (signer)
- `whitelist` - PDA with seed `["whitelist"]`

**Security Considerations**:
- ✅ Admin authorization
- ✅ Whitelist root validation

#### 3. `initialize_vrf_state`
**Purpose**: Initialize VRF state for randomness

**Parameters**:
- `vrf_account: Pubkey` - Switchboard VRF account

**Accounts**:
- `authority` - Authority (signer)
- `vrf_state` - PDA with seed `["vrf_state"]`

**Security Considerations**:
- ✅ Authority authorization
- ✅ VRF account validation

### Configuration Functions

#### 4. `update_prices`
**Purpose**: Update tier prices (admin only)

**Parameters**:
- `prices: Vec<u64>` - New tier prices

**Accounts**:
- `admin` - Program admin (signer)
- `config` - Program configuration

**Security Considerations**:
- ✅ Admin authorization
- ✅ Price array validation

#### 5. `update_treasury`
**Purpose**: Update treasury address (admin only)

**Parameters**:
- `new_treasury: Pubkey` - New treasury address

**Accounts**:
- `admin` - Program admin (signer)
- `config` - Program configuration

**Security Considerations**:
- ✅ Admin authorization
- ✅ Treasury address validation

#### 6. `pause` / `unpause`
**Purpose**: Pause/unpause the protocol (admin only)

**Accounts**:
- `admin` - Program admin (signer)
- `config` - Program configuration

**Security Considerations**:
- ✅ Admin authorization
- ✅ Pause state validation

#### 7. `propose_admin_change`
**Purpose**: Propose admin change with timelock

**Parameters**:
- `new_admin: Pubkey` - New admin address

**Accounts**:
- `admin` - Current admin (signer)
- `config` - Program configuration

**Security Considerations**:
- ✅ Admin authorization
- ✅ Timelock implementation (48 hours)

#### 8. `accept_admin_change`
**Purpose**: Execute admin change after timelock expires

**Accounts**:
- `admin` - Current admin (signer)
- `config` - Program configuration

**Security Considerations**:
- ✅ Timelock validation
- ✅ Pending admin existence check

### VRF Functions

#### 9. `enable_vrf`
**Purpose**: Enable VRF for randomness (admin only)

**Accounts**:
- `admin` - Program admin (signer)
- `config` - Program configuration

**Security Considerations**:
- ✅ Admin authorization
- ✅ VRF state validation

#### 10. `request_vrf_randomness`
**Purpose**: Request randomness from VRF

**Accounts**:
- `authority` - Authority (signer)
- `vrf_state` - VRF state
- `vrf` - Switchboard VRF account
- `oracle_queue` - Oracle queue
- `queue_authority` - Queue authority
- `data_buffer` - Data buffer
- `permission` - Permission account
- `escrow` - Escrow account
- `payer_wallet` - Payer wallet
- `recent_blockhashes` - Recent blockhashes
- `switchboard_program` - Switchboard program

**Security Considerations**:
- ✅ Authority authorization
- ✅ VRF account validation
- ✅ Oracle queue validation

#### 11. `consume_vrf_randomness`
**Purpose**: Consume VRF randomness result

**Accounts**:
- `vrf_state` - VRF state
- `vrf` - VRF account

**Security Considerations**:
- ✅ VRF account validation
- ✅ Result readiness check

### Tax Management Functions

#### 12. `initialize_user_tax`
**Purpose**: Initialize user's tax state

**Accounts**:
- `user` - User (signer)
- `user_tax_state` - PDA with seed `["user_tax", user.key()]`

**Security Considerations**:
- ✅ User authorization
- ✅ Tax state initialization

#### 13. `reset_user_tax`
**Purpose**: Reset user's tax rate after reset period

**Accounts**:
- `user` - User (signer)
- `user_tax_state` - User's tax state

**Security Considerations**:
- ✅ Reset period validation
- ✅ Tax rate reset logic

### Collection Management Functions

#### 14. `initialize_collection`
**Purpose**: Initialize NFT collection configuration

**Parameters**:
- `tier_names: Vec<String>` - Tier names
- `tier_symbols: Vec<String>` - Tier symbols
- `tier_prices: [u64; 5]` - Tier prices
- `tier_supplies: [u16; 5]` - Tier supplies
- `tier_uri_prefixes: Vec<String>` - URI prefixes

**Accounts**:
- `authority` - Authority (signer)
- `collection_mint` - Collection mint
- `treasury` - Treasury
- `defai_mint` - DEFAI mint
- `old_defai_mint` - Old DEFAI mint
- `collection_config` - PDA with seed `["collection_config"]`

**Security Considerations**:
- ✅ Authority authorization
- ✅ Array length validation
- ✅ Supply validation

### Core Swap Functions

#### 15. `swap_defai_for_pnft_v6`
**Purpose**: Swap DEFAI tokens for bonus NFT (v6)

**Parameters**:
- `tier: u8` - NFT tier (0-4)
- `_metadata_uri: String` - Metadata URI
- `_name: String` - NFT name
- `_symbol: String` - NFT symbol

**Accounts**:
- `user` - User (signer)
- `user_defai_ata` - User's DEFAI token account
- `treasury_defai_ata` - Treasury's DEFAI token account
- `escrow_defai_ata` - Escrow's DEFAI token account
- `defai_mint` - DEFAI mint
- `config` - Program configuration
- `collection_config` - Collection configuration
- `nft_mint` - NFT mint to be created
- `nft_token_account` - NFT token account
- `bonus_state` - PDA with seed `["bonus_v6", nft_mint.key()]`
- `vesting_state` - PDA with seed `["vesting_v6", nft_mint.key()]`
- `escrow` - Escrow account
- `user_tax_state` - User's tax state

**Security Considerations**:
- ✅ Protocol pause check
- ✅ Tier validation (0-4)
- ✅ Tax calculation and application
- ✅ Token transfer validation
- ✅ NFT minting authorization
- ✅ Bonus calculation with randomness
- ✅ Vesting state initialization

**Case Study - Invalid Tier Attack**:
```rust
// Attacker tries to use invalid tier
let malicious_tier = 10; // Invalid tier
swap_defai_for_pnft_v6(ctx, malicious_tier, uri, name, symbol)?; // Should fail
```
**Mitigation**: Tier bounds checking in swap logic

**Case Study - Tax Manipulation Attack**:
```rust
// Attacker tries to manipulate tax calculation
let user_tax_rate = user_tax_state.tax_rate_bps;
let swap_count = user_tax_state.swap_count;
// new_tax_rate = min(INITIAL_TAX_BPS + (swap_count * TAX_INCREMENT_BPS), TAX_CAP_BPS)
// If overflow occurs, tax becomes 0
```
**Mitigation**: Safe arithmetic operations in tax calculation

#### 16. `swap_old_defai_for_pnft_v6`
**Purpose**: Swap old DEFAI tokens for bonus NFT (v6)

**Parameters**:
- `tier: u8` - NFT tier (0-4)
- `_metadata_uri: String` - Metadata URI
- `_name: String` - NFT name
- `_symbol: String` - NFT symbol

**Accounts**:
- `user` - User (signer)
- `user_old` - User's old DEFAI token account
- `burn_old` - Burn account for old tokens
- `config` - Program configuration
- `collection_config` - Collection configuration
- `nft_mint` - NFT mint to be created
- `nft_token_account` - NFT token account
- `bonus_state` - PDA with seed `["bonus_v6", nft_mint.key()]`
- `vesting_state` - PDA with seed `["vesting_v6", nft_mint.key()]`
- `escrow` - Escrow account
- `user_tax_state` - User's tax state

**Security Considerations**:
- ✅ Old token burn validation
- ✅ Same security as DEFAI swap
- ✅ Token program validation

### Redemption Functions

#### 17. `redeem_v6`
**Purpose**: Redeem NFT for DEFAI tokens

**Accounts**:
- `user` - User (signer)
- `nft_mint` - NFT mint
- `user_nft_ata` - User's NFT token account
- `user_defai_ata` - User's DEFAI token account
- `escrow_defai_ata` - Escrow's DEFAI token account
- `defai_mint` - DEFAI mint
- `config` - Program configuration
- `escrow` - Escrow account
- `bonus_state` - Bonus state
- `vesting_state` - Vesting state

**Security Considerations**:
- ✅ NFT ownership validation
- ✅ Redemption eligibility check
- ✅ Token transfer safety
- ✅ State cleanup

**Case Study - Double Redemption Attack**:
```rust
// Attacker tries to redeem same NFT twice
redeem_v6(ctx)?;
redeem_v6(ctx)?; // Should fail - NFT already redeemed
```
**Mitigation**: Redemption state tracking and validation

#### 18. `claim_vested_v6`
**Purpose**: Claim vested DEFAI tokens

**Accounts**:
- `user` - User (signer)
- `nft_mint` - NFT mint
- `user_nft_ata` - User's NFT token account
- `user_defai_ata` - User's DEFAI token account
- `escrow_defai_ata` - Escrow's DEFAI token account
- `defai_mint` - DEFAI mint
- `config` - Program configuration
- `escrow` - Escrow account
- `vesting_state` - Vesting state

**Security Considerations**:
- ✅ NFT ownership validation
- ✅ Vesting period validation
- ✅ Cliff period check
- ✅ Claim amount calculation

**Case Study - Early Vesting Claim Attack**:
```rust
// Attacker tries to claim before cliff period
let current_time = Clock::get()?.unix_timestamp;
let cliff_end = vesting_state.start_timestamp + CLIFF_DURATION;
if current_time < cliff_end {
    claim_vested_v6(ctx)?; // Should fail
}
```
**Mitigation**: Cliff period validation in claim logic

### Bonus Management Functions

#### 19. `reroll_bonus_v6`
**Purpose**: Reroll NFT bonus (requires DEFAI payment)

**Accounts**:
- `user` - User (signer)
- `nft_mint` - NFT mint
- `user_nft_ata` - User's NFT token account
- `user_defai_ata` - User's DEFAI token account
- `defai_mint` - DEFAI mint
- `bonus_state` - Bonus state
- `vesting_state` - Vesting state
- `config` - Program configuration
- `user_tax_state` - User's tax state

**Security Considerations**:
- ✅ NFT ownership validation
- ✅ Reroll fee payment
- ✅ New bonus calculation
- ✅ Tax application

**Case Study - Insufficient Reroll Fee Attack**:
```rust
// Attacker tries to reroll without paying fee
let user_balance = user_defai_ata.amount;
let reroll_fee = get_tier_price(tier);
if user_balance < reroll_fee {
    reroll_bonus_v6(ctx)?; // Should fail
}
```
**Mitigation**: Balance validation before reroll

#### 20. `update_nft_metadata_v6`
**Purpose**: Update NFT metadata

**Accounts**:
- `nft_mint` - NFT mint
- `bonus_state` - Bonus state
- `vesting_state` - Vesting state

**Security Considerations**:
- ✅ Metadata update authorization
- ✅ State consistency

### Administrative Functions

#### 21. `admin_withdraw`
**Purpose**: Admin withdrawal from escrow

**Parameters**:
- `amount: u64` - Amount to withdraw

**Accounts**:
- `admin` - Admin (signer)
- `source_vault` - Source vault
- `dest` - Destination account
- `config` - Program configuration
- `escrow` - Escrow account

**Security Considerations**:
- ✅ Admin authorization
- ✅ Withdrawal amount validation
- ✅ Vault balance check

## Data Structures

### Config
```rust
pub struct Config {
    pub admin: Pubkey,
    pub old_mint: Pubkey,
    pub new_mint: Pubkey,
    pub collection: Pubkey,
    pub treasury: Pubkey,
    pub prices: [u64; 5],
    pub paused: bool,
    pub pending_admin: Option<Pubkey>,
    pub admin_change_timestamp: i64,
    pub vrf_enabled: bool,
}
```

### BonusStateV6
```rust
pub struct BonusStateV6 {
    pub mint: Pubkey,
    pub tier: u8,
    pub bonus_bps: u16,
    pub vesting_start: i64,
    pub vesting_duration: i64,
    pub claimed: bool,
    pub fee_deducted: u64,
}
```

### VestingStateV6
```rust
pub struct VestingStateV6 {
    pub mint: Pubkey,
    pub total_amount: u64,
    pub released_amount: u64,
    pub start_timestamp: i64,
    pub end_timestamp: i64,
    pub last_claimed_timestamp: i64,
}
```

### UserTaxState
```rust
pub struct UserTaxState {
    pub user: Pubkey,
    pub tax_rate_bps: u16,
    pub last_swap_timestamp: i64,
    pub swap_count: u32,
}
```

### VrfState
```rust
pub struct VrfState {
    pub bump: u8,
    pub result_buffer: [u8; 32],
    pub last_timestamp: i64,
    pub vrf_account: Pubkey,
}
```

## Tax System

### Progressive Tax Formula
```rust
// Initial tax rate
let initial_tax = INITIAL_TAX_BPS; // 5%

// Tax increment per swap
let tax_increment = TAX_INCREMENT_BPS; // 1%

// Maximum tax cap
let tax_cap = TAX_CAP_BPS; // 30%

// Calculate new tax rate
let new_tax_rate = min(
    initial_tax + (swap_count * tax_increment),
    tax_cap
);
```

### Tax Reset Conditions
- Tax resets after `TAX_RESET_DURATION` (24 hours) of inactivity
- Reset reduces tax rate back to `INITIAL_TAX_BPS`

## Randomness System

### Secure Randomness Generation
```rust
pub fn generate_secure_random(
    user: &Pubkey,
    nft_mint: &Pubkey,
    clock: &Clock,
    recent_blockhash: &[u8; 32],
) -> u64 {
    let mut data = Vec::new();
    data.extend_from_slice(&user.to_bytes());
    data.extend_from_slice(&nft_mint.to_bytes());
    data.extend_from_slice(&clock.unix_timestamp.to_le_bytes());
    data.extend_from_slice(&clock.slot.to_le_bytes());
    data.extend_from_slice(recent_blockhash);
    data.extend_from_slice(&clock.epoch.to_le_bytes());
    
    let hash = keccak::hash(&data);
    let mut bytes = [0u8; 8];
    bytes.copy_from_slice(&hash.to_bytes()[0..8]);
    u64::from_le_bytes(bytes)
}
```

### VRF Integration
- Uses Switchboard VRF for cryptographically secure randomness
- VRF results are stored in `VrfState`
- Randomness is consumed for bonus calculations

## Error Handling

### ErrorCode Enum
```rust
pub enum ErrorCode {
    InsufficientOldTokens,
    InsufficientDefaiTokens,
    NoLiquidity,
    InvalidCollection,
    MathOverflow,
    NftAlreadyRedeemed,
    NoNft,
    InvalidInput,
    InvalidTreasury,
    Unauthorized,
    InvalidTier,
    AlreadyClaimed,
    InvalidMerkleProof,
    StillInCliff,
    NothingToClaim,
    TaxResetTooEarly,
    AlreadyPaused,
    NotPaused,
    ProtocolPaused,
    InvalidMint,
    InsufficientDefaiForReroll,
    NoPendingAdminChange,
    TimelockNotExpired,
}
```

## Events

### SwapExecuted
```rust
pub struct SwapExecuted {
    pub user: Pubkey,
    pub tier: u8,
    pub price: u64,
    pub tax_amount: u64,
    pub bonus_bps: u16,
    pub nft_mint: Pubkey,
    pub timestamp: i64,
}
```

### RedemptionExecuted
```rust
pub struct RedemptionExecuted {
    pub user: Pubkey,
    pub nft_mint: Pubkey,
    pub amount_returned: u64,
    pub fees_deducted: u64,
    pub timestamp: i64,
}
```

### VestingClaimed
```rust
pub struct VestingClaimed {
    pub user: Pubkey,
    pub nft_mint: Pubkey,
    pub amount_claimed: u64,
    pub total_vested: u64,
    pub timestamp: i64,
}
```

### BonusRerolled
```rust
pub struct BonusRerolled {
    pub user: Pubkey,
    pub nft_mint: Pubkey,
    pub old_bonus_bps: u16,
    pub new_bonus_bps: u16,
    pub tax_paid: u64,
    pub timestamp: i64,
}
```

## Security Audit Checklist

### Access Control
- [ ] Admin authorization in all admin functions
- [ ] User authorization in user functions
- [ ] PDA derivation validation
- [ ] Signer verification

### Input Validation
- [ ] Tier bounds checking (0-4)
- [ ] Price array validation
- [ ] Amount bounds checking
- [ ] String length limits

### Arithmetic Safety
- [ ] Overflow protection with `checked_*` operations
- [ ] Division by zero prevention
- [ ] Underflow protection
- [ ] Tax calculation accuracy

### Token Operations
- [ ] SPL Token transfer validation
- [ ] Token-2022 integration
- [ ] NFT minting authorization
- [ ] Token account ownership checks

### Randomness Security
- [ ] VRF integration validation
- [ ] Randomness source verification
- [ ] Bonus calculation fairness
- [ ] Entropy source validation

### State Management
- [ ] Vesting state consistency
- [ ] Bonus state tracking
- [ ] Tax state management
- [ ] Redemption state validation

### Timelock Security
- [ ] Admin change timelock (48h)
- [ ] Timelock validation
- [ ] Pending state management

### Economic Safety
- [ ] Tax calculation accuracy
- [ ] Bonus distribution fairness
- [ ] Vesting schedule enforcement
- [ ] Reroll fee validation

## Known Issues & Mitigations

### 1. Randomness Source
**Issue**: Blockhash-based randomness can be manipulated
**Mitigation**: VRF integration for cryptographically secure randomness

### 2. Tax Reset Timing
**Issue**: Tax reset timing could be manipulated
**Mitigation**: Strict timestamp validation and reasonable reset periods

### 3. Vesting Precision
**Issue**: Small vesting amounts may not claim due to integer division
**Mitigation**: Proper rounding and minimum claim amounts

## Testing Scenarios

### 1. Normal Swap Flow
```rust
// 1. Initialize program
initialize(ctx, prices)?;

// 2. Initialize user tax
initialize_user_tax(ctx)?;

// 3. Swap DEFAI for NFT
swap_defai_for_pnft_v6(ctx, 2, uri, name, symbol)?; // Tier 2

// 4. Claim vested tokens
claim_vested_v6(ctx)?;

// 5. Redeem NFT
redeem_v6(ctx)?;
```

### 2. Tax Progression
```rust
// 1. First swap (5% tax)
swap_defai_for_pnft_v6(ctx, 1, uri, name, symbol)?;

// 2. Second swap (6% tax)
swap_defai_for_pnft_v6(ctx, 1, uri, name, symbol)?;

// 3. Third swap (7% tax)
swap_defai_for_pnft_v6(ctx, 1, uri, name, symbol)?;

// 4. Wait 24 hours and reset tax
reset_user_tax(ctx)?; // Back to 5%
```

### 3. Bonus Reroll
```rust
// 1. Swap for NFT
swap_defai_for_pnft_v6(ctx, 3, uri, name, symbol)?;

// 2. Check initial bonus
let initial_bonus = bonus_state.bonus_bps;

// 3. Reroll bonus
reroll_bonus_v6(ctx)?;

// 4. Check new bonus
let new_bonus = bonus_state.bonus_bps;
```

### 4. Edge Cases
```rust
// Maximum tier
swap_defai_for_pnft_v6(ctx, 4, uri, name, symbol)?; // Rocket tier

// Minimum tier
swap_defai_for_pnft_v6(ctx, 0, uri, name, symbol)?; // OG tier

// Early vesting claim
claim_vested_v6(ctx)?; // Should fail before cliff
```

### 5. Attack Vectors
```rust
// Invalid tier attack
swap_defai_for_pnft_v6(ctx, 10, uri, name, symbol)?; // Should fail

// Double redemption attack
redeem_v6(ctx)?;
redeem_v6(ctx)?; // Should fail

// Unauthorized admin action
update_prices(ctx, malicious_prices)?; // Should fail
```

## Recommendations for Auditors

1. **Focus on randomness** - Verify VRF integration and bonus fairness
2. **Check tax calculations** - Validate progressive tax system
3. **Test vesting logic** - Ensure proper time-based vesting
4. **Review token operations** - Validate SPL Token and Token-2022 usage
5. **Verify admin controls** - Check timelock and authorization
6. **Test edge cases** - Boundary conditions and extreme values
7. **Validate state consistency** - Ensure proper state transitions
8. **Check arithmetic safety** - Verify all mathematical operations

## Dependencies
- `anchor-lang`: Core Anchor framework
- `anchor-spl`: SPL Token integration
- `anchor-spl::token_2022`: Token-2022 integration
- `solana-program`: Solana program interface 