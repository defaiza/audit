# DeFAI Security Auditor

A specialized frontend application for security auditors to test and validate DeFAI Solana programs.

## Features

- **Program Testing**: Run automated tests against all DeFAI programs
- **Security Checklist**: Visual representation of implemented security features
- **Test Scenarios**: Comprehensive test coverage for each program
- **Real-time Results**: Instant feedback on test execution
- **Wallet Integration**: Connect and test with your Solana wallet

## Programs Covered

1. **DeFAI Swap** (9.5/10 Ready)
   - Token swap functionality
   - NFT exchange with vesting
   - VRF randomness integration
   - Referral system

2. **DeFAI Staking** (9.5/10 Ready)
   - Tiered staking system
   - Compound rewards
   - APY calculations
   - Escrow management

3. **DeFAI Estate** (9.5/10 Ready)
   - Digital estate management
   - Multi-signature operations
   - Inheritance features
   - AI trading capabilities

4. **DeFAI App Factory** (7/10 Needs Testing)
   - Application registration
   - SFT creation and management
   - Usage tracking
   - Monetization features

## Installation

```bash
# Navigate to the security auditor directory
cd security-auditor

# Install dependencies
yarn

# Run the development server
yarn dev
```

The application will be available at `http://localhost:3002`

## Usage

1. **Connect Wallet**: Connect your Solana wallet (Phantom recommended)
2. **Select Program**: Choose a program to test from the dashboard
3. **Run Tests**: Click "Run Security Tests" to execute the test suite
4. **Review Results**: Analyze the test results in the popup modal
5. **Check Security**: Review the security checklist for each program

## Test Categories

### Basic Tests
- Program deployment verification
- IDL availability check
- Program size validation

### Program-Specific Tests
- State initialization checks
- Account validation
- Transaction simulation
- Error handling verification

### Security Checks
- Access control implementation
- Input validation
- Overflow protection
- Event emissions
- Admin timelocks
- Multi-signature support

## Development

### Adding New Tests

To add new test scenarios:

1. Update `src/utils/constants.ts` with new test scenarios
2. Implement test logic in `src/utils/program-test.ts`
3. Add visual indicators in the UI components

### Customizing Security Checks

Modify the `SECURITY_CHECKS` array in `src/utils/constants.ts` to add or update security requirements.

## Important Notes

- This tool performs read-only operations and simulations
- Actual security audits require manual code review
- Test results should be verified independently
- Always use devnet for testing

## Building for Production

```bash
# Build the application
yarn build

# Start the production server
yarn start
```

## Contributing

When contributing to the security auditor:

1. Ensure all tests pass
2. Update documentation
3. Follow the existing code style
4. Test on devnet before submitting PRs