import { Connection, PublicKey, ParsedTransactionWithMeta } from '@solana/web3.js';
import { Program } from '@coral-xyz/anchor';
import { TransactionAnalyzer, TransactionAnalysis } from './transaction-analyzer';
import { WebSocketMonitor, TransactionAlert } from './websocket-monitor';
import { PROGRAMS } from './constants';

export interface HistoricalPattern {
  type: 'attack' | 'anomaly' | 'normal';
  pattern: string;
  frequency: number;
  timeRange: { start: Date; end: Date };
  affectedPrograms: string[];
  confidence: number;
  details: any;
}

export interface TrendAnalysis {
  period: 'hourly' | 'daily' | 'weekly';
  trends: {
    timestamp: Date;
    transactionVolume: number;
    errorRate: number;
    suspiciousActivity: number;
    attackAttempts: number;
    uniqueAccounts: number;
  }[];
  predictions: {
    nextPeriodVolume: number;
    riskLevel: 'low' | 'medium' | 'high';
    confidence: number;
  };
}

export interface HistoricalReport {
  timeRange: { start: Date; end: Date };
  totalTransactions: number;
  patterns: HistoricalPattern[];
  trends: TrendAnalysis;
  riskScore: number;
  recommendations: string[];
  attackTimeline: AttackEvent[];
}

export interface AttackEvent {
  timestamp: Date;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  program: string;
  signature: string;
  description: string;
}

export class HistoricalAnalyzer {
  private connection: Connection;
  private transactionAnalyzer: TransactionAnalyzer;
  private patternCache: Map<string, HistoricalPattern>;
  private attackHistory: AttackEvent[];

  constructor(connection: Connection) {
    this.connection = connection;
    this.transactionAnalyzer = new TransactionAnalyzer(connection);
    this.patternCache = new Map();
    this.attackHistory = [];
  }

  /**
   * Analyze historical transactions for a program
   */
  async analyzeProgram(
    programId: PublicKey,
    hoursBack: number = 24
  ): Promise<HistoricalReport> {
    console.log(`📊 Analyzing ${hoursBack} hours of history for ${programId.toBase58()}...`);
    
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - hoursBack * 3600 * 1000);
    
    // Fetch historical signatures
    const signatures = await this.fetchHistoricalSignatures(programId, startTime, endTime);
    console.log(`Found ${signatures.length} transactions to analyze`);
    
    // Analyze transactions in batches
    const analyses: TransactionAnalysis[] = [];
    const batchSize = 50;
    
    for (let i = 0; i < signatures.length; i += batchSize) {
      const batch = signatures.slice(i, i + batchSize);
      const batchAnalyses = await Promise.all(
        batch.map(sig => this.transactionAnalyzer.analyzeTransaction(sig))
      );
      analyses.push(...batchAnalyses);
      
      // Progress update
      console.log(`Analyzed ${Math.min(i + batchSize, signatures.length)}/${signatures.length} transactions`);
    }
    
    // Detect patterns
    const patterns = this.detectPatterns(analyses, startTime, endTime);
    
    // Analyze trends
    const trends = this.analyzeTrends(analyses, hoursBack);
    
    // Build attack timeline
    const attackTimeline = this.buildAttackTimeline(analyses);
    
    // Calculate risk score
    const riskScore = this.calculateHistoricalRiskScore(patterns, trends, attackTimeline);
    
    // Generate recommendations
    const recommendations = this.generateRecommendations(patterns, trends, riskScore);
    
