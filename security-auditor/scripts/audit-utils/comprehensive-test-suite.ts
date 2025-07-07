import { Connection, PublicKey } from '@solana/web3.js';
import { Program } from '@coral-xyz/anchor';
import { SecurityTestInfrastructure } from './test-infrastructure';
import { OverflowAttackTester } from './attack-implementations/overflow-attacks';
import { ReentrancyAttackTester } from './attack-implementations/reentrancy-attacks';
import { AccessControlAttackTester } from './attack-implementations/access-control-attacks';
import { InputValidationAttackTester } from './attack-implementations/input-validation-attacks';
import { DoubleSpendingAttackTester } from './attack-implementations/double-spending-attacks';
import { DOSAttackTester } from './attack-implementations/dos-attacks';
import { SwapAttackTester } from './attack-implementations/swap-attacks';
import { StakingAttacks } from './attack-implementations/staking-attacks';
import { EstateAttacks } from './attack-implementations/estate-attacks';
import { AppFactoryAttacks } from './attack-implementations/factory-attacks';
import { CrossProgramAttacks } from './attack-implementations/cross-program-attacks';
import { AttackSuccessDetector } from './attack-detector';
import { PerformanceMeasurement } from './performance-measurement';
import { StateSnapshotManager } from './state-snapshots';
import { HistoricalAnalyzer } from './historical-analysis';
import { TransactionAnalyzer } from './transaction-analyzer';
import { WebSocketMonitor } from './websocket-monitor';
import { OracleIntegration } from './oracle-integration';
import { PROGRAMS } from './constants';

export interface TestResult {
  testName: string;
  category: string;
  program: string;
  passed: boolean;
  executionTime: number;
  error?: string;
  details: any;
  timestamp: Date;
}

export interface TestSuiteReport {
  summary: {
    totalTests: number;
    passed: number;
    failed: number;
    skipped: number;
    executionTime: number;
    testDate: Date;
  };
  results: TestResult[];
  categoryBreakdown: Map<string, {
    total: number;
    passed: number;
    failed: number;
  }>;
  programBreakdown: Map<string, {
    total: number;
    passed: number;
    failed: number;
  }>;
  recommendations: string[];
  securityScore: number;
}

export class ComprehensiveTestSuite {
  private connection: Connection;
  private infrastructure: SecurityTestInfrastructure;
  private results: TestResult[] = [];
  private startTime: number = 0;

  constructor(connection: Connection) {
    this.connection = connection;
    this.infrastructure = new SecurityTestInfrastructure(connection);
  }

  /**
   * Run all security tests
   */
  async runFullSuite(): Promise<TestSuiteReport> {
    console.log('🔒 Starting Comprehensive Security Test Suite...\n');
    this.startTime = Date.now();
    this.results = [];

    // Setup test environment
    console.log('📦 Setting up test infrastructure...');
    const env = await this.infrastructure.setupTestEnvironment();
    console.log('✅ Test environment ready\n');

    // Run tests by category
    await this.runAccessControlTests(env);
    await this.runOverflowTests(env);
    await this.runReentrancyTests(env);
    await this.runInputValidationTests(env);
    await this.runDoubleSpendingTests(env);
    await this.runDOSTests(env);
    await this.runProgramSpecificTests(env);
    await this.runCrossProgramTests(env);
    await this.runInfrastructureTests(env);

    // Generate report
    return this.generateReport();
  }

  /**
   * Run access control tests
   */
  private async runAccessControlTests(env: any): Promise<void> {
    console.log('\n🔐 Running Access Control Tests...');
    const attacks = new AccessControlAttackTester(this.connection, env);
    
    await this.runTest(
      'Unauthorized Admin Operation',
      'Access Control',
      'All Programs',
      async () => {
        const results = [];
        for (const [name, program] of Object.entries(env.programs)) {
          const result = await attacks.testUnauthorizedAdminAccess(
            program as Program
          );
          results.push({ programName: name, ...result });
        }
        return { allPrevented: results.every(r => r.success === false), results };
      }
    );

    await this.runTest(
      'Privilege Escalation',
      'Access Control',
      'All Programs',
      async () => {
        const results = [];
        for (const [name, program] of Object.entries(env.programs)) {
          const result = await attacks.testPrivilegeEscalation(
            program as Program,
            env.attackerWallet,
            env.adminWallet
          );
          results.push({ programName: name, ...result });
        }
        return { allPrevented: results.every(r => r.success === false), results };
      }
    );
  }

