import { Connection, clusterApiUrl, Keypair } from '@solana/web3.js';
import { ComprehensiveTestSuite } from './utils/comprehensive-tests';
import * as fs from 'fs';
import * as path from 'path';
import { PDFReportGenerator } from './utils/pdf-report-generator';

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

    // Load admin keypair
    const adminKeypairPath = path.join(__dirname, '../admin-keypair.json');
    let adminKeypair: Keypair;
    
    try {
      const keypairData = JSON.parse(fs.readFileSync(adminKeypairPath, 'utf8'));
      adminKeypair = Keypair.fromSecretKey(new Uint8Array(keypairData));
      console.log(`🔑 Using admin wallet: ${adminKeypair.publicKey.toBase58()}\n`);
    } catch (error) {
      console.error('❌ Failed to load admin keypair. Make sure admin-keypair.json exists');
      return;
    }
    
    // Create wallet interface with real signing
    const wallet = {
      publicKey: adminKeypair.publicKey,
      signTransaction: async (tx: any) => {
        tx.partialSign(adminKeypair);
        return tx;
      },
      signAllTransactions: async (txs: any[]) => {
        return txs.map((tx: any) => {
          tx.partialSign(adminKeypair);
          return tx;
        });
      }
    };
    
    // Run comprehensive security tests
    console.log('🚀 Starting comprehensive security audit...\n');
    const testSuite = new ComprehensiveTestSuite(connection, wallet);
    await testSuite.initialize();
    const report = await testSuite.runFullSuite();

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
    const failedTests = report.results.filter(r => r.status === 'failed' || r.status === 'error');
    if (failedTests.length > 0) {
      console.log('\n❌ Failed Tests:');
      console.log('-'.repeat(70));
      failedTests.forEach(test => {
        console.log(`• ${test.test} - ${test.program}`);
        console.log(`  ${test.message}`);
      });
    }

    // Save report to file using report manager
    const { reportManager } = await import('./utils/report-manager');
    const jsonFilename = reportManager.generateFilename('json');
    const reportPath = path.join(__dirname, '..', 'reports', jsonFilename);
    
    // Ensure reports directory exists
    if (!fs.existsSync(path.dirname(reportPath))) {
      fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    }
    
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    // Generate PDF and HTML reports
    const generator = new PDFReportGenerator();
    try {
      const htmlPath = await generator.saveReportToFile(report, 'html');
      const pdfPath = await generator.saveReportToFile(report, 'pdf');
      
      console.log('\n✅ Audit complete!');
      console.log('\n📁 Reports saved:');
      console.log(`   - JSON: ${reportPath}`);
      console.log(`   - HTML: ${htmlPath}`);
      console.log(`   - PDF:  ${pdfPath}`);
    } catch (error) {
      console.log('\n✅ Audit complete!');
      console.log(`\n📁 JSON report saved to: ${reportPath}`);
      console.log('   ⚠️  Failed to generate PDF/HTML reports');
    }

    // Exit with appropriate code
    process.exit(failedTests.length > 0 ? 1 : 0);

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