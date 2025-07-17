# DEFAI Program Initialization Scripts

This directory contains TypeScript initialization scripts for all DEFAI programs.

## Prerequisites

1. **Anchor CLI**: Ensure Anchor is installed and configured
2. **Solana CLI**: Ensure Solana is installed and configured
3. **Local Validator**: Start a local validator with `solana-test-validator`
4. **Build Programs**: Run `anchor build --skip-lint` from the `security-auditor` directory
5. **Deploy Programs**: Deploy all programs to localnet

## Important Configuration

Before running any initialization scripts, you MUST update the following in each script:

### All Scripts
- Update program IDs with your deployed program addresses
- Update token mint addresses (DEFAI token, collection mints, etc.)

### defai_swap
- `oldDefaiMint`: Address of the OLD DEFAI token mint
- `newDefaiMint`: Address of the NEW DEFAI token mint (Token-2022)
- `collectionMint`: Address of the NFT collection mint
- `OG_TIER_0_MERKLE_ROOT`: Merkle root from MAY20DeFAIHOLDERS.csv
- `AIRDROP_MERKLE_ROOT`: Merkle root from 10_1AIR-Sheet1.csv

### defai_staking
- `defaiMint`: Address of the DEFAI token mint
- `INITIAL_ESCROW_FUNDING`: Amount of DEFAI to fund reward escrow

### defai_estate
- Update beneficiary addresses with real wallet addresses
- Update email addresses for notifications

### defai_app_factory
- `defaiMint`: Address of the DEFAI token mint
- `masterCollectionMint`: Address of the "DEFAI APPs" collection mint

## Running Individual Scripts

From the `security-auditor` directory:

```bash
# Initialize DEFAI Swap
ts-node scripts/init-defai-swap.ts

# Initialize DEFAI Staking
ts-node scripts/init-defai-staking.ts

# Initialize DEFAI Estate
ts-node scripts/init-defai-estate.ts

# Initialize DEFAI App Factory
ts-node scripts/init-defai-app-factory.ts
```

## Running All Programs

To initialize all programs at once:

```bash
ts-node scripts/init-all-programs.ts
```

## Script Descriptions

### init-defai-swap.ts
Initializes the token swap program with:
- Main configuration (prices, treasury, mints)
- Collection configuration (tiers, supplies, merkle roots)
- Escrow token accounts
- User tax state

### init-defai-staking.ts
Initializes the staking program with:
- Program state configuration
- Stake vault creation
- Reward escrow setup
- Optional escrow funding

### init-defai-estate.ts
Initializes the estate management program with:
- Global counter initialization
- Estate creation with dead man's switch
- Beneficiary configuration

### init-defai-app-factory.ts
Initializes the app factory with:
- Platform configuration
- Fee structure setup
- Treasury configuration

## Environment Setup

Ensure your Anchor.toml is configured for localnet:

```toml
[provider]
cluster = "Localnet"
wallet = "~/.config/solana/id.json"
```

## Troubleshooting

1. **"Account already exists"**: The program may already be initialized. Check the program state.
2. **"Insufficient funds"**: Ensure your wallet has SOL for transaction fees and rent.
3. **"Token account not found"**: Create associated token accounts before running scripts.
4. **"Invalid program ID"**: Update the program IDs in scripts with your deployed addresses.

## Next Steps

After initialization:
1. Test program functionality with the frontend UI
2. Create test transactions for each program
3. Monitor program state with Solana Explorer
4. Set up proper access controls and permissions 