  /**
   * Run overflow/underflow tests
   */
  private async runOverflowTests(env: any): Promise<void> {
    console.log('\n🔢 Running Overflow/Underflow Tests...');
    const attacks = new OverflowAttackTester(this.connection, env);
    
    await this.runTest(
      'Tier Price Overflow',
      'Integer Overflow',
      'Swap Program',
      async () => await attacks.testTierPriceOverflow(env.programs.swap, env.adminWallet)
    );

    await this.runTest(
      'Amount Underflow',
      'Integer Underflow',
      'Swap Program',
      async () => await attacks.testAmountUnderflow(
        env.programs.swap,
        env.attackerWallet,
        env.tokenMint
      )
    );

    await this.runTest(
      'Reward Calculation Overflow',
      'Integer Overflow',
      'Staking Program',
      async () => await attacks.testRewardCalculationOverflow(
        env.programs.staking,
        env.attackerWallet,
        env.tokenMint
      )
    );
  }

  /**
   * Run reentrancy tests
   */
  private async runReentrancyTests(env: any): Promise<void> {
    console.log('\n🔄 Running Reentrancy Tests...');
    const attacks = new ReentrancyAttackTester(this.connection, env);
    
    await this.runTest(
      'Swap Reentrancy',
      'Reentrancy',
      'Swap Program',
      async () => await attacks.testSwapReentrancy(
        env.programs.swap,
        env.attackerWallet,
        env.tokenMint
      )
    );

    await this.runTest(
      'Claim Reentrancy',
      'Reentrancy',
      'Staking Program',
      async () => await attacks.testClaimReentrancy(
        env.programs.staking,
        env.attackerWallet,
        env.tokenMint
      )
    );

    await this.runTest(
      'Cross-Program Reentrancy',
      'Reentrancy',
      'Multiple Programs',
      async () => await attacks.testCrossProgramReentrancy(
        env.programs.swap,
        env.programs.staking,
        env.attackerWallet,
        env.tokenMint
      )
    );
  }

  /**
   * Run input validation tests
   */
  private async runInputValidationTests(env: any): Promise<void> {
    console.log('\n✅ Running Input Validation Tests...');
    const attacks = new InputValidationAttackTester(this.connection, env);
    
    await this.runTest(
      'Zero Amount Swap',
      'Input Validation',
      'Swap Program',
      async () => await attacks.testZeroAmountSwap(
        env.programs.swap,
        env.attackerWallet,
        env.tokenMint
      )
    );

    await this.runTest(
      'Invalid Parameters',
      'Input Validation',
      'All Programs',
      async () => {
        const results = [];
        for (const [name, program] of Object.entries(env.programs)) {
          const result = await attacks.testInvalidParameters(
            program as Program,
            env.attackerWallet
          );
          results.push({ programName: name, ...result });
        }
        return { allValidated: results.every(r => r.success === false), results };
      }
    );

    await this.runTest(
      'Buffer Overflow Attempt',
      'Input Validation',
      'Estate Program',
      async () => await attacks.testBufferOverflow(
        env.programs.estate,
        env.attackerWallet
      )
    );
  }

