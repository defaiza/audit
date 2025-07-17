# DeFi Staking Program - Security Audit Documentation

## Program Overview
**Program ID:** `6t8UH9GGn3ZRMkFvV5CqSe1Rs9fYzQpeEkv4hbDPG6zd`

The DeFi Staking program implements a tiered staking system for DEFAI tokens with sustainable economics, reward distribution, and compound interest mechanisms. The program features three staking tiers (Gold, Titanium, Infinite) with different APY rates and minimum staking requirements.

## Architecture

### Core Components
- **Tiered Staking**: Three tiers with different APY rates and minimums
- **Reward Escrow**: Secure reward distribution mechanism
- **Compound Interest**: Automatic reward reinvestment
- **Unstaking Penalties**: Time-based penalty system
- **Admin Controls**: Timelock-protected administrative functions

### Key Constants
- `GOLD_MIN`: 10M DEFAI (minimum for Gold tier)
- `GOLD_MAX`: 99.99M DEFAI (maximum for Gold tier)
- `GOLD_APY_BPS`: 50 (0.5% APY)
- `TITANIUM_MIN`: 100M DEFAI (minimum for Titanium tier)
- `TITANIUM_MAX`: 999.99M DEFAI (maximum for Titanium tier)
- `TITANIUM_APY_BPS`: 75 (0.75% APY)
- `INFINITE_MIN`: 1B DEFAI (minimum for Infinite tier)
- `INFINITE_APY_BPS`: 100 (1% APY)
- `SECONDS_PER_YEAR`: 31,536,000
- `BASIS_POINTS`: 10,000
- `ADMIN_TIMELOCK_DURATION`: 48 hours

## Functions & Instructions

### Initialization Functions

#### 1. `initialize_program`
**Purpose**: Initialize the staking program state

**Parameters**:
- `defai_mint: Pubkey` - DEFAI token mint address

**Accounts**:
- `program_state` - PDA with seed `["program-state"]`
- `stake_vault` - PDA with seed `["stake-vault", program_state.key()]`
- `authority` - Program authority (signer)
- `defai_mint` - DEFAI token mint

**Security Considerations**:
- ✅ Authority validation
- ✅ Mint address validation
- ✅ PDA derivation validation

**Case Study - Invalid Mint Attack**:
```rust
// Attacker tries to initialize with malicious mint
let malicious_mint = attacker_mint_key;
initialize_program(ctx, malicious_mint)?; // Should validate mint
```
**Mitigation**: Mint address validation and authority checks

#### 2. `initialize_escrow`
**Purpose**: Initialize the reward escrow system

**Accounts**:
- `program_state` - Program state
- `reward_escrow` - PDA with seed `["reward-escrow", program_state.key()]`
- `escrow_token_account` - PDA with seed `["escrow-vault", program_state.key()]`
- `authority` - Program authority (signer)

**Security Considerations**:
- ✅ Authority validation
- ✅ Escrow bump persistence
- ✅ Token account initialization

### Escrow Management Functions

#### 3. `fund_escrow`
**Purpose**: Fund the reward escrow with DEFAI tokens

**Parameters**:
- `amount: u64` - Amount to fund

**Accounts**:
- `reward_escrow` - Reward escrow account
- `escrow_token_account` - Escrow's token account
- `funder_token_account` - Funder's token account
- `funder` - Funder (signer)
- `defai_mint` - DEFAI token mint

**Security Considerations**:
- ✅ Token transfer validation
- ✅ Escrow balance update
- ✅ Transfer amount validation

**Case Study - Insufficient Balance Attack**:
```rust
// Attacker tries to fund more than they have
let malicious_amount = u64::MAX;
fund_escrow(ctx, malicious_amount)?; // Should fail if insufficient balance
```
**Mitigation**: SPL Token transfer validation prevents insufficient balance transfers

### Staking Functions

#### 4. `stake_tokens`
**Purpose**: Stake DEFAI tokens and earn rewards

**Parameters**:
- `amount: u64` - Amount to stake

**Accounts**:
- `program_state` - Program state
- `user_stake` - PDA with seed `["user-stake", user.key()]`
- `stake_vault` - Staking vault
- `user_token_account` - User's token account
- `defai_mint` - DEFAI token mint
- `user` - Staker (signer)

**Security Considerations**:
- ✅ Program pause check
- ✅ Minimum amount validation (≥ GOLD_MIN)
- ✅ Token transfer validation
- ✅ Tier calculation accuracy
- ✅ Reward calculation precision

