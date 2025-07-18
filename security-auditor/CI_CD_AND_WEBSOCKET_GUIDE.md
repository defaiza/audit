# DeFAI Security Auditor - CI/CD and WebSocket Integration Guide

## 🚀 GitHub Actions CI/CD

The DeFAI Security Auditor now includes comprehensive CI/CD automation through GitHub Actions.

### Features

1. **Automated Security Testing**
   - Runs on every push to main branch
   - Runs on all pull requests
   - Scheduled daily security scans (2 AM UTC)
   - Manual workflow dispatch option

2. **Test Coverage**
   - Builds all Solana programs
   - Deploys to local validator
   - Runs complete security test suite
   - Generates security reports

3. **PR Integration**
   - Automatic comment with test results
   - Vulnerability summary
   - Links to full reports
   - Fails CI on critical vulnerabilities

### Configuration

The workflow is defined in `.github/workflows/security-audit.yml` and includes:

```yaml
env:
  SOLANA_VERSION: '1.18.4'
  ANCHOR_VERSION: '0.30.1'
  NODE_VERSION: '20.x'
  RUST_VERSION: '1.75.0'
```

### Running CI/CD

1. **Automatic Runs**
   - Push to main: Automatic
   - Pull requests: Automatic
   - Daily schedule: 2 AM UTC

2. **Manual Run**
   ```bash
   # Via GitHub UI
   Actions → Security Audit CI/CD → Run workflow
   ```

3. **View Results**
   - Check Actions tab in GitHub
   - Download artifacts (reports, logs)
   - Review PR comments

## 🔌 WebSocket Real-Time Monitoring

The security monitor now includes real-time WebSocket monitoring for live attack detection.

### Features

1. **Live Transaction Monitoring**
   - Monitors all DeFAI programs
   - Real-time alert generation
   - Attack pattern detection
   - Suspicious activity tracking

2. **Attack Detection**
   - Integer overflow/underflow
   - Reentrancy attempts
   - Unauthorized access
   - Double spending
   - DOS attacks
   - Flash loan exploits

3. **Metrics Tracking**
   - Transaction counts
   - Suspicious activities
   - Attack patterns
   - Program health

### Using WebSocket Monitor

1. **Start Monitoring**
   - Click "Start Monitoring" in Security Monitor
   - WebSocket status shows in UI
   - Alerts appear in real-time

2. **Monitor Status**
   ```
   🟢 Active - Monitoring is running
   🔌 WebSocket Connected - Live feed active
   ```

3. **View Alerts**
   - Real-time alerts in UI
   - Severity levels: Low, Medium, High, Critical
   - Attack details and recommendations

### WebSocket Events

The monitor emits these events:

```typescript
// Alert event
monitor.on('alert', (alert: TransactionAlert) => {
  // Handle security alert
})

// Stats update
monitor.on('stats-update', (stats: MonitoringStats) => {
  // Update metrics
})

// Monitoring stopped
monitor.on('monitoring-stopped', (finalStats) => {
  // Handle cleanup
})
```

## 📊 Integration Benefits

1. **Continuous Security**
   - 24/7 automated testing
   - Real-time threat detection
   - Historical analysis

2. **Developer Workflow**
   - PR validation before merge
   - Immediate feedback
   - Detailed vulnerability reports

3. **Production Monitoring**
   - Live attack detection
   - Performance metrics
   - Audit trail

## 🛠️ Troubleshooting

### CI/CD Issues

1. **Build Failures**
   - Check Rust/Anchor versions
   - Verify program dependencies
   - Review workflow logs

2. **Test Failures**
   - Check validator status
   - Verify keypair generation
   - Review deployment logs

### WebSocket Issues

1. **Connection Failed**
   - Check RPC endpoint
   - Verify network status
   - Review console logs

2. **Missing Alerts**
   - Enable attack detection
   - Check program IDs
   - Verify subscriptions

## 📝 Best Practices

1. **CI/CD**
   - Keep dependencies updated
   - Monitor workflow duration
   - Review security reports

2. **WebSocket Monitoring**
   - Adjust scan intervals based on load
   - Review alerts regularly
   - Keep attack patterns updated

## 🔗 Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Solana WebSocket API](https://docs.solana.com/developing/clients/jsonrpc-api#subscription-websocket)
- [DeFAI Security Guide](./SECURITY_TESTING_GUIDE.md) 