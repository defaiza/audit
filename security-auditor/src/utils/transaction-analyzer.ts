import { Connection, PublicKey, ParsedTransactionWithMeta, ParsedInstruction } from '@solana/web3.js';
import { Program } from '@coral-xyz/anchor';
import { PROGRAMS } from './constants';

export interface TransactionAnalysis {
  signature: string;
  timestamp: Date;
  program: string;
  success: boolean;
  suspicious: boolean;
  suspiciousReasons: string[];
  instructionCount: number;
  computeUnitsUsed: number;
  accountsInvolved: string[];
  crossProgramInvocations: string[];
  errorDetails?: any;
  attackVectors: AttackVector[];
}

export interface AttackVector {
  type: string;
  confidence: 'low' | 'medium' | 'high';
  evidence: string[];
  recommendation: string;
}

export interface AnalysisReport {
  totalTransactions: number;
  suspiciousTransactions: number;
  failedTransactions: number;
  attackVectorsSummary: Map<string, number>;
  programActivity: Map<string, number>;
  timeSeriesData: TimeSeriesData[];
  highRiskAccounts: string[];
}

export interface TimeSeriesData {
  timestamp: Date;
  transactionCount: number;
  suspiciousCount: number;
  averageComputeUnits: number;
}

export class TransactionAnalyzer {
  private connection: Connection;
  private suspiciousPatterns: Map<string, RegExp[]>;
  private attackSignatures: Map<string, string[]>;

  constructor(connection: Connection) {
    this.connection = connection;
    this.suspiciousPatterns = this.initializeSuspiciousPatterns();
    this.attackSignatures = this.initializeAttackSignatures();
  }