**Case Study - Below Minimum Attack**:
```rust
// Attacker tries to stake below minimum
let malicious_amount = GOLD_MIN - 1;
stake_tokens(ctx, malicious_amount)?; // Should fail
```
**Mitigation**: `require!(amount >= GOLD_MIN, StakingError::AmountTooLow)`

**Case Study - Reward Calculation Attack**:
```rust
// Attacker tries to manipulate reward calculation
let staked_amount = 100_000_000; // 100M DEFAI
let tier_apy_bps = 75; // 0.75%
let time_diff = 365 * 24 * 60 * 60; // 1 year
// rewards = staked_amount * tier_apy_bps * time_diff / (SECONDS_PER_YEAR * BASIS_POINTS)
// If overflow occurs, rewards become 0
```
**Mitigation**: `checked_mul()` and `checked_div()` operations prevent overflow

#### 5. `unstake_tokens`
**Purpose**: Unstake tokens with time-based penalties

**Parameters**:
- `amount: u64` - Amount to unstake

**Accounts**:
- `program_state` - Program state
- `user_stake` - User's stake account
- `stake_vault` - Staking vault
- `user_token_account` - User's token account
- `reward_escrow` - Reward escrow
- `escrow_token_account` - Escrow's token account
- `defai_mint` - DEFAI token mint
- `user` - Staker (signer)

**Security Considerations**:
- ✅ Lock period validation
- ✅ Sufficient balance check
- ✅ Penalty calculation accuracy
- ✅ Reward distribution
- ✅ Tier recalculation

**Case Study - Early Unstaking Attack**:
```rust
// Attacker tries to unstake before lock period expires
let current_time = Clock::get()?.unix_timestamp;
let lock_time = user_stake.locked_until;
if current_time < lock_time {
    unstake_tokens(ctx, amount)?; // Should fail
}
```
**Mitigation**: `require!(clock.unix_timestamp >= user_stake.locked_until, StakingError::TokensLocked)`

**Case Study - Penalty Manipulation Attack**:
```rust
// Attacker tries to manipulate penalty calculation
let stake_timestamp = 0; // Very old stake
let current_timestamp = Clock::get()?.unix_timestamp;
let amount = 100_000_000;
// penalty = calculate_unstake_penalty(stake_timestamp, current_timestamp, amount)
// If calculation overflows, penalty becomes 0
```
**Mitigation**: Safe arithmetic operations in penalty calculation

#### 6. `claim_rewards`
**Purpose**: Claim earned rewards from staking

**Accounts**:
- `program_state` - Program state
- `user_stake` - User's stake account
- `reward_escrow` - Reward escrow
- `escrow_token_account` - Escrow's token account
- `user_token_account` - User's token account
- `defai_mint` - DEFAI token mint
- `user` - Claimer (signer)

**Security Considerations**:
- ✅ Reward availability check
- ✅ Escrow balance validation
- ✅ Token transfer safety
- ✅ Reward state update

**Case Study - Empty Escrow Attack**:
```rust
// Attacker tries to claim when escrow is empty
let escrow_balance = reward_escrow.total_balance;
if escrow_balance == 0 {
    claim_rewards(ctx)?; // Should fail
}
```
**Mitigation**: Escrow balance validation before transfer

#### 7. `compound_rewards`
**Purpose**: Compound earned rewards back into staking

**Accounts**:
- `program_state` - Program state
- `user_stake` - User's stake account
- `reward_escrow` - Reward escrow
- `user` - User (signer)

**Security Considerations**:
- ✅ Reward availability check
- ✅ Tier recalculation
- ✅ State consistency

**Case Study - Tier Upgrade Attack**:
```rust
// Attacker compounds rewards to upgrade tier
let old_tier = user_stake.tier;
compound_rewards(ctx)?;
let new_tier = user_stake.tier;
// Should properly recalculate tier based on new total
```
**Mitigation**: Proper tier calculation after compounding

### Administrative Functions

#### 8. `propose_authority_change`
**Purpose**: Propose authority change with timelock

**Parameters**:
- `new_authority: Pubkey` - New authority address

**Accounts**:
- `program_state` - Program state
- `authority` - Current authority (signer)

**Security Considerations**:
- ✅ Authority authorization
- ✅ Timelock implementation (48 hours)

**Case Study - Unauthorized Authority Change**:
```rust
// Attacker tries to change authority
let malicious_authority = attacker_key;
propose_authority_change(ctx, malicious_authority)?; // Should fail
```
**Mitigation**: `has_one = authority` constraint

#### 9. `accept_authority_change`
**Purpose**: Execute authority change after timelock expires