  /**
   * Run double spending tests
   */
  private async runDoubleSpendingTests(env: any): Promise<void> {
    console.log('\n💸 Running Double Spending Tests...');
    const attacks = new DoubleSpendingAttackTester(this.connection, env);
    
    await this.runTest(
      'Concurrent Token Spend',
      'Double Spending',
      'Swap Program',
      async () => await attacks.testConcurrentTokenSpend(
        env.programs.swap,
        env.attackerWallet,
        env.tokenMint
      )
    );

    await this.runTest(
      'Race Condition Exploit',
      'Double Spending',
      'Staking Program',
      async () => await attacks.testRaceConditionExploit(
        env.programs.staking,
        env.attackerWallet,
        env.tokenMint
      )
    );

    await this.runTest(
      'Transaction Replay',
      'Double Spending',
      'All Programs',
      async () => await attacks.testTransactionReplay(
        env.programs.swap,
        env.attackerWallet,
        env.tokenMint
      )
    );
  }

  /**
   * Run DOS tests
   */
  private async runDOSTests(env: any): Promise<void> {
    console.log('\n🚫 Running DOS Attack Tests...');
    const attacks = new DOSAttackTester(this.connection, env);
    
    await this.runTest(
      'Resource Exhaustion',
      'DOS',
      'All Programs',
      async () => await attacks.testResourceExhaustion(
        env.programs.swap,
        env.attackerWallet
      )
    );

    await this.runTest(
      'State Bloat Attack',
      'DOS',
      'Estate Program',
      async () => await attacks.testStateBloat(
        env.programs.estate,
        env.attackerWallet
      )
    );

    await this.runTest(
      'Transaction Spam',
      'DOS',
      'Swap Program',
      async () => await attacks.testTransactionSpam(
        env.programs.swap,
        env.attackerWallet,
        env.tokenMint
      )
    );
  }

  /**
   * Run program-specific tests
   */
  private async runProgramSpecificTests(env: any): Promise<void> {
    console.log('\n🎯 Running Program-Specific Tests...');
    
    // Swap-specific tests
    const swapAttacks = new SwapAttackTester(this.connection, env);
    await this.runTest(
      'Price Manipulation',
      'Program-Specific',
      'Swap Program',
      async () => await swapAttacks.testPriceManipulation(
        env.programs.swap,
        env.attackerWallet,
        env.tokenMint
      )
    );

    await this.runTest(
      'Slippage Exploit',
      'Program-Specific',
      'Swap Program',
      async () => await swapAttacks.testSlippageExploit(
        env.programs.swap,
        env.attackerWallet,
        env.tokenMint
      )
    );

    // Staking-specific tests
    const stakingAttacks = new StakingAttacks(this.connection);
    await this.runTest(
      'Reward Manipulation',
      'Program-Specific',
      'Staking Program',
      async () => await stakingAttacks.testRewardManipulation(
        env.programs.staking,
        env.attackerWallet,
        env.tokenMint
      )
    );

    await this.runTest(
      'Early Unstaking Exploit',
      'Program-Specific',
      'Staking Program',
      async () => await stakingAttacks.testEarlyUnstaking(
        env.programs.staking,
        env.attackerWallet,
        env.tokenMint
      )
    );

    // Estate-specific tests
    const estateAttacks = new EstateAttacks(this.connection);
    await this.runTest(
      'NFT Duplication',
      'Program-Specific',
      'Estate Program',
      async () => await estateAttacks.testNFTDuplication(
        env.programs.estate,
        env.attackerWallet
      )
    );

    await this.runTest(
      'Metadata Tampering',
      'Program-Specific',
      'Estate Program',
      async () => await estateAttacks.testMetadataTampering(
        env.programs.estate,
        env.attackerWallet
      )
    );

    // Factory-specific tests
    const factoryAttacks = new AppFactoryAttacks(env);
    await this.runTest(
      'Malicious App Deployment',
      'Program-Specific',
      'App Factory Program',
      async () => await factoryAttacks.testMaliciousDeployment(
        env.programs.appFactory,
        env.attackerWallet
      )
    );

    await this.runTest(
      'Purchase Bypass',
      'Program-Specific',
      'App Factory Program',
      async () => await factoryAttacks.testPurchaseBypass(
        env.programs.appFactory,
        env.attackerWallet,
        env.tokenMint
      )
    );
  }