    return {
      timeRange: { start: startTime, end: endTime },
      totalTransactions: analyses.length,
      patterns,
      trends,
      riskScore,
      recommendations,
      attackTimeline
    };
  }

  /**
   * Fetch historical transaction signatures
   */
  private async fetchHistoricalSignatures(
    programId: PublicKey,
    startTime: Date,
    endTime: Date
  ): Promise<string[]> {
    const signatures: string[] = [];
    let before: string | undefined;
    
    try {
      while (true) {
        const result = await this.connection.getSignaturesForAddress(
          programId,
          { before, limit: 1000 }
        );
        
        if (result.length === 0) break;
        
        for (const sigInfo of result) {
          const timestamp = new Date((sigInfo.blockTime || 0) * 1000);
          
          if (timestamp >= startTime && timestamp <= endTime) {
            signatures.push(sigInfo.signature);
          } else if (timestamp < startTime) {
            // We've gone too far back
            return signatures;
          }
        }
        
        before = result[result.length - 1].signature;
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } catch (error: any) {
      console.error(`Error fetching signatures: ${error.message}`);
    }
    
    return signatures;
  }

  /**
   * Detect patterns in transaction data
   */
  private detectPatterns(
    analyses: TransactionAnalysis[],
    startTime: Date,
    endTime: Date
  ): HistoricalPattern[] {
    const patterns: HistoricalPattern[] = [];
    const patternCounts = new Map<string, number>();
    const programCounts = new Map<string, Set<string>>();
    
    // Count attack vectors
    for (const analysis of analyses) {
      for (const vector of analysis.attackVectors) {
        const key = `${vector.type}_${vector.confidence}`;
        patternCounts.set(key, (patternCounts.get(key) || 0) + 1);
        
        // Track affected programs
        if (!programCounts.has(key)) {
          programCounts.set(key, new Set());
        }
        programCounts.get(key)!.add(analysis.program);
      }
    }
    
    // Identify significant patterns
    const threshold = analyses.length * 0.01; // 1% threshold
    
    Array.from(patternCounts.entries()).forEach(([key, count]) => {
      if (count >= threshold) {
        const [type, confidence] = key.split('_');
        patterns.push({
          type: 'attack',
          pattern: type,
          frequency: count,
          timeRange: { start: startTime, end: endTime },
          affectedPrograms: Array.from(programCounts.get(key) || []),
          confidence: count / analyses.length,
          details: {
            occurrences: count,
            percentage: (count / analyses.length * 100).toFixed(2) + '%'
          }
        });
      }
    });
    
    // Detect time-based patterns
    const timePatterns = this.detectTimeBasedPatterns(analyses);
    patterns.push(...timePatterns);
    
    // Detect account-based patterns
    const accountPatterns = this.detectAccountPatterns(analyses);
    patterns.push(...accountPatterns);
    
    return patterns;
  }

  /**
   * Detect time-based patterns
   */
  private detectTimeBasedPatterns(analyses: TransactionAnalysis[]): HistoricalPattern[] {
    const patterns: HistoricalPattern[] = [];
    const hourlyActivity = new Map<number, number>();
    
    // Group by hour of day
    for (const analysis of analyses) {
      const hour = analysis.timestamp.getHours();
      hourlyActivity.set(hour, (hourlyActivity.get(hour) || 0) + 1);
    }
    
    // Find unusual activity hours
    const avgHourlyActivity = analyses.length / 24;
    
    Array.from(hourlyActivity.entries()).forEach(([hour, count]) => {
      if (count > avgHourlyActivity * 2) {
        patterns.push({
          type: 'anomaly',
          pattern: `High activity at hour ${hour}:00`,
          frequency: count,
          timeRange: { 
            start: new Date(), 
            end: new Date() 
          },
          affectedPrograms: [],
          confidence: 0.7,
          details: {
            hour,
            activityCount: count,
            averageExpected: avgHourlyActivity
          }
        });
      }
    });
    
    return patterns;
  }

  /**
   * Detect account-based patterns
   */
  private detectAccountPatterns(analyses: TransactionAnalysis[]): HistoricalPattern[] {
    const patterns: HistoricalPattern[] = [];
    const accountActivity = new Map<string, number>();
    const suspiciousAccounts = new Map<string, number>();
    
    // Count account activity
    for (const analysis of analyses) {
      for (const account of analysis.accountsInvolved) {
        accountActivity.set(account, (accountActivity.get(account) || 0) + 1);
        
        if (analysis.suspicious) {
          suspiciousAccounts.set(account, (suspiciousAccounts.get(account) || 0) + 1);
        }
      }
    }
    
    // Identify suspicious accounts
    Array.from(suspiciousAccounts.entries()).forEach(([account, suspiciousCount]) => {
      const totalActivity = accountActivity.get(account) || 0;
      const suspiciousRate = suspiciousCount / totalActivity;
      
      if (suspiciousRate > 0.5 && suspiciousCount >= 5) {
        patterns.push({
          type: 'anomaly',
          pattern: 'Suspicious account activity',
          frequency: suspiciousCount,
          timeRange: { start: new Date(), end: new Date() },
          affectedPrograms: [],
          confidence: suspiciousRate,
          details: {
            account,
            totalTransactions: totalActivity,
            suspiciousTransactions: suspiciousCount,
            suspiciousRate: (suspiciousRate * 100).toFixed(2) + '%'
          }
        });
      }
    });
    
    return patterns;
  }

  /**
   * Analyze trends over time
   */
  private analyzeTrends(
    analyses: TransactionAnalysis[],
    hoursBack: number
  ): TrendAnalysis {
    const period: 'hourly' | 'daily' | 'weekly' = 
      hoursBack <= 24 ? 'hourly' : 
      hoursBack <= 168 ? 'daily' : 'weekly';
    
    const trends: TrendAnalysis['trends'] = [];
    const periodMs = period === 'hourly' ? 3600000 : 
                     period === 'daily' ? 86400000 : 604800000;
    
    // Group transactions by period
    const periodGroups = new Map<number, TransactionAnalysis[]>();
    
    for (const analysis of analyses) {
      const periodKey = Math.floor(analysis.timestamp.getTime() / periodMs);
      if (!periodGroups.has(periodKey)) {
        periodGroups.set(periodKey, []);
      }
      periodGroups.get(periodKey)!.push(analysis);
    }
    
    // Calculate metrics for each period
    Array.from(periodGroups.entries())
      .sort((a, b) => a[0] - b[0])
      .forEach(([periodKey, periodAnalyses]) => {
        const timestamp = new Date(periodKey * periodMs);
        const uniqueAccounts = new Set(
          periodAnalyses.flatMap(a => a.accountsInvolved)
        ).size;
        
        trends.push({
          timestamp,
          transactionVolume: periodAnalyses.length,
          errorRate: periodAnalyses.filter(a => !a.success).length / periodAnalyses.length,
          suspiciousActivity: periodAnalyses.filter(a => a.suspicious).length,
          attackAttempts: periodAnalyses.filter(a => a.attackVectors.length > 0).length,
          uniqueAccounts
        });
      });
    
    // Simple prediction based on recent trends
    const predictions = this.predictNextPeriod(trends);
    
    return { period, trends, predictions };
  }

  /**
   * Predict next period activity
   */
  private predictNextPeriod(trends: TrendAnalysis['trends']): TrendAnalysis['predictions'] {
    if (trends.length < 3) {
      return {
        nextPeriodVolume: trends[trends.length - 1]?.transactionVolume || 0,
        riskLevel: 'medium',
        confidence: 0.3
      };
    }
    
    // Simple moving average prediction
    const recentTrends = trends.slice(-3);
    const avgVolume = recentTrends.reduce((sum, t) => sum + t.transactionVolume, 0) / 3;
    const avgSuspicious = recentTrends.reduce((sum, t) => sum + t.suspiciousActivity, 0) / 3;
    
    // Determine risk level
    let riskLevel: 'low' | 'medium' | 'high' = 'low';
    if (avgSuspicious > 10) riskLevel = 'high';
    else if (avgSuspicious > 5) riskLevel = 'medium';
    
    return {
      nextPeriodVolume: Math.round(avgVolume),
      riskLevel,
      confidence: 0.7
    };
  }

  /**
   * Build attack timeline
   */
  private buildAttackTimeline(analyses: TransactionAnalysis[]): AttackEvent[] {
    const timeline: AttackEvent[] = [];
    
    for (const analysis of analyses) {
      if (analysis.attackVectors.length > 0) {
        for (const vector of analysis.attackVectors) {
          timeline.push({
            timestamp: analysis.timestamp,
            type: vector.type,
            severity: this.determineSeverity(vector),
            program: analysis.program,
            signature: analysis.signature,
            description: vector.evidence.join('; ')
          });
        }
      }
    }
    
    // Sort by timestamp
    timeline.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    
    // Store in attack history
    this.attackHistory.push(...timeline);
    
    return timeline;
  }

  /**
   * Determine attack severity
   */
  private determineSeverity(vector: any): 'low' | 'medium' | 'high' | 'critical' {
    if (vector.confidence === 'high' && 
        ['Integer Overflow/Underflow', 'Access Control Violation'].includes(vector.type)) {
      return 'critical';
    }
    if (vector.confidence === 'high') return 'high';
    if (vector.confidence === 'medium') return 'medium';
    return 'low';
  }

  /**
   * Calculate historical risk score
   */
  private calculateHistoricalRiskScore(
    patterns: HistoricalPattern[],
    trends: TrendAnalysis,
    attackTimeline: AttackEvent[]
  ): number {
    let score = 0;
    
    // Pattern-based scoring
    for (const pattern of patterns) {
      if (pattern.type === 'attack') {
        score += pattern.frequency * 2;
      } else if (pattern.type === 'anomaly') {
        score += pattern.frequency;
      }
    }
    
    // Trend-based scoring
    const recentTrends = trends.trends.slice(-3);
    if (recentTrends.length > 0) {
      const avgErrorRate = recentTrends.reduce((sum, t) => sum + t.errorRate, 0) / recentTrends.length;
      score += avgErrorRate * 50;
    }
    
    // Attack timeline scoring
    const criticalAttacks = attackTimeline.filter(a => a.severity === 'critical').length;
    const highAttacks = attackTimeline.filter(a => a.severity === 'high').length;
    
    score += criticalAttacks * 10;
    score += highAttacks * 5;
    
    // Normalize to 0-100
    return Math.min(100, Math.round(score));
  }

  /**
   * Generate recommendations based on analysis
   */
  private generateRecommendations(
    patterns: HistoricalPattern[],
    trends: TrendAnalysis,
    riskScore: number
  ): string[] {
    const recommendations: string[] = [];
    
    // Risk-based recommendations
    if (riskScore >= 80) {
      recommendations.push('CRITICAL: Immediate security review required');
      recommendations.push('Consider temporary suspension of high-risk operations');
    } else if (riskScore >= 60) {
      recommendations.push('HIGH RISK: Increase monitoring frequency');
      recommendations.push('Review and strengthen access controls');
    }
    
    // Pattern-based recommendations
    for (const pattern of patterns) {
      if (pattern.pattern.includes('overflow')) {
        recommendations.push('Implement comprehensive overflow protection');
      }
      if (pattern.pattern.includes('High activity')) {
        recommendations.push('Implement rate limiting during peak hours');
      }
      if (pattern.pattern === 'Suspicious account activity') {
        recommendations.push('Add account blacklisting capability');
      }
    }
    
    // Trend-based recommendations
    if (trends.predictions.riskLevel === 'high') {
      recommendations.push('Prepare for increased attack activity');
      recommendations.push('Ensure incident response team is on standby');
    }
    
    if (trends.trends.length > 0) {
      const latestTrend = trends.trends[trends.trends.length - 1];
      if (latestTrend.errorRate > 0.1) {
        recommendations.push('High error rate detected - investigate failed transactions');
      }
    }
    
    return Array.from(new Set(recommendations));
  }

  /**
   * Compare historical periods
   */
  async comparePeriods(
    programId: PublicKey,
    period1Hours: number,
    period2Hours: number
  ): Promise<{
    period1: HistoricalReport;
    period2: HistoricalReport;
    comparison: {
      volumeChange: number;
      riskChange: number;
      newPatterns: HistoricalPattern[];
      resolvedPatterns: HistoricalPattern[];
    };
  }> {
    // Analyze both periods
    const now = new Date();
    const period1End = new Date(now.getTime() - period2Hours * 3600000);
    const period1 = await this.analyzeProgram(programId, period1Hours);
    
    // Adjust period1 time range
    period1.timeRange.end = period1End;
    period1.timeRange.start = new Date(period1End.getTime() - period1Hours * 3600000);
    
    const period2 = await this.analyzeProgram(programId, period2Hours);
    
    // Compare patterns
    const period1Patterns = new Set(period1.patterns.map(p => p.pattern));
    const period2Patterns = new Set(period2.patterns.map(p => p.pattern));
    
    const newPatterns = period2.patterns.filter(p => !period1Patterns.has(p.pattern));
    const resolvedPatterns = period1.patterns.filter(p => !period2Patterns.has(p.pattern));
    
    return {
      period1,
      period2,
      comparison: {
        volumeChange: period2.totalTransactions - period1.totalTransactions,
        riskChange: period2.riskScore - period1.riskScore,
        newPatterns,
        resolvedPatterns
      }
    };
  }

  /**
   * Generate historical analysis report
   */
  generateReport(analysis: HistoricalReport): string {
    let report = `# Historical Analysis Report

## Time Range
- Start: ${analysis.timeRange.start.toISOString()}
- End: ${analysis.timeRange.end.toISOString()}
- Total Transactions: ${analysis.totalTransactions}
- Risk Score: ${analysis.riskScore}/100

## Detected Patterns
`;

    for (const pattern of analysis.patterns) {
      report += `\n### ${pattern.pattern}
- Type: ${pattern.type}
- Frequency: ${pattern.frequency}
- Confidence: ${(pattern.confidence * 100).toFixed(2)}%
- Programs: ${pattern.affectedPrograms.join(', ') || 'N/A'}
`;
    }

    report += `\n## Attack Timeline\n`;
    const recentAttacks = analysis.attackTimeline.slice(-10);
    for (const attack of recentAttacks) {
      report += `- ${attack.timestamp.toISOString()} [${attack.severity}] ${attack.type}: ${attack.description}\n`;
    }

    report += `\n## Trend Analysis (${analysis.trends.period})\n`;
    const latestTrends = analysis.trends.trends.slice(-5);
    for (const trend of latestTrends) {
      report += `\n### ${trend.timestamp.toISOString()}
- Volume: ${trend.transactionVolume}
- Error Rate: ${(trend.errorRate * 100).toFixed(2)}%
- Suspicious: ${trend.suspiciousActivity}
- Attacks: ${trend.attackAttempts}
`;
    }

    report += `\n## Predictions
- Next Period Volume: ${analysis.trends.predictions.nextPeriodVolume}
- Risk Level: ${analysis.trends.predictions.riskLevel}
- Confidence: ${(analysis.trends.predictions.confidence * 100).toFixed(2)}%

## Recommendations
`;

    for (const rec of analysis.recommendations) {
      report += `- ${rec}\n`;
    }

    return report;
  }
}

// Export factory function
export const createHistoricalAnalyzer = (connection: Connection) =>
  new HistoricalAnalyzer(connection); 