**Accounts**:
- `program_state` - Program state
- `authority` - Current authority (signer)

**Security Considerations**:
- ✅ Timelock validation
- ✅ Pending authority existence check

#### 10. `pause_program`
**Purpose**: Pause/unpause the staking program

**Parameters**:
- `paused: bool` - Pause state

**Accounts**:
- `program_state` - Program state
- `authority` - Program authority (signer)

**Security Considerations**:
- ✅ Authority authorization
- ✅ Pause state management

## Data Structures

### ProgramState
```rust
pub struct ProgramState {
    pub authority: Pubkey,
    pub defai_mint: Pubkey,
    pub total_staked: u64,
    pub total_users: u64,
    pub paused: bool,
    pub vault_bump: u8,
    pub escrow_bump: u8,
    pub pending_authority: Option<Pubkey>,
    pub authority_change_timestamp: i64,
}
```

### RewardEscrow
```rust
pub struct RewardEscrow {
    pub authority: Pubkey,
    pub total_balance: u64,
    pub total_distributed: u64,
    pub bump: u8,
}
```

### UserStake
```rust
pub struct UserStake {
    pub owner: Pubkey,
    pub staked_amount: u64,
    pub rewards_earned: u64,
    pub rewards_claimed: u64,
    pub tier: u8,
    pub stake_timestamp: i64,
    pub last_claim_timestamp: i64,
    pub locked_until: i64,
}
```

## Tier System

### Gold Tier
- **Minimum**: 10M DEFAI
- **Maximum**: 99.99M DEFAI
- **APY**: 0.5% (50 basis points)

### Titanium Tier
- **Minimum**: 100M DEFAI
- **Maximum**: 999.99M DEFAI
- **APY**: 0.75% (75 basis points)

### Infinite Tier
- **Minimum**: 1B DEFAI
- **Maximum**: Unlimited
- **APY**: 1% (100 basis points)

## Reward Calculation

### Formula
```rust
fn calculate_rewards(
    staked_amount: u64,
    tier_apy_bps: u16,
    last_claim_timestamp: i64,
    current_timestamp: i64,
) -> Result<u64> {
    let time_diff = current_timestamp.checked_sub(last_claim_timestamp)
        .ok_or(StakingError::MathOverflow)?;
    
    let rewards = staked_amount
        .checked_mul(tier_apy_bps as u64)
        .ok_or(StakingError::MathOverflow)?
        .checked_mul(time_diff)
        .ok_or(StakingError::MathOverflow)?
        .checked_div(SECONDS_PER_YEAR)
        .ok_or(StakingError::MathOverflow)?
        .checked_div(BASIS_POINTS)
        .ok_or(StakingError::MathOverflow)?;
    
    Ok(rewards)
}
```

### Unstaking Penalty
```rust
fn calculate_unstake_penalty(
    stake_timestamp: i64,
    current_timestamp: i64,
    amount: u64,
) -> Result<u64> {
    let time_staked = current_timestamp.checked_sub(stake_timestamp)
        .ok_or(StakingError::MathOverflow)?;
    
    // 7-day initial lock period
    if time_staked < 7 * 24 * 60 * 60 {
        return Ok(amount.checked_div(10).unwrap_or(0)); // 10% penalty
    }
    
    // 30-day full lock period
    if time_staked < 30 * 24 * 60 * 60 {
        return Ok(amount.checked_div(20).unwrap_or(0)); // 5% penalty
    }
    
    Ok(0) // No penalty after 30 days
}
```

## Error Handling

### StakingError Enum
```rust
pub enum StakingError {
    AmountTooLow,              // Below minimum tier requirement
    InsufficientStake,         // Not enough staked tokens
    TokensLocked,              // Tokens still in lock period
    NoRewards,                 // No rewards available to claim
    InvalidAuthority,          // Unauthorized authority
    InvalidOwner,              // Wrong stake owner
    ProgramPaused,             // Program is paused
    InsufficientEscrowBalance, // Escrow has insufficient funds
    NoPendingAuthorityChange,  // No pending authority change
    TimelockNotExpired,        // Timelock period not expired
}
```

## Events

### StakeEvent
```rust
pub struct StakeEvent {
    pub user: Pubkey,
    pub amount: u64,
    pub tier: u8,
    pub total_staked: u64,
}
```

### UnstakeEvent
```rust
pub struct UnstakeEvent {
    pub user: Pubkey,
    pub amount: u64,
    pub penalty: u64,
    pub remaining_stake: u64,
    pub new_tier: u8,
}
```

