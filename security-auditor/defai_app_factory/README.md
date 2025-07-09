# DeFi App Factory Program - Security Audit Documentation

## Program Overview
**Program ID:** `4cxwMECNtqo5CEFYEU5aArZDL5CUs64H1imobByYA261`

The DeFi App Factory is a platform that allows creators to register applications and users to purchase access to these applications using DEFAI tokens. The program implements a fee-splitting mechanism between platform and creators, with SFT (Semi-Fungible Token) minting for access control.

## Architecture

### Core Accounts
- **AppFactory**: Global program state and configuration
- **AppRegistration**: Individual app registration data
- **UserAppAccess**: User's access records for specific apps

### Key Constants
- `APP_REGISTRATION_SEED`: `b"app_registration"`
- `MAX_METADATA_URI_LEN`: 100 characters
- Platform fee basis points: 2000 (20%) by default

## Functions & Instructions

### 1. `initialize_app_factory`
**Purpose**: Initialize the global app factory state

**Parameters**:
- `platform_fee_bps: u16` - Platform fee in basis points (max 10000 = 100%)

**Accounts**:
- `app_factory` - PDA with seed `["app_factory"]`
- `authority` - Program authority (signer)
- `defai_mint` - DEFAI token mint address
- `treasury` - Platform treasury wallet
- `master_collection` - Master collection mint for "DEFAI APPs"

**Security Considerations**:
- ✅ Authority validation
- ✅ Platform fee bounds checking (≤ 10000 bps)
- ✅ PDA derivation validation

**Case Study - Fee Configuration Attack**:
```rust
// Attacker tries to set 150% platform fee
let malicious_fee = 15000; // 150%
initialize_app_factory(ctx, malicious_fee)?; // Should fail
```
**Mitigation**: `require!(platform_fee_bps <= 10000, AppFactoryError::InvalidPlatformFee)`

### 2. `register_app`
**Purpose**: Register a new application for sale

**Parameters**:
- `price: u64` - Price in DEFAI tokens
- `max_supply: u64` - Maximum number of SFTs that can be minted
- `metadata_uri: String` - IPFS URI for app metadata

**Accounts**:
- `app_factory` - Global factory state
- `app_registration` - PDA with seed `["app_registration", app_id]`
- `sft_mint` - SFT mint for this app
- `creator` - App creator (signer)

**Security Considerations**:
- ✅ Price validation (> 0)
- ✅ Max supply validation (> 0)
- ✅ Metadata URI length limit
- ✅ Math overflow protection
- ✅ Creator authorization

**Case Study - Supply Overflow Attack**:
```rust
// Attacker tries to create app with max u64 supply
let malicious_supply = u64::MAX;
register_app(ctx, 1000, malicious_supply, "ipfs://...")?;
// Later: current_supply.checked_add(1) would overflow
```
**Mitigation**: `checked_add()` operations prevent overflow

### 3. `purchase_app_access_v2` (Optimized)
**Purpose**: Purchase access to an app (optimized version to prevent stack overflow)

**Parameters**:
- `app_id: u64` - App identifier

**Accounts**:
- `app_factory` - Global factory state
- `app_registration` - App registration data
- `user_app_access` - User's access record
- `sft_mint` - App's SFT mint
- `user_sft_ata` - User's SFT token account
- `user_defai_ata` - User's DEFAI token account
- `creator_defai_ata` - Creator's DEFAI token account
- `treasury_defai_ata` - Treasury's DEFAI token account
- `user` - Purchaser (signer)

**Security Considerations**:
- ✅ App active status check
- ✅ Supply limit validation
- ✅ Fee calculation with overflow protection
- ✅ Token transfer validation
- ✅ SFT minting with proper authority
- ✅ Access record creation

**Case Study - Double Purchase Attack**:
```rust
// Attacker tries to purchase same app twice
purchase_app_access_v2(ctx, app_id)?;
purchase_app_access_v2(ctx, app_id)?; // Should fail - duplicate user_app_access
```
**Mitigation**: PDA seed includes user and app_id, preventing duplicates

**Case Study - Fee Manipulation Attack**:
```rust
// Attacker tries to manipulate fee calculation
let price = 1000;
let platform_fee_bps = 2000; // 20%
// platform_fee = price * platform_fee_bps / 10000 = 200
// creator_amount = price - platform_fee = 800
// If overflow occurs, creator gets nothing
```
**Mitigation**: `checked_mul()` and `checked_div()` prevent overflow

### 4. `toggle_app_status`
**Purpose**: Enable/disable app purchases (creator only)

**Parameters**:
- `app_id: u64` - App identifier

**Accounts**:
- `app_registration` - App registration data
- `creator` - App creator (signer)

**Security Considerations**:
- ✅ Creator authorization check
- ✅ App existence validation

**Case Study - Unauthorized Toggle Attack**:
```rust
// Attacker tries to disable someone else's app
let malicious_creator = attacker_keypair;
toggle_app_status(ctx, victim_app_id)?; // Should fail
```
**Mitigation**: `has_one = creator` constraint

### 5. `update_platform_settings`
**Purpose**: Update global platform settings (authority only)

**Parameters**:
- `new_platform_fee_bps: Option<u16>` - New platform fee
- `new_treasury: Option<Pubkey>` - New treasury address

**Accounts**:
- `app_factory` - Global factory state
- `authority` - Program authority (signer)

**Security Considerations**:
- ✅ Authority authorization check
- ✅ Fee bounds validation
- ✅ Treasury address validation

## Data Structures

