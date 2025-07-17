# DEFAI App Factory Program

A Solana program for creating and managing a decentralized marketplace for workspace applications using Semi-Fungible Tokens (SFTs).

## Overview

The DEFAI App Factory program enables:
- Developers to register and sell access to their applications
- Users to purchase app access using DEFAI tokens
- Platform fee collection and distribution
- SFT-based access control for applications

## Features

### 1. App Registration
- Register applications with custom pricing
- Set maximum supply limits
- Store metadata URIs (IPFS)
- Toggle app active/inactive status

### 2. Purchase System
- Pay with DEFAI tokens
- Automatic fee splitting:
  - Platform fee (configurable, e.g., 20%)
  - Creator revenue (remainder)
- Mint SFT as proof of access
- Track purchase history

### 3. Platform Management
- Configurable platform fee (basis points)
- Update treasury address
- Master collection support
- Total app tracking

### 4. Access Control
- SFT ownership represents app access
- One token per user per app
- Transferable access rights
- Supply-limited apps

## Build Instructions

```bash
# Ensure you're in the security-auditor directory
cd security-auditor

# Build the program
anchor build --skip-lint

# The built program will be at:
# target/deploy/defai_app_factory.so
```

## Program Addresses

- **Program ID**: `FyDBGJFfviW1mqKYWueLQCW4YUm9RmUgQeEYw1izszDA`
- **Localnet**: `AzcDoYYY1cHCd3faCKd8tG76ESUnuRz8jVBXEcxFwznQ`

## Initialization

### 1. Initialize App Factory (One-time)
```typescript
await program.methods.initializeAppFactory(
  2000  // Platform fee: 2000 basis points = 20%
)
.accounts({
  authority: wallet.publicKey,
  defaiMint: defaiMintAddress,
  treasury: treasuryWallet,
  masterCollection: collectionMint,
})
```

### 2. Register an App
```typescript
await program.methods.registerApp(
  new BN(100 * 10**6),     // Price: 100 DEFAI
  new BN(1000),            // Max supply: 1000 licenses
  "ipfs://metadata-uri"    // Metadata URI
)
.accounts({
  creator: wallet.publicKey,
  sftMint: appSftMint,
})
```

### 3. Purchase App Access
```typescript
await program.methods.purchaseAppAccessV2(
  new BN(appId)  // App ID to purchase
)
```

## Key Constants

```rust
// Seeds
const APP_REGISTRATION_SEED: &[u8] = b"app_registration";

// Limits
const MAX_METADATA_URI_LEN: usize = 100;

// Platform fee is stored in basis points (10000 = 100%)
// Example: 2000 = 20% platform fee
```

## Usage Examples

### Toggle App Status (Creator Only)
```typescript
await program.methods.toggleAppStatus(appId)
```

### Update Platform Settings (Authority Only)
```typescript
await program.methods.updatePlatformSettings(
  1500,              // New fee: 15%
  newTreasuryWallet  // New treasury
)
```

### Query App Registration
```typescript
const appRegistration = await program.account.appRegistration.fetch(
  getAppRegistrationPDA(appId)
);

console.log({
  creator: appRegistration.creator,
  price: appRegistration.price,
  currentSupply: appRegistration.currentSupply,
  maxSupply: appRegistration.maxSupply,
  isActive: appRegistration.isActive
});
```

### Check User Access
```typescript
const userAccess = await program.account.userAppAccess.fetch(
  getUserAppAccessPDA(user, appId)
);

console.log({
  purchasedAt: userAccess.purchasedAt,
  sftAccount: userAccess.sftTokenAccount
});
```

## Account Structure

### AppFactory
- Global configuration account
- Stores platform settings and statistics
- Authority-controlled updates

### AppRegistration
- Per-app configuration
- Tracks supply and pricing
- Creator-controlled

### UserAppAccess
- Records user's app purchases
- Links to SFT token account
- Purchase timestamp tracking

## Fee Distribution

When a user purchases app access for 100 DEFAI with 20% platform fee:
- Platform Treasury: 20 DEFAI
- App Creator: 80 DEFAI
- User receives: 1 SFT (app access token)

## Security Features

1. **Authority Controls**: Platform settings restricted to authority
2. **Creator Controls**: Only creators can modify their apps
3. **Supply Limits**: Enforced maximum supply per app
4. **PDA Validation**: All accounts use Program Derived Addresses
5. **Stack Optimization**: Optimized purchase function to prevent overflow

## Error Codes

- `InvalidPlatformFee`: Fee exceeds 100%
- `InvalidPrice`: Price must be greater than 0
- `InvalidMaxSupply`: Supply must be greater than 0
- `MetadataUriTooLong`: URI exceeds 100 characters
- `AppNotActive`: App is disabled for purchases
- `MaxSupplyReached`: All licenses sold
- `UnauthorizedCreator`: Not the app creator
- `UnauthorizedAuthority`: Not the platform authority
- `MathOverflow`: Arithmetic overflow

## Events

- `AppRegistered`: New app added to marketplace
- `AppPurchased`: User purchased app access
- `AppStatusChanged`: App enabled/disabled
- `PlatformSettingsUpdated`: Fee or treasury changed

## Integration Guide

### For App Developers
1. Create an SFT mint for your app
2. Register app with desired price and supply
3. Provide metadata URI with app details
4. Monitor sales and toggle status as needed

### For Users
1. Browse available apps
2. Check price and availability
3. Purchase access with DEFAI tokens
4. Use SFT ownership to access app

### For Platform Operators
1. Initialize factory with fee structure
2. Monitor app registrations
3. Update treasury as needed
4. Collect platform fees automatically

## Stack Overflow Fix

The original `purchase_app_access` function caused stack overflow. The program uses `purchase_app_access_v2` which:
- Separates validation logic
- Uses boxed accounts
- Splits token transfers into functions
- Pre-validates all parameters

Always use the V2 function for purchases. 