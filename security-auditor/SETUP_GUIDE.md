# DeFAI Security Auditor - Setup Guide

## 🚀 Quick Start (One-Click Setup)

For a complete automated setup, run:

```bash
npm run setup
```

This will:
- ✅ Check and install prerequisites (Solana, Anchor)
- ✅ Start a local Solana validator
- ✅ Generate and fund an admin wallet
- ✅ Build and deploy all programs
- ✅ Initialize programs
- ✅ Run initial tests
- ✅ Save setup information

## 📋 Prerequisites

Before running the setup, ensure you have:

- **Node.js** v18 or higher
- **npm** or **yarn**
- **Rust** (install from [rustup.rs](https://rustup.rs))
- **Git**

## 🛠️ Manual Setup

If you prefer manual setup or the automated script fails:

### 1. Install Solana CLI

```bash
sh -c "$(curl -sSfL https://release.solana.com/v1.18.25/install)"
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
```

### 2. Install Anchor

```bash
cargo install --git https://github.com/coral-xyz/anchor --tag v0.30.1 anchor-cli --locked
```

### 3. Configure Solana for Localnet

```bash
solana config set --url localhost
```

### 4. Create Admin Keypair

```bash
solana-keygen new --outfile admin-keypair.json --no-bip39-passphrase
```

### 5. Start Test Validator

```bash
solana-test-validator --reset
```

### 6. Fund Admin Wallet

```bash
solana airdrop 10 $(solana address -k admin-keypair.json)
```

### 7. Install Dependencies

```bash
npm install
```

### 8. Build Programs

```bash
anchor build
```

### 9. Deploy Programs

```bash
# Deploy each program
solana program deploy target/deploy/defai_swap.so
solana program deploy target/deploy/defai_staking.so
solana program deploy target/deploy/defai_estate.so
solana program deploy target/deploy/defai_app_factory.so
```

### 10. Update Program IDs

```bash
npm run fix:ids
```

### 11. Initialize Programs

```bash
npm run init
```

### 12. Run Tests

```bash
npm run test:run
```

## 🎯 Quick Commands

Once setup is complete:

### Start Development Server
```bash
npm run dev
# Visit http://localhost:3002
```

### Run Security Audit
```bash
npm run audit
```

### Run Tests
```bash
npm run test:run
```

### View TODOs
```bash
npm run todo
```

## 🔑 Wallet Setup

### Import Admin Wallet to Phantom

1. Open `admin-keypair.json`
2. Copy the array of numbers
3. In Phantom:
   - Click menu (≡) → Add/Connect Wallet
   - Select "Import Private Key"
   - Paste the private key array
   - Name it "DeFAI Admin"
4. Switch to the DeFAI Admin wallet

## 🐛 Troubleshooting

### "Program ID Mismatch" Error
```bash
npm run fix:ids
```

### Low Wallet Balance
```bash
solana airdrop 10 $(solana address -k admin-keypair.json)
```

### Validator Not Running
```bash
# Check if running
ps aux | grep solana-test-validator

# Start if not running
solana-test-validator --reset
```

### Build Failures
```bash
# Clean and rebuild
anchor clean
anchor build
```

### Port Already in Use
```bash
# Kill process on port 8899
lsof -ti:8899 | xargs kill -9

# Or use different port
solana-test-validator --rpc-port 8900
solana config set --url http://localhost:8900
```

## 📁 Project Structure

```
security-auditor/
├── programs/           # Solana programs
│   ├── defai_swap/
│   ├── defai_staking/
│   ├── defai_estate/
│   └── defai_app_factory/
├── src/               # Frontend source
│   ├── components/    # React components
│   ├── utils/         # Test utilities
│   └── pages/         # Next.js pages
├── scripts/           # Setup and utility scripts
├── target/            # Build artifacts
└── admin-keypair.json # Admin wallet
```

## 🔍 Environment Variables

Create `.env.local` for custom configuration:

```env
# Solana Cluster (localnet, devnet, testnet, mainnet-beta)
NEXT_PUBLIC_SOLANA_CLUSTER=localnet

# Custom RPC URL (optional)
NEXT_PUBLIC_SOLANA_RPC_URL=http://localhost:8899

# Admin wallet path
ADMIN_KEYPAIR_PATH=./admin-keypair.json
```

## 📊 Generated Reports

After running audits, find reports in:
- `reports/` - PDF and HTML reports
- `test-results-*.json` - Raw test data
- `security-audit-*.json` - Audit results

## 🆘 Getting Help

- Check existing issues on GitHub
- Review `FIX_TRACKING.md` for known issues
- Run `npm run todo` to see pending improvements
- Join our Discord for support

## 🔒 Security Notes

- **Never share your admin keypair**
- Use separate wallets for testing
- Don't deploy to mainnet without formal audit
- Test thoroughly on devnet first

## ✅ Success Indicators

Your setup is successful when:
- ✅ All programs show as deployed
- ✅ Admin wallet has balance > 1 SOL
- ✅ `npm run test:run` passes deployment tests
- ✅ Frontend loads at http://localhost:3002
- ✅ You can connect wallet and see programs 