  /**
   * Run cross-program tests
   */
  private async runCrossProgramTests(env: any): Promise<void> {
    console.log('\n🔗 Running Cross-Program Tests...');
    const attacks = new CrossProgramAttacks(this.connection);
    
    await this.runTest(
      'Swap-Staking Exploit',
      'Cross-Program',
      'Swap + Staking',
      async () => await attacks.testSwapStakingExploit(
        env.programs.swap,
        env.programs.staking,
        env.attackerWallet,
        env.tokenMint
      )
    );

    await this.runTest(
      'Estate-Factory Manipulation',
      'Cross-Program',
      'Estate + Factory',
      async () => await attacks.testEstateFactoryManipulation(
        env.programs.estate,
        env.programs.appFactory,
        env.attackerWallet
      )
    );

    await this.runTest(
      'Complex Attack Chain',
      'Cross-Program',
      'All Programs',
      async () => await attacks.testComplexAttackChain(
        env.programs,
        env.attackerWallet,
        env.tokenMint
      )
    );
  }

  /**
   * Run infrastructure tests
   */
  private async runInfrastructureTests(env: any): Promise<void> {
    console.log('\n🏗️ Running Infrastructure Tests...');
    
    await this.runTest(
      'Attack Detection',
      'Infrastructure',
      'Detection System',
      async () => {
        const detector = new AttackSuccessDetector(this.connection);
        const mockResult = {
          attackType: 'test',
          success: false,
          transactions: ['test-sig'],
          details: { test: true }
        };
        const analysis = await detector.analyzeAttackResult(mockResult);
        return { 
          detectionWorking: analysis.detected,
          confidence: analysis.confidence
        };
      }
    );

    await this.runTest(
      'Performance Monitoring',
      'Infrastructure',
      'Performance System',
      async () => {
        const perfMon = new PerformanceMeasurement(this.connection);
        const metrics = await perfMon.measureInstructionPerformance(
          env.programs.swap,
          'swapTokens',
          env.adminWallet
        );
        return { 
          metricsCollected: metrics.computeUnits > 0,
          metrics
        };
      }
    );

    await this.runTest(
      'State Snapshot',
      'Infrastructure',
      'Snapshot System',
      async () => {
        const snapshots = new StateSnapshotManager(this.connection);
        const snapshot = await snapshots.captureAccountState(env.adminWallet.publicKey);
        return { 
          snapshotWorking: snapshot.address === env.adminWallet.publicKey.toBase58(),
          lamports: snapshot.lamports
        };
      }
    );

    await this.runTest(
      'Oracle Integration',
      'Infrastructure',
      'Oracle System',
      async () => {
        const oracle = new OracleIntegration(this.connection);
        const mockOracle = await oracle.createMockOracle(env.adminWallet);
        return { 
          oracleCreated: mockOracle !== null,
          oracleAddress: mockOracle?.toBase58()
        };
      }
    );
  }

  /**
   * Run individual test with error handling
   */
  private async runTest(
    testName: string,
    category: string,
    program: string,
    testFn: () => Promise<any>
  ): Promise<void> {
    const startTime = Date.now();
    let result: TestResult;

    try {
      console.log(`  Running: ${testName}...`);
      const details = await testFn();
      const passed = this.evaluateTestResult(details);
      
      result = {
        testName,
        category,
        program,
        passed,
        executionTime: Date.now() - startTime,
        details,
        timestamp: new Date()
      };
      
      console.log(`  ${passed ? '✅' : '❌'} ${testName} (${result.executionTime}ms)`);
    } catch (error: any) {
      result = {
        testName,
        category,
        program,
        passed: false,
        executionTime: Date.now() - startTime,
        error: error.message,
        details: { error: error.toString() },
        timestamp: new Date()
      };
      
      console.log(`  ❌ ${testName} - Error: ${error.message}`);
    }

    this.results.push(result);
  }

