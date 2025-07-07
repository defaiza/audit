# DeFAI Security Auditor - Local Testing Guide

This guide provides step-by-step instructions for setting up and testing the DeFAI programs locally.

## Prerequisites

- Node.js v16+ and npm
- Solana CLI tools
- Anchor framework (v0.29.0)
- Phantom wallet or similar Solana wallet

## Admin Wallet Setup

For local testing, we use a dedicated admin keypair that's included in the repository:

- **Admin Public Key**: `4efsLapeRBz4pnqey6vBUECUSD6HmDie4pGzUxhnW1aZ`
- **Keypair File**: `admin-keypair.json`

### Import Admin Wallet to Phantom

1. Open the `admin-keypair.json` file
2. Copy the array of numbers (this is your private key)
3. In Phantom:
   - Click the menu (≡) → Add/Connect Wallet
   - Select "Import Private Key"
   - Paste the private key array
   - Name it "DeFAI Local Admin"

## Quick Start

### 1. Start Local Validator

```bash
# In a separate terminal
solana-test-validator
```

### 2. Deploy Programs

```bash
# Deploy all programs with admin keypair
node scripts/deploy-programs.js
```

This script will:
- Set up the admin keypair
- Request airdrop if needed
- Build all programs
- Deploy to localnet

### 3. Start Frontend

```bash
npm run dev
```

Visit http://localhost:3000

### 4. Initialize Programs

1. Connect your wallet (make sure it's the admin wallet)
2. Click "Request Airdrop" if you need SOL
3. Click "Initialize All Programs"
4. Wait for all programs to initialize

### 5. Run Tests

Click "Run Tests" on any program card to execute security tests.

## Frontend Controls

### 🛠️ Deployment Controls
- **Request Airdrop**: Get 2 SOL for testing
- **Redeploy Programs**: Redeploy all programs (requires running the script manually)

### Program Status Indicators
- ✅ Deployed: Program is deployed and executable
- ⚠️ Not Executable: Program deployed but not executable
- ❌ Not Deployed: Program needs deployment

### Initialize Button
- Shows current connected wallet
- Warns if wrong wallet is connected
- One-click initialization for all programs

## Manual Commands

### Check Program Deployment
```bash
solana program show CevRqnM5Jxz21QQfNz9wQEwXAr9nsaasdF1CZUZfcv3N  # Swap
solana program show 9Et8s8t6o52C4e4BkmJpAf68SfJEtn67LvhGLvdHLijN  # Staking
solana program show CVbyAQjUZ2oAofKaZG3mfaK3yHDJDDW3UaeJvj6vkGx2  # Estate
solana program show uosa7o62kupuo2TBHFm36dvpV9JkFsfhXD9tMV8qMM2  # App Factory
```

### Manual Initialization
```bash
# If frontend initialization fails, use the CLI script
node scripts/initializeAll.js
```

### Clean Build
```bash
cargo clean
anchor build
```

## Troubleshooting

### "Attempt to load a program that does not exist"
- Programs not deployed yet
- Run `node scripts/deploy-programs.js`

### "Wrong Wallet Connected"
- Import `admin-keypair.json` to your wallet
- Switch to the admin wallet in Phantom

### "Insufficient funds"
- Click "Request Airdrop" button
- Or run: `solana airdrop 2`

### Build Errors
```bash
# Clean and rebuild
cargo clean
anchor build
```

### Port Already in Use
```bash
# Kill existing validator
pkill solana-test-validator
# Restart
solana-test-validator
```

## Program IDs

| Program | ID |
|---------|-----|
| DeFAI Swap | CevRqnM5Jxz21QQfNz9wQEwXAr9nsaasdF1CZUZfcv3N |
| DeFAI Staking | 9Et8s8t6o52C4e4BkmJpAf68SfJEtn67LvhGLvdHLijN |
| DeFAI Estate | CVbyAQjUZ2oAofKaZG3mfaK3yHDJDDW3UaeJvj6vkGx2 |
| DeFAI App Factory | uosa7o62kupuo2TBHFm36dvpV9JkFsfhXD9tMV8qMM2 |

## Security Testing

The security auditor tests for:
- Access control vulnerabilities
- Input validation issues
- Overflow protection
- State consistency
- PDA derivation correctness
- Token account validation
- Reentrancy guards
- Admin timelocks

## For Auditors

1. Import the admin keypair to your wallet
2. Deploy programs using the provided script
3. Initialize all programs via the frontend
4. Run security tests on each program
5. Review test results and logs
6. Check BUILD_STATUS.md for known issues

---

**Note**: This setup is for local testing only. Never use the included admin keypair on mainnet!