### AppFactory
```rust
pub struct AppFactory {
    pub authority: Pubkey,              // Platform authority
    pub defai_mint: Pubkey,             // DEFAI token mint
    pub treasury: Pubkey,               // Platform treasury
    pub master_collection: Pubkey,      // Master collection mint
    pub platform_fee_bps: u16,         // Platform fee (basis points)
    pub total_apps: u64,                // Total registered apps
    pub bump: u8,                       // PDA bump seed
}
```

### AppRegistration
```rust
pub struct AppRegistration {
    pub app_id: u64,                    // Unique app identifier
    pub creator: Pubkey,                // App creator
    pub sft_mint: Pubkey,               // SFT mint address
    pub price: u64,                     // Price in DEFAI tokens
    pub max_supply: u64,                // Maximum SFT supply
    pub current_supply: u64,            // Current SFT supply
    pub is_active: bool,                // Purchase status
    pub metadata_uri: String,           // IPFS metadata URI
    pub created_at: i64,                // Creation timestamp
    pub bump: u8,                       // PDA bump seed
}
```

### UserAppAccess
```rust
pub struct UserAppAccess {
    pub user: Pubkey,                   // User wallet
    pub app_id: u64,                    // App identifier
    pub sft_token_account: Pubkey,      // User's SFT token account
    pub purchased_at: i64,              // Purchase timestamp
    pub bump: u8,                       // PDA bump seed
}
```

## Error Handling

### AppFactoryError Enum
```rust
pub enum AppFactoryError {
    InvalidPlatformFee,     // Fee > 10000 bps
    InvalidPrice,           // Price <= 0
    InvalidMaxSupply,       // Max supply <= 0
    MetadataUriTooLong,     // URI > 100 chars
    AppNotActive,           // App disabled
    MaxSupplyReached,       // Supply limit exceeded
    MathOverflow,           // Arithmetic overflow
    UnauthorizedCreator,    // Wrong creator
    UnauthorizedAuthority,  // Wrong authority
    InvalidCreator,         // Invalid creator address
    InvalidTreasury,        // Invalid treasury address
    InvalidDefaiMint,       // Invalid DEFAI mint
}
```

## Events

### AppRegistered
```rust
pub struct AppRegistered {
    pub app_id: u64,
    pub creator: Pubkey,
    pub sft_mint: Pubkey,
    pub price: u64,
    pub max_supply: u64,
    pub timestamp: i64,
}
```

### AppPurchased
```rust
pub struct AppPurchased {
    pub app_id: u64,
    pub user: Pubkey,
    pub price: u64,
    pub platform_fee: u64,
    pub creator_amount: u64,
    pub timestamp: i64,
}
```

## Security Audit Checklist

### Access Control
- [ ] Authority validation in all admin functions
- [ ] Creator-only access to app management
- [ ] PDA derivation validation
- [ ] Signer verification

### Input Validation
- [ ] Price bounds checking
- [ ] Supply limit validation
- [ ] Metadata URI length limits
- [ ] Fee percentage bounds

### Arithmetic Safety
- [ ] Overflow protection with `checked_*` operations
- [ ] Division by zero prevention
- [ ] Underflow protection

### Token Operations
- [ ] SPL Token transfer validation
- [ ] Mint authority verification
- [ ] Token account ownership checks
- [ ] Fee calculation accuracy

### State Management
- [ ] Supply tracking accuracy
- [ ] Access record uniqueness
- [ ] App status consistency
- [ ] Event emission completeness

## Known Issues & Mitigations

### 1. Stack Overflow in Original Purchase Function
**Issue**: Original `purchase_app_access` function caused stack overflow
**Mitigation**: Split into `purchase_app_pre_validation` and optimized `purchase_app_access_v2`

### 2. Fee Calculation Precision
**Issue**: Fee calculations could lose precision with small amounts
**Mitigation**: Use basis points (1/100th of 1%) for precise fee calculation

### 3. Metadata URI Storage
**Issue**: String storage in accounts can be expensive
**Mitigation**: Limit to 100 characters and use IPFS for actual metadata

## Testing Scenarios

### 1. Normal Operation
```rust
// 1. Initialize factory
initialize_app_factory(ctx, 2000)?; // 20% fee

// 2. Register app
register_app(ctx, 1000, 100, "ipfs://metadata")?;

// 3. Purchase access
purchase_app_access_v2(ctx, 0)?; // app_id = 0
```

### 2. Edge Cases
```rust
// Maximum fee
initialize_app_factory(ctx, 10000)?; // 100% fee

// Minimum price
register_app(ctx, 1, 1, "ipfs://min")?;

// Maximum supply
register_app(ctx, 1000, u64::MAX, "ipfs://max")?;
```

### 3. Attack Vectors
```rust
// Unauthorized access
let attacker = Keypair::new();
toggle_app_status(ctx, 0)?; // Should fail

// Overflow attempt
let malicious_supply = u64::MAX;
register_app(ctx, 1000, malicious_supply, "ipfs://overflow")?;
```

## Recommendations for Auditors

1. **Focus on arithmetic operations** - Check all `checked_*` operations
2. **Verify PDA derivations** - Ensure seeds are correct and unique
3. **Test fee calculations** - Verify platform and creator splits
4. **Check token transfers** - Validate SPL Token CPI calls
5. **Review access control** - Ensure proper authorization checks
6. **Test supply limits** - Verify max supply enforcement
7. **Check event emissions** - Ensure all state changes are logged

## Dependencies
- `anchor-lang`: Core Anchor framework
- `anchor-spl`: SPL Token integration
- `solana-program`: Solana program interface 