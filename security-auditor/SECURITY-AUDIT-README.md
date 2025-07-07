# DeFAI Security Audit System

A comprehensive security audit framework for DeFAI programs on Solana blockchain.

## Overview

The DeFAI Security Audit System provides automated security testing for Solana programs with:
- 45+ security tests across 9 categories
- Real attack implementations (not simulated)
- PDF/HTML/Markdown report generation
- Real-time monitoring capabilities
- Historical analysis features

## Architecture

### Core Components

1. **Comprehensive Test Suite** (`comprehensive-test-suite.ts`)
   - Orchestrates all security tests
   - Manages test execution and result collection
   - Generates security scores and recommendations

2. **Attack Implementations** (`attack-implementations/`)
   - `overflow-attacks.ts` - Integer overflow/underflow tests
   - `reentrancy-attacks.ts` - Reentrancy vulnerability tests
   - `access-control-attacks.ts` - Authorization bypass tests
   - `input-validation-attacks.ts` - Input sanitization tests
   - `double-spending-attacks.ts` - Token spend protection tests
   - `dos-attacks.ts` - Denial of service tests
   - `swap-attacks.ts` - Swap-specific vulnerabilities
   - `staking-attacks.ts` - Staking-specific vulnerabilities
   - `estate-attacks.ts` - NFT/Estate vulnerabilities
   - `factory-attacks.ts` - App Factory vulnerabilities
   - `cross-program-attacks.ts` - Cross-program exploits

3. **Infrastructure Components**
   - `test-infrastructure.ts` - Test environment setup
   - `attack-detector.ts` - Attack pattern detection
   - `performance-measurement.ts` - Performance metrics
   - `websocket-monitor.ts` - Real-time monitoring
   - `transaction-analyzer.ts` - Transaction analysis
   - `state-snapshots.ts` - State comparison
   - `oracle-integration.ts` - Oracle manipulation tests
   - `historical-analysis.ts` - Historical pattern detection

4. **Reporting System** (`pdf-report-generator.ts`)
   - HTML report generation (print to PDF)
   - Markdown report generation
   - Professional formatting with charts and tables

## Security Tests

### Categories

1. **Access Control** (2 tests)
   - Unauthorized admin operations
   - Privilege escalation attempts

2. **Integer Overflow/Underflow** (3 tests)
   - Tier price overflow
   - Amount underflow
   - Reward calculation overflow

3. **Reentrancy** (3 tests)
   - Swap reentrancy
   - Claim reentrancy
   - Cross-program reentrancy

4. **Input Validation** (3 tests)
   - Zero amount transactions
   - Invalid parameters
   - Buffer overflow attempts

5. **Double Spending** (3 tests)
   - Concurrent token spend
   - Race condition exploits
   - Transaction replay

6. **DOS Attacks** (3 tests)
   - Resource exhaustion
   - State bloat
   - Transaction spam

7. **Program-Specific** (8 tests)
   - Swap: Price manipulation, slippage exploits
   - Staking: Reward manipulation, early unstaking
   - Estate: NFT duplication, metadata tampering
   - Factory: Malicious deployment, purchase bypass

8. **Cross-Program** (3 tests)
   - Swap-Staking exploits
   - Estate-Factory manipulation
   - Complex attack chains

9. **Infrastructure** (4 tests)
   - Attack detection
   - Performance monitoring
   - State snapshots
   - Oracle integration

## Usage

### Prerequisites

1. Solana programs deployed on localnet
2. Node.js and TypeScript installed
3. Anchor framework set up

### Running the Audit

```bash
# Initialize programs (if not already done)
npm run init

# Run full security audit
npm run audit

# Run demo audit (generates sample report)
npm run audit:demo
```

### Output

The audit generates:
1. **Console Output** - Real-time test progress and results
2. **HTML Report** - Professional report with charts and tables
3. **Markdown Report** - Text-based report for documentation
4. **Security Score** - Overall security rating (0-100)
5. **Recommendations** - Actionable security improvements

### Report Structure

```
DeFAI Security Audit Report
├── Executive Summary
│   ├── Total Tests
│   ├── Pass/Fail Count
│   ├── Security Score
│   └── Execution Time
├── Test Results by Category
├── Test Results by Program  
├── Detailed Test Results
│   └── Each test with status, time, and details
└── Security Recommendations
```

## Converting HTML to PDF

The system generates HTML reports that can be converted to PDF:

1. **Browser Method** (Recommended)
   - Open the HTML report in Chrome/Firefox
   - Print to PDF (Ctrl+P / Cmd+P)
   - Select "Save as PDF"

2. **Command Line** (requires wkhtmltopdf)
   ```bash
   # Install wkhtmltopdf
   sudo apt-get install wkhtmltopdf  # Ubuntu/Debian
   brew install --cask wkhtmltopdf    # macOS

   # Convert to PDF
   wkhtmltopdf report.html report.pdf
   ```

3. **Online Converters**
   - Upload HTML to online HTML-to-PDF services

## Test Infrastructure

### Environment Setup
- Creates funded test wallets (Admin, Attacker, Victim)
- Deploys test token mint
- Distributes tokens for testing
- Takes account snapshots

### Attack Execution
- Safe mode by default (no permanent damage)
- Real blockchain transactions
- Compute unit measurement
- Transaction log analysis

### Detection & Analysis
- Pattern recognition
- Severity classification
- Success/failure determination
- Historical trend analysis

## Security Recommendations

Based on test results, the system provides:
- Specific vulnerability fixes
- General security improvements
- Implementation best practices
- Monitoring suggestions

## Development

### Adding New Tests

1. Create attack implementation in `attack-implementations/`
2. Add test cases to `comprehensive-test-suite.ts`
3. Update test categories and counts
4. Run audit to verify

### Customizing Reports

Edit `pdf-report-generator.ts` to:
- Modify HTML/CSS styling
- Add new report sections
- Change scoring algorithms
- Include additional metrics

## Important Notes

- Tests run on localnet by default
- Some tests may fail intentionally to demonstrate vulnerabilities
- Always review failed tests for actual security issues
- Consider professional audit before mainnet deployment

## Troubleshooting

### Common Issues

1. **Connection Failed**
   - Ensure Solana localnet is running
   - Check RPC endpoint configuration

2. **Program Not Found**
   - Verify programs are deployed
   - Run `npm run init` first

3. **Insufficient Funds**
   - Airdrop SOL to test wallets
   - Check token distribution

4. **Test Timeouts**
   - Increase timeout in test configuration
   - Check network latency

## License

This security audit system is part of the DeFAI project. 