  /**
   * Analyze a single transaction
   */
  async analyzeTransaction(signature: string): Promise<TransactionAnalysis> {
    try {
      const tx = await this.connection.getParsedTransaction(signature, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0
      });

      if (!tx) {
        throw new Error('Transaction not found');
      }

      const timestamp = new Date((tx.blockTime || 0) * 1000);
      const success = tx.meta?.err === null;
      const computeUnitsUsed = tx.meta?.computeUnitsConsumed || 0;
      
      // Extract program and instruction details
      const { program, instructionCount, accountsInvolved, crossProgramInvocations } = 
        this.extractTransactionDetails(tx);

      // Analyze for suspicious patterns
      const { suspicious, suspiciousReasons } = this.analyzeSuspiciousPatterns(tx);

      // Detect attack vectors
      const attackVectors = this.detectAttackVectors(tx);

      return {
        signature,
        timestamp,
        program,
        success,
        suspicious,
        suspiciousReasons,
        instructionCount,
        computeUnitsUsed,
        accountsInvolved,
        crossProgramInvocations,
        errorDetails: tx.meta?.err,
        attackVectors
      };
    } catch (error: any) {
      throw new Error(`Failed to analyze transaction: ${error.message}`);
    }
  }

  /**
   * Analyze multiple transactions
   */
  async analyzeTransactionBatch(
    signatures: string[],
    progressCallback?: (processed: number, total: number) => void
  ): Promise<AnalysisReport> {
    const analyses: TransactionAnalysis[] = [];
    const attackVectorsSummary = new Map<string, number>();
    const programActivity = new Map<string, number>();
    const highRiskAccounts = new Set<string>();
    const timeSeriesMap = new Map<string, TimeSeriesData>();

    // Process transactions in batches
    const batchSize = 10;
    for (let i = 0; i < signatures.length; i += batchSize) {
      const batch = signatures.slice(i, i + batchSize);
      const batchPromises = batch.map(sig => this.analyzeTransaction(sig));
      
      try {
        const batchResults = await Promise.all(batchPromises);
        analyses.push(...batchResults);
        
        // Update progress
        if (progressCallback) {
          progressCallback(Math.min(i + batchSize, signatures.length), signatures.length);
        }
      } catch (error) {
        console.error(`Error analyzing batch ${i / batchSize}:`, error);
      }
    }

    // Process analysis results
    for (const analysis of analyses) {
      // Update program activity
      const count = programActivity.get(analysis.program) || 0;
      programActivity.set(analysis.program, count + 1);

      // Update attack vectors summary
      for (const vector of analysis.attackVectors) {
        const vectorCount = attackVectorsSummary.get(vector.type) || 0;
        attackVectorsSummary.set(vector.type, vectorCount + 1);
      }

      // Identify high-risk accounts
      if (analysis.suspicious || analysis.attackVectors.length > 0) {
        analysis.accountsInvolved.forEach(account => highRiskAccounts.add(account));
      }

      // Update time series data
      const hourKey = this.getHourKey(analysis.timestamp);
      const existing = timeSeriesMap.get(hourKey) || {
        timestamp: new Date(hourKey),
        transactionCount: 0,
        suspiciousCount: 0,
        averageComputeUnits: 0
      };

      existing.transactionCount++;
      if (analysis.suspicious) existing.suspiciousCount++;
      existing.averageComputeUnits = 
        (existing.averageComputeUnits * (existing.transactionCount - 1) + analysis.computeUnitsUsed) / 
        existing.transactionCount;

      timeSeriesMap.set(hourKey, existing);
    }

    return {
      totalTransactions: analyses.length,
      suspiciousTransactions: analyses.filter(a => a.suspicious).length,
      failedTransactions: analyses.filter(a => !a.success).length,
      attackVectorsSummary,
      programActivity,
      timeSeriesData: Array.from(timeSeriesMap.values()).sort((a, b) => 
        a.timestamp.getTime() - b.timestamp.getTime()
      ),
      highRiskAccounts: Array.from(highRiskAccounts)
    };
  }

  /**
   * Extract transaction details
   */
  private extractTransactionDetails(tx: ParsedTransactionWithMeta): {
    program: string;
    instructionCount: number;
    accountsInvolved: string[];
    crossProgramInvocations: string[];
  } {
    const accountsInvolved = new Set<string>();
    const crossProgramInvocations = new Set<string>();
    let mainProgram = '';
    let instructionCount = 0;

    if (tx.transaction.message.instructions) {
      for (const ix of tx.transaction.message.instructions) {
        instructionCount++;
        
        if ('programId' in ix) {
          const programId = ix.programId.toBase58();
          if (!mainProgram) mainProgram = programId;
          
          // Check if it's a cross-program invocation
          if (programId !== mainProgram) {
            crossProgramInvocations.add(programId);
          }
        }

        // Collect accounts
        if ('accounts' in ix && Array.isArray(ix.accounts)) {
          ix.accounts.forEach(acc => accountsInvolved.add(acc.toBase58()));
        }
      }
    }

    // Include inner instructions
    if (tx.meta?.innerInstructions) {
      for (const inner of tx.meta.innerInstructions) {
        for (const ix of inner.instructions) {
          instructionCount++;
          if ('programId' in ix) {
            const programId = ix.programId.toBase58();
            if (programId !== mainProgram) {
              crossProgramInvocations.add(programId);
            }
          }
        }
      }
    }

    // Identify main program
    const programId = this.identifyMainProgram(mainProgram);

    return {
      program: programId,
      instructionCount,
      accountsInvolved: Array.from(accountsInvolved),
      crossProgramInvocations: Array.from(crossProgramInvocations)
    };
  }

  /**
   * Analyze for suspicious patterns
   */
  private analyzeSuspiciousPatterns(tx: ParsedTransactionWithMeta): {
    suspicious: boolean;
    suspiciousReasons: string[];
  } {
    const suspiciousReasons: string[] = [];
    
    // Check logs for suspicious patterns
    if (tx.meta?.logMessages) {
      const logText = tx.meta.logMessages.join(' ').toLowerCase();
      
      Array.from(this.suspiciousPatterns).forEach(([category, patterns]) => {
        patterns.forEach(pattern => {
          if (pattern.test(logText)) {
            suspiciousReasons.push(`Suspicious ${category} pattern detected`);
          }
        });
      });
    }

    // Check for high compute usage
    if (tx.meta?.computeUnitsConsumed && tx.meta.computeUnitsConsumed > 900000) {
      suspiciousReasons.push('Abnormally high compute usage');
    }

    // Check for many account writes
    const writeAccounts = tx.transaction.message.accountKeys.filter((_, idx) => 
      tx.transaction.message.instructions.some(ix => 
        'accounts' in ix && ix.accounts[idx] && tx.meta?.preBalances[idx] !== tx.meta?.postBalances[idx]
      )
    );
    
    if (writeAccounts.length > 10) {
      suspiciousReasons.push('Unusually high number of account modifications');
    }

    // Check for failed transaction with specific error patterns
    if (tx.meta?.err) {
      const errorStr = JSON.stringify(tx.meta.err).toLowerCase();
      if (errorStr.includes('overflow') || errorStr.includes('underflow')) {
        suspiciousReasons.push('Arithmetic overflow/underflow attempt');
      }
      if (errorStr.includes('unauthorized') || errorStr.includes('access')) {
        suspiciousReasons.push('Unauthorized access attempt');
      }
    }

    return {
      suspicious: suspiciousReasons.length > 0,
      suspiciousReasons
    };
  }

  /**
   * Detect specific attack vectors
   */
  private detectAttackVectors(tx: ParsedTransactionWithMeta): AttackVector[] {
    const attackVectors: AttackVector[] = [];
    const logText = tx.meta?.logMessages?.join(' ').toLowerCase() || '';

    // Integer overflow/underflow detection
    if (this.detectOverflowPatterns(tx, logText)) {
      attackVectors.push({
        type: 'Integer Overflow/Underflow',
        confidence: 'high',
        evidence: ['Arithmetic error in logs', 'Large numeric values detected'],
        recommendation: 'Implement checked arithmetic operations'
      });
    }

    // Reentrancy detection
    if (this.detectReentrancyPatterns(tx, logText)) {
      attackVectors.push({
        type: 'Reentrancy',
        confidence: 'medium',
        evidence: ['Recursive program calls detected', 'Multiple identical instructions'],
        recommendation: 'Add reentrancy guards to critical functions'
      });
    }

    // Access control violations
    if (this.detectAccessControlViolations(tx, logText)) {
      attackVectors.push({
        type: 'Access Control Violation',
        confidence: 'high',
        evidence: ['Unauthorized access attempt', 'Signer mismatch'],
        recommendation: 'Strengthen access control checks'
      });
    }

    // Double spending attempts
    if (this.detectDoubleSpendingPatterns(tx, logText)) {
      attackVectors.push({
        type: 'Double Spending',
        confidence: 'medium',
        evidence: ['Multiple spend attempts', 'Duplicate transaction patterns'],
        recommendation: 'Implement nonce-based ordering'
      });
    }

    // DOS patterns
    if (this.detectDOSPatterns(tx, logText)) {
      attackVectors.push({
        type: 'Denial of Service',
        confidence: 'low',
        evidence: ['High resource consumption', 'Excessive operations'],
        recommendation: 'Add rate limiting and resource caps'
      });
    }

    return attackVectors;
  }

  private detectOverflowPatterns(tx: ParsedTransactionWithMeta, logText: string): boolean {
    if (logText.includes('overflow') || logText.includes('underflow')) return true;
    
    // Check for very large numbers in instruction data
    if (tx.transaction.message.instructions) {
      for (const ix of tx.transaction.message.instructions) {
        if ('data' in ix && ix.data) {
          try {
            const data = Buffer.from(ix.data, 'base64');
            // Check for MAX_U64 or very large values
            if (data.length >= 8) {
              const value = data.readBigUInt64LE(0);
              if (value === BigInt('18446744073709551615')) return true;
            }
          } catch {}
        }
      }
    }
    
    return false;
  }

  private detectReentrancyPatterns(tx: ParsedTransactionWithMeta, logText: string): boolean {
    if (logText.includes('reentrant') || logText.includes('recursive')) return true;
    
    // Check for repeated program invocations
    const programCalls = new Map<string, number>();
    
    if (tx.meta?.innerInstructions) {
      for (const inner of tx.meta.innerInstructions) {
        for (const ix of inner.instructions) {
          if ('programId' in ix) {
            const programId = ix.programId.toBase58();
            const count = programCalls.get(programId) || 0;
            programCalls.set(programId, count + 1);
          }
        }
      }
    }
    
    // Multiple calls to same program might indicate reentrancy
    return Array.from(programCalls.values()).some(count => count > 3);
  }

  private detectAccessControlViolations(tx: ParsedTransactionWithMeta, logText: string): boolean {
         return logText.includes('unauthorized') || 
            logText.includes('access denied') ||
            logText.includes('not authorized') ||
            (tx.meta?.err !== null && tx.meta?.err !== undefined && JSON.stringify(tx.meta.err).includes('SignerMissing'));
  }

  private detectDoubleSpendingPatterns(tx: ParsedTransactionWithMeta, logText: string): boolean {
    return logText.includes('already spent') ||
           logText.includes('duplicate') ||
           logText.includes('nonce') ||
           logText.includes('replay');
  }

  private detectDOSPatterns(tx: ParsedTransactionWithMeta, logText: string): boolean {
    // High compute usage
    if (tx.meta?.computeUnitsConsumed && tx.meta.computeUnitsConsumed > 1200000) return true;
    
    // Many accounts or instructions
    if (tx.transaction.message.accountKeys.length > 20) return true;
    if (tx.transaction.message.instructions.length > 10) return true;
    
    // Error patterns
    return logText.includes('exhausted') ||
           logText.includes('limit exceeded') ||
           logText.includes('too many');
  }

  /**
   * Initialize suspicious patterns
   */
  private initializeSuspiciousPatterns(): Map<string, RegExp[]> {
    return new Map([
      ['overflow', [/overflow/i, /underflow/i, /wrapped/i]],
      ['reentrancy', [/reentrant/i, /recursive/i, /already processing/i]],
      ['access_control', [/unauthorized/i, /forbidden/i, /not authorized/i]],
      ['double_spend', [/already spent/i, /duplicate/i, /replay/i]],
      ['dos', [/exhausted/i, /too many/i, /limit exceeded/i]],
      ['manipulation', [/manipulat/i, /exploit/i, /bypass/i]]
    ]);
  }

  /**
   * Initialize attack signatures
   */
  private initializeAttackSignatures(): Map<string, string[]> {
    return new Map([
      ['overflow_attack', ['overflow', 'maximum value', 'wrapped around']],
      ['reentrancy_attack', ['recursive call', 'reentrant', 'nested invocation']],
      ['access_control_attack', ['unauthorized', 'signer missing', 'invalid authority']],
      ['double_spend_attack', ['nonce mismatch', 'already processed', 'duplicate transaction']],
      ['dos_attack', ['compute exceeded', 'account limit', 'transaction too large']]
    ]);
  }

  /**
   * Identify main program from program ID
   */
  private identifyMainProgram(programId: string): string {
    for (const [name, details] of Object.entries(PROGRAMS)) {
      if (details.programId === programId) {
        return name;
      }
    }
    return programId;
  }

  /**
   * Get hour key for time series grouping
   */
  private getHourKey(date: Date): string {
    const d = new Date(date);
    d.setMinutes(0, 0, 0);
    return d.toISOString();
  }

  /**
   * Generate attack detection report
   */
  generateReport(analysis: AnalysisReport): string {
    const suspiciousRate = (analysis.suspiciousTransactions / analysis.totalTransactions * 100).toFixed(2);
    const failureRate = (analysis.failedTransactions / analysis.totalTransactions * 100).toFixed(2);

    let report = `# Transaction Analysis Report

## Summary
- Total Transactions Analyzed: ${analysis.totalTransactions}
- Suspicious Transactions: ${analysis.suspiciousTransactions} (${suspiciousRate}%)
- Failed Transactions: ${analysis.failedTransactions} (${failureRate}%)

## Attack Vectors Detected
`;

    Array.from(analysis.attackVectorsSummary).forEach(([vector, count]) => {
      report += `- ${vector}: ${count} occurrences\n`;
    });

    report += `\n## Program Activity\n`;
    Array.from(analysis.programActivity).forEach(([program, count]) => {
      report += `- ${program}: ${count} transactions\n`;
    });

    if (analysis.highRiskAccounts.length > 0) {
      report += `\n## High Risk Accounts\n`;
      analysis.highRiskAccounts.slice(0, 10).forEach(account => {
        report += `- ${account}\n`;
      });
    }

    return report;
  }
}

// Export factory function
export const createTransactionAnalyzer = (connection: Connection) => 
  new TransactionAnalyzer(connection); 