### RewardsClaimedEvent
```rust
pub struct RewardsClaimedEvent {
    pub user: Pubkey,
    pub amount: u64,
    pub total_distributed: u64,
}
```

### EscrowFundedEvent
```rust
pub struct EscrowFundedEvent {
    pub funder: Pubkey,
    pub amount: u64,
    pub new_balance: u64,
}
```

## Security Audit Checklist

### Access Control
- [ ] Authority validation in admin functions
- [ ] Owner validation in user functions
- [ ] PDA derivation validation
- [ ] Signer verification

### Input Validation
- [ ] Minimum staking amounts
- [ ] Maximum staking limits
- [ ] Amount bounds checking
- [ ] Timestamp validation

### Arithmetic Safety
- [ ] Overflow protection with `checked_*` operations
- [ ] Division by zero prevention
- [ ] Underflow protection
- [ ] Precision loss prevention

### Token Operations
- [ ] SPL Token transfer validation
- [ ] Token account ownership checks
- [ ] Vault authority verification
- [ ] Escrow balance management

### State Management
- [ ] Tier calculation accuracy
- [ ] Reward tracking precision
- [ ] Lock period enforcement
- [ ] Penalty calculation correctness

### Timelock Security
- [ ] Authority change timelock (48h)
- [ ] Timelock validation
- [ ] Pending state management

### Economic Safety
- [ ] APY calculation accuracy
- [ ] Reward distribution fairness
- [ ] Penalty calculation logic
- [ ] Escrow funding validation

## Known Issues & Mitigations

### 1. Reward Calculation Precision
**Issue**: Small staking amounts may earn 0 rewards due to integer division
**Mitigation**: Use basis points for precise APY representation

### 2. Tier Boundary Conditions
**Issue**: Staking exactly at tier boundaries could cause confusion
**Mitigation**: Clear tier definitions with inclusive/exclusive bounds

### 3. Timestamp Manipulation
**Issue**: Block timestamps could be manipulated by validators
**Mitigation**: Use relative time differences and reasonable bounds

## Testing Scenarios

### 1. Normal Staking Flow
```rust
// 1. Initialize program
initialize_program(ctx, defai_mint)?;

// 2. Initialize escrow
initialize_escrow(ctx)?;

// 3. Fund escrow
fund_escrow(ctx, 1000000000)?; // 1B DEFAI

// 4. Stake tokens
stake_tokens(ctx, 50000000)?; // 50M DEFAI (Gold tier)

// 5. Claim rewards
claim_rewards(ctx)?;

// 6. Unstake tokens
unstake_tokens(ctx, 25000000)?; // 25M DEFAI
```

### 2. Tier Upgrades
```rust
// 1. Start with Gold tier
stake_tokens(ctx, 50000000)?; // 50M DEFAI

// 2. Add more to reach Titanium
stake_tokens(ctx, 60000000)?; // 110M DEFAI total

// 3. Add more to reach Infinite
stake_tokens(ctx, 900000000)?; // 1.01B DEFAI total
```

### 3. Edge Cases
```rust
// Minimum staking amount
stake_tokens(ctx, GOLD_MIN)?; // Exactly 10M DEFAI

// Maximum tier amounts
stake_tokens(ctx, GOLD_MAX)?; // 99.99M DEFAI
stake_tokens(ctx, TITANIUM_MAX)?; // 999.99M DEFAI

// Early unstaking with penalty
stake_tokens(ctx, 10000000)?;
// Wait 3 days
unstake_tokens(ctx, 5000000)?; // 10% penalty
```

### 4. Attack Vectors
```rust
// Below minimum attack
stake_tokens(ctx, GOLD_MIN - 1)?; // Should fail

// Early unstaking attack
stake_tokens(ctx, 10000000)?;
// Immediately try to unstake
unstake_tokens(ctx, 10000000)?; // Should fail

// Empty escrow claim
claim_rewards(ctx)?; // Should fail if no rewards
```

## Recommendations for Auditors

1. **Focus on arithmetic operations** - Check all `checked_*` operations
2. **Verify tier calculations** - Ensure proper tier assignment and upgrades
3. **Test reward calculations** - Validate APY and time-based rewards
4. **Check penalty logic** - Verify unstaking penalty calculations
5. **Review escrow management** - Ensure proper reward distribution
6. **Test timelock mechanisms** - Verify authority change delays
7. **Validate token transfers** - Check all SPL Token operations
8. **Test edge cases** - Minimum amounts, boundary conditions, etc.

## Dependencies
- `anchor-lang`: Core Anchor framework
- `anchor-spl`: SPL Token interface integration
- `solana-program`: Solana program interface 