  /**
   * Evaluate test results to determine pass/fail
   */
  private evaluateTestResult(details: any): boolean {
    // Tests pass if attacks are prevented (success === false)
    if (details.success === false) return true;
    if (details.allPrevented === true) return true;
    if (details.allValidated === true) return true;
    if (details.detectionWorking === true) return true;
    if (details.metricsCollected === true) return true;
    if (details.snapshotWorking === true) return true;
    if (details.oracleCreated === true) return true;
    
    // Default to failed if attack succeeded
    return false;
  }

  /**
   * Generate comprehensive test report
   */
  private generateReport(): TestSuiteReport {
    const totalTests = this.results.length;
    const passed = this.results.filter(r => r.passed).length;
    const failed = this.results.filter(r => !r.passed).length;
    const executionTime = Date.now() - this.startTime;

    // Category breakdown
    const categoryBreakdown = new Map<string, any>();
    const programBreakdown = new Map<string, any>();

    for (const result of this.results) {
      // Update category stats
      if (!categoryBreakdown.has(result.category)) {
        categoryBreakdown.set(result.category, { total: 0, passed: 0, failed: 0 });
      }
      const catStats = categoryBreakdown.get(result.category)!;
      catStats.total++;
      if (result.passed) catStats.passed++;
      else catStats.failed++;

      // Update program stats
      if (!programBreakdown.has(result.program)) {
        programBreakdown.set(result.program, { total: 0, passed: 0, failed: 0 });
      }
      const progStats = programBreakdown.get(result.program)!;
      progStats.total++;
      if (result.passed) progStats.passed++;
      else progStats.failed++;
    }

    // Calculate security score
    const securityScore = Math.round((passed / totalTests) * 100);

    // Generate recommendations
    const recommendations = this.generateRecommendations();

    return {
      summary: {
        totalTests,
        passed,
        failed,
        skipped: 0,
        executionTime,
        testDate: new Date()
      },
      results: this.results,
      categoryBreakdown,
      programBreakdown,
      recommendations,
      securityScore
    };
  }

  /**
   * Generate security recommendations based on results
   */
  private generateRecommendations(): string[] {
    const recommendations: string[] = [];
    const failedTests = this.results.filter(r => !r.passed);

    // Analyze failed tests by category
    const failedCategories = new Set(failedTests.map(t => t.category));

    if (failedCategories.has('Access Control')) {
      recommendations.push('Strengthen access control mechanisms and implement role-based permissions');
    }
    if (failedCategories.has('Integer Overflow')) {
      recommendations.push('Add overflow protection using checked arithmetic operations');
    }
    if (failedCategories.has('Reentrancy')) {
      recommendations.push('Implement reentrancy guards and check-effects-interactions pattern');
    }
    if (failedCategories.has('Input Validation')) {
      recommendations.push('Add comprehensive input validation and parameter bounds checking');
    }
    if (failedCategories.has('Double Spending')) {
      recommendations.push('Implement proper state locking and atomic operations');
    }
    if (failedCategories.has('DOS')) {
      recommendations.push('Add rate limiting and resource consumption controls');
    }
    if (failedCategories.has('Cross-Program')) {
      recommendations.push('Review cross-program invocation security and add verification checks');
    }

    // Program-specific recommendations
    const failedPrograms = new Set(failedTests.map(t => t.program));
    
    if (failedPrograms.has('Swap Program')) {
      recommendations.push('Review swap program price calculation and slippage protection');
    }
    if (failedPrograms.has('Staking Program')) {
      recommendations.push('Audit staking reward calculations and time-lock mechanisms');
    }
    if (failedPrograms.has('Estate Program')) {
      recommendations.push('Enhance NFT verification and metadata validation');
    }
    if (failedPrograms.has('App Factory Program')) {
      recommendations.push('Strengthen deployment verification and purchase validation');
    }

    // General recommendations
    if (failedTests.length > 0) {
      recommendations.push('Consider a professional security audit before mainnet deployment');
      recommendations.push('Implement comprehensive monitoring and alerting systems');
    }

    return recommendations;
  }
}

export const runComprehensiveTests = async (connection: Connection) => {
  const suite = new ComprehensiveTestSuite(connection);
  return await suite.runFullSuite();
}; 