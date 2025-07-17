// import { TestSuiteReport } from './utils/comprehensive-test-suite';

// Define TestSuiteReport interface locally for now
interface TestSuiteReport {
  summary: {
    totalTests: number;
    passed: number;
    failed: number;
    skipped: number;
    executionTime: number;
    testDate: Date;
  };
  results: any[];
  recommendations?: any[];
  categoryBreakdown?: any;
  programBreakdown?: any;
  securityScore?: number;
}
import { PDFReportGenerator } from './utils/pdf-report-generator';

/**
 * Demo script to show sample audit results without running actual tests
 */
async function runDemo() {
  console.log('🎯 Running Demo Audit Report Generation...\n');

  // Create sample test results
  const sampleReport: TestSuiteReport = {
    summary: {
      totalTests: 45,
      passed: 38,
      failed: 7,
      skipped: 0,
      executionTime: 125000,
      testDate: new Date()
    },
    results: [
      // Access Control Tests
      { testName: 'Unauthorized Admin Operation', category: 'Access Control', program: 'All Programs', passed: true, executionTime: 245, details: { allPrevented: true }, timestamp: new Date() },
      { testName: 'Privilege Escalation', category: 'Access Control', program: 'All Programs', passed: true, executionTime: 312, details: { allPrevented: true }, timestamp: new Date() },
      
      // Overflow Tests
      { testName: 'Tier Price Overflow', category: 'Integer Overflow', program: 'Swap Program', passed: true, executionTime: 156, details: { success: false }, timestamp: new Date() },
      { testName: 'Amount Underflow', category: 'Integer Underflow', program: 'Swap Program', passed: true, executionTime: 189, details: { success: false }, timestamp: new Date() },
      { testName: 'Reward Calculation Overflow', category: 'Integer Overflow', program: 'Staking Program', passed: false, executionTime: 223, error: 'Overflow not prevented', details: { success: true }, timestamp: new Date() },
      
      // Reentrancy Tests
      { testName: 'Swap Reentrancy', category: 'Reentrancy', program: 'Swap Program', passed: true, executionTime: 467, details: { success: false }, timestamp: new Date() },
      { testName: 'Claim Reentrancy', category: 'Reentrancy', program: 'Staking Program', passed: true, executionTime: 389, details: { success: false }, timestamp: new Date() },
      { testName: 'Cross-Program Reentrancy', category: 'Reentrancy', program: 'Multiple Programs', passed: false, executionTime: 512, error: 'Cross-program call succeeded', details: { success: true }, timestamp: new Date() },
      
      // Input Validation Tests
      { testName: 'Zero Amount Swap', category: 'Input Validation', program: 'Swap Program', passed: true, executionTime: 134, details: { success: false }, timestamp: new Date() },
      { testName: 'Invalid Parameters', category: 'Input Validation', program: 'All Programs', passed: true, executionTime: 256, details: { allValidated: true }, timestamp: new Date() },
      { testName: 'Buffer Overflow Attempt', category: 'Input Validation', program: 'Estate Program', passed: true, executionTime: 178, details: { success: false }, timestamp: new Date() },
      
      // Double Spending Tests
      { testName: 'Concurrent Token Spend', category: 'Double Spending', program: 'Swap Program', passed: true, executionTime: 345, details: { success: false }, timestamp: new Date() },
      { testName: 'Race Condition Exploit', category: 'Double Spending', program: 'Staking Program', passed: true, executionTime: 412, details: { success: false }, timestamp: new Date() },
      { testName: 'Transaction Replay', category: 'Double Spending', program: 'All Programs', passed: true, executionTime: 289, details: { success: false }, timestamp: new Date() },
      
      // DOS Tests
      { testName: 'Resource Exhaustion', category: 'DOS', program: 'All Programs', passed: true, executionTime: 567, details: { success: false }, timestamp: new Date() },
      { testName: 'State Bloat Attack', category: 'DOS', program: 'Estate Program', passed: false, executionTime: 678, error: 'State limit not enforced', details: { success: true }, timestamp: new Date() },
      { testName: 'Transaction Spam', category: 'DOS', program: 'Swap Program', passed: true, executionTime: 434, details: { success: false }, timestamp: new Date() },
      
      // Program-Specific Tests
      { testName: 'Price Manipulation', category: 'Program-Specific', program: 'Swap Program', passed: false, executionTime: 356, error: 'Price oracle can be manipulated', details: { success: true }, timestamp: new Date() },
      { testName: 'Slippage Exploit', category: 'Program-Specific', program: 'Swap Program', passed: true, executionTime: 298, details: { success: false }, timestamp: new Date() },
      { testName: 'Reward Manipulation', category: 'Program-Specific', program: 'Staking Program', passed: false, executionTime: 423, error: 'Rewards can be gamed', details: { success: true }, timestamp: new Date() },
      { testName: 'Early Unstaking Exploit', category: 'Program-Specific', program: 'Staking Program', passed: true, executionTime: 367, details: { success: false }, timestamp: new Date() },
      { testName: 'NFT Duplication', category: 'Program-Specific', program: 'Estate Program', passed: true, executionTime: 445, details: { success: false }, timestamp: new Date() },
      { testName: 'Metadata Tampering', category: 'Program-Specific', program: 'Estate Program', passed: false, executionTime: 512, error: 'Metadata validation insufficient', details: { success: true }, timestamp: new Date() },
      { testName: 'Malicious App Deployment', category: 'Program-Specific', program: 'App Factory Program', passed: true, executionTime: 389, details: { success: false }, timestamp: new Date() },
      { testName: 'Purchase Bypass', category: 'Program-Specific', program: 'App Factory Program', passed: true, executionTime: 334, details: { success: false }, timestamp: new Date() },
      
      // Cross-Program Tests
      { testName: 'Swap-Staking Exploit', category: 'Cross-Program', program: 'Swap + Staking', passed: false, executionTime: 623, error: 'Cross-program vulnerability found', details: { success: true }, timestamp: new Date() },
      { testName: 'Estate-Factory Manipulation', category: 'Cross-Program', program: 'Estate + Factory', passed: true, executionTime: 567, details: { success: false }, timestamp: new Date() },
      { testName: 'Complex Attack Chain', category: 'Cross-Program', program: 'All Programs', passed: true, executionTime: 789, details: { success: false }, timestamp: new Date() },
      
      // Infrastructure Tests
      { testName: 'Attack Detection', category: 'Infrastructure', program: 'Detection System', passed: true, executionTime: 123, details: { detectionWorking: true }, timestamp: new Date() },
      { testName: 'Performance Monitoring', category: 'Infrastructure', program: 'Performance System', passed: true, executionTime: 89, details: { metricsCollected: true }, timestamp: new Date() },
      { testName: 'State Snapshot', category: 'Infrastructure', program: 'Snapshot System', passed: true, executionTime: 67, details: { snapshotWorking: true }, timestamp: new Date() },
      { testName: 'Oracle Integration', category: 'Infrastructure', program: 'Oracle System', passed: true, executionTime: 156, details: { oracleCreated: true }, timestamp: new Date() }
    ],
    categoryBreakdown: new Map([
      ['Access Control', { total: 2, passed: 2, failed: 0 }],
      ['Integer Overflow', { total: 2, passed: 1, failed: 1 }],
      ['Integer Underflow', { total: 1, passed: 1, failed: 0 }],
      ['Reentrancy', { total: 3, passed: 2, failed: 1 }],
      ['Input Validation', { total: 3, passed: 3, failed: 0 }],
      ['Double Spending', { total: 3, passed: 3, failed: 0 }],
      ['DOS', { total: 3, passed: 2, failed: 1 }],
      ['Program-Specific', { total: 8, passed: 5, failed: 3 }],
      ['Cross-Program', { total: 3, passed: 2, failed: 1 }],
      ['Infrastructure', { total: 4, passed: 4, failed: 0 }]
    ]),
    programBreakdown: new Map([
      ['All Programs', { total: 6, passed: 6, failed: 0 }],
      ['Swap Program', { total: 8, passed: 7, failed: 1 }],
      ['Staking Program', { total: 6, passed: 4, failed: 2 }],
      ['Estate Program', { total: 4, passed: 2, failed: 2 }],
      ['App Factory Program', { total: 2, passed: 2, failed: 0 }],
      ['Multiple Programs', { total: 1, passed: 0, failed: 1 }],
      ['Swap + Staking', { total: 1, passed: 0, failed: 1 }],
      ['Estate + Factory', { total: 1, passed: 1, failed: 0 }],
      ['Detection System', { total: 1, passed: 1, failed: 0 }],
      ['Performance System', { total: 1, passed: 1, failed: 0 }],
      ['Snapshot System', { total: 1, passed: 1, failed: 0 }],
      ['Oracle System', { total: 1, passed: 1, failed: 0 }]
    ]),
    recommendations: [
      'Add overflow protection using checked arithmetic operations',
      'Review cross-program invocation security and add verification checks',
      'Add rate limiting and resource consumption controls',
      'Review swap program price calculation and slippage protection',
      'Audit staking reward calculations and time-lock mechanisms',
      'Enhance NFT verification and metadata validation',
      'Consider a professional security audit before mainnet deployment',
      'Implement comprehensive monitoring and alerting systems'
    ],
    securityScore: Math.round((38 / 45) * 100)
  };

  // Generate report
  console.log('📄 Generating demo report...\n');
  const generator = new PDFReportGenerator();
  const reportPath = await generator.saveReportToFile(sampleReport as any, 'html');

  // Display summary
  console.log('='.repeat(70));
  console.log('DEMO AUDIT COMPLETE');
  console.log('='.repeat(70));
  console.log(`Total Tests: ${sampleReport.summary.totalTests}`);
  console.log(`Passed: ${sampleReport.summary.passed} ✅`);
  console.log(`Failed: ${sampleReport.summary.failed} ❌`);
  console.log(`Security Score: ${sampleReport.securityScore}/100`);
  console.log('='.repeat(70));

  console.log('\n✅ Demo report generated successfully!');
  console.log(`📁 Report location: ${reportPath}`);
  console.log('\n💡 To run the actual security audit, use: npm run audit');
}

// Run demo
runDemo().catch(error => {
  console.error('Demo failed:', error);
  process.exit(1);
}); 