import { Connection, clusterApiUrl } from '@solana/web3.js';
// import { runComprehensiveTests } from './utils/comprehensive-test-suite';
// import { generatePDFReport } from './utils/pdf-report-generator';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Main entry point for running the DeFAI Security Audit
 */
async function main() {
  console.log(`
╔══════════════════════════════════════════════════════════════════╗
║                    DeFAI Security Audit Suite                     ║
║                                                                   ║
║  This will run a comprehensive security audit of all DeFAI       ║
║  programs including:                                              ║
║  - Access Control Tests                                           ║
║  - Integer Overflow/Underflow Tests                               ║
║  - Reentrancy Tests                                               ║
║  - Input Validation Tests                                         ║
║  - Double Spending Tests                                          ║
║  - DOS Attack Tests                                               ║
║  - Program-Specific Vulnerability Tests                           ║
║  - Cross-Program Attack Tests                                     ║
║  - Infrastructure Tests                                           ║
║                                                                   ║
║  The audit will generate detailed reports in HTML and Markdown    ║
║  formats that can be converted to PDF.                           ║
╚══════════════════════════════════════════════════════════════════╝
  `);

  try {
    // Connect to cluster
    const cluster = process.env.SOLANA_CLUSTER || 'http://localhost:8899';
    console.log(`\n🌐 Connecting to Solana cluster: ${cluster}`);
    
    const connection = new Connection(cluster, 'confirmed');
    
    // Verify connection
    const version = await connection.getVersion();
    console.log(`✅ Connected to Solana ${version['solana-core']}\n`);

    // Run comprehensive security tests
    console.log('🚀 Starting comprehensive security audit...\n');
    // TODO: Fix comprehensive test suite
    console.log('❌ Comprehensive test suite is currently being refactored');
    console.log('Please run individual tests or use the web interface');
    return;
    // const report = await runComprehensiveTests(connection);

    /* Commented out until comprehensive test suite is fixed
    // Display summary
    console.log('\n' + '='.repeat(70));
    console.log('AUDIT COMPLETE');
    console.log('='.repeat(70));
    console.log(`Total Tests: ${report.summary.totalTests}`);
    console.log(`Passed: ${report.summary.passed} ✅`);
    console.log(`Failed: ${report.summary.failed} ❌`);
    console.log(`Security Score: ${report.securityScore}/100`);
    console.log(`Execution Time: ${(report.summary.executionTime / 1000).toFixed(1)} seconds`);
    console.log('='.repeat(70));

    // Generate reports
    console.log('\n📄 Generating audit reports...');
    const reportPath = await generatePDFReport(report);
    
    // Display category breakdown
    console.log('\n📊 Results by Category:');
    console.log('-'.repeat(50));
    report.categoryBreakdown.forEach((stats, category) => {
      const successRate = ((stats.passed / stats.total) * 100).toFixed(1);
      console.log(`${category.padEnd(20)} ${stats.passed}/${stats.total} (${successRate}%)`);
    });

    // Display program breakdown
    console.log('\n📦 Results by Program:');
    console.log('-'.repeat(50));
    report.programBreakdown.forEach((stats, program) => {
      const successRate = ((stats.passed / stats.total) * 100).toFixed(1);
      console.log(`${program.padEnd(20)} ${stats.passed}/${stats.total} (${successRate}%)`);
    });

    // Display recommendations
    if (report.recommendations.length > 0) {
      console.log('\n⚠️  Security Recommendations:');
      console.log('-'.repeat(70));
      report.recommendations.forEach((rec, index) => {
        console.log(`${index + 1}. ${rec}`);
      });
    }

    // Display failed tests
    const failedTests = report.results.filter(r => !r.passed);
    if (failedTests.length > 0) {
      console.log('\n❌ Failed Tests:');
      console.log('-'.repeat(70));
      failedTests.forEach(test => {
        console.log(`• ${test.testName} (${test.category})`);
        if (test.error) {
          console.log(`  Error: ${test.error}`);
        }
      });
    }

    console.log('\n✅ Audit complete! Reports have been generated.');
    console.log(`\n📁 Report location: ${reportPath}`);

    // Exit with appropriate code
    process.exit(failedTests.length > 0 ? 1 : 0);
    */

  } catch (error: any) {
    console.error('\n❌ Audit failed with error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the audit
main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
}); 