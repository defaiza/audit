#!/usr/bin/env ts-node
import { reportManager } from '../src/utils/report-manager';

async function cleanupReports() {
  console.log('🧹 DeFAI Security Auditor - Report Cleanup\n');

  try {
    // Get current stats
    const statsBefore = await reportManager.getStorageStats();
    console.log('📊 Current status:');
    console.log(`   - Total reports: ${statsBefore.totalReports}`);
    console.log(`   - Total size: ${formatBytes(statsBefore.totalSize)}`);
    console.log(`   - Oldest report: ${statsBefore.oldestReport || 'N/A'}`);
    console.log(`   - Newest report: ${statsBefore.newestReport || 'N/A'}\n`);

    // Configuration
    const maxAge = parseInt(process.env.REPORT_MAX_AGE || '30');
    const maxCount = parseInt(process.env.REPORT_MAX_COUNT || '100');
    
    console.log(`⚙️  Cleanup configuration:`);
    console.log(`   - Max age: ${maxAge} days`);
    console.log(`   - Max count: ${maxCount} reports\n`);

    // First do a dry run
    console.log('🔍 Performing dry run...');
    const dryRunResult = await reportManager.cleanupReports({
      maxAge,
      maxCount,
      dryRun: true
    });

    if (dryRunResult.deleted.length === 0) {
      console.log('✅ No reports to clean up!');
      return;
    }

    console.log(`\n📋 Cleanup preview:`);
    console.log(`   - Reports to delete: ${dryRunResult.deleted.length}`);
    console.log(`   - Reports to keep: ${dryRunResult.kept.length}`);
    console.log(`   - Space to free: ${formatBytes(dryRunResult.freedSpace)}\n`);

    // Show some of the reports to be deleted
    if (dryRunResult.deleted.length > 0) {
      console.log('Reports to be deleted:');
      dryRunResult.deleted.slice(0, 5).forEach(filename => {
        console.log(`   - ${filename}`);
      });
      if (dryRunResult.deleted.length > 5) {
        console.log(`   ... and ${dryRunResult.deleted.length - 5} more`);
      }
    }

    // Ask for confirmation if running interactively
    if (process.stdin.isTTY) {
      const readline = require('readline').createInterface({
        input: process.stdin,
        output: process.stdout
      });

      const answer = await new Promise<string>(resolve => {
        readline.question('\n🤔 Proceed with cleanup? (y/N): ', resolve);
      });
      readline.close();

      if (answer.toLowerCase() !== 'y') {
        console.log('❌ Cleanup cancelled');
        return;
      }
    }

    // Perform actual cleanup
    console.log('\n🗑️  Performing cleanup...');
    const result = await reportManager.cleanupReports({
      maxAge,
      maxCount,
      dryRun: false
    });

    // Get stats after cleanup
    const statsAfter = await reportManager.getStorageStats();

    console.log('\n✅ Cleanup complete!');
    console.log(`   - Reports deleted: ${result.deleted.length}`);
    console.log(`   - Space freed: ${formatBytes(result.freedSpace)}`);
    console.log(`   - Reports remaining: ${statsAfter.totalReports}`);
    console.log(`   - Total size: ${formatBytes(statsAfter.totalSize)}`);

  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    process.exit(1);
  }
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// Run if called directly
if (require.main === module) {
  cleanupReports().catch(console.error);
}

export { cleanupReports }; 