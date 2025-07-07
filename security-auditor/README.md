# DeFAI Security Auditor

A comprehensive security testing and audit dashboard for the DeFAI ecosystem programs on Solana.

## Overview

This security auditor provides automated testing and vulnerability detection for:
- **DeFAI Swap**: Token swap and NFT tier management
- **DeFAI Staking**: Token staking with pool-based rewards
- **DeFAI Estate**: Real estate investment management
- **DeFAI App Factory**: Application deployment and revenue sharing

## Quick Start

See [LOCAL_TESTING_GUIDE.md](./LOCAL_TESTING_GUIDE.md) for detailed setup instructions.

1. Install dependencies:
```bash
npm install
```

2. Start local Solana validator:
```bash
solana-test-validator
```

3. Deploy programs with admin keypair:
```bash
node scripts/deploy-programs.js
```

4. Start the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000)

**Note**: Import `admin-keypair.json` to your wallet for initialization.

## Features

### Security Testing
- Access control validation
- Input validation checks
- Overflow protection verification
- State consistency tests
- PDA derivation validation
- Token account security
- Reentrancy guard checks
- Admin timelock verification

### Frontend Dashboard
- Real-time program status monitoring
- One-click program initialization
- Automated security test execution
- Detailed test result reporting
- Wallet integration with admin controls
- Airdrop functionality for testing

### Admin Controls
- **Admin Wallet**: `4efsLapeRBz4pnqey6vBUECUSD6HmDie4pGzUxhnW1aZ`
- Deploy/redeploy programs
- Initialize program states
- Request test SOL airdrops

## Architecture

```
security-auditor/
├── src/
│   ├── components/     # React components
│   ├── utils/         # Testing utilities
│   ├── idl/           # Program IDLs
│   └── pages/         # Next.js pages
├── programs/          # Solana programs
├── scripts/           # Deployment scripts
└── admin-keypair.json # Local testing keypair
```

## Testing Workflow

1. **Setup**: Import admin keypair and connect wallet
2. **Deploy**: Run deployment script to deploy all programs
3. **Initialize**: Use frontend button to initialize programs
4. **Test**: Click "Run Tests" on each program card
5. **Review**: Analyze test results and security findings

## Program IDs (Localnet)

| Program | ID |
|---------|-----|
| DeFAI Swap | `CevRqnM5Jxz21QQfNz9wQEwXAr9nsaasdF1CZUZfcv3N` |
| DeFAI Staking | `9Et8s8t6o52C4e4BkmJpAf68SfJEtn67LvhGLvdHLijN` |
| DeFAI Estate | `CVbyAQjUZ2oAofKaZG3mfaK3yHDJDDW3UaeJvj6vkGx2` |
| DeFAI App Factory | `uosa7o62kupuo2TBHFm36dvpV9JkFsfhXD9tMV8qMM2` |

## Development

### Building Programs
```bash
anchor build
```

### Running Tests
```bash
anchor test
```

### Cleaning Build
```bash
cargo clean
anchor build
```

## Security Considerations

- The included `admin-keypair.json` is for **local testing only**
- Never use this keypair on mainnet or with real funds
- Always verify program deployments before initialization
- Review all test results before production deployment

## License

MIT