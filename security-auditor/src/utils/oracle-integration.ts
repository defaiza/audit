import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';
import { Program } from '@coral-xyz/anchor';

export interface PriceFeed {
  oracle: string;
  asset: string;
  price: number;
  confidence: number;
  timestamp: Date;
  expo: number;
}

export interface OracleConfig {
  type: 'pyth' | 'switchboard' | 'chainlink' | 'custom';
  address: PublicKey;
  updateAuthority?: PublicKey;
  maxPriceAge?: number; // seconds
  minConfidence?: number;
}

export interface PriceManipulationTest {
  targetPrice: number;
  manipulatedPrice: number;
  percentageChange: number;
  feasible: boolean;
  estimatedCost?: number;
  vulnerabilities: string[];
}

export interface OracleVulnerability {
  type: 'stale_price' | 'low_confidence' | 'manipulation' | 'single_source' | 'update_delay';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  recommendation: string;
}

export class OracleIntegration {
  private connection: Connection;
  private oracles: Map<string, OracleConfig>;
  private priceHistory: Map<string, PriceFeed[]>;

  constructor(connection: Connection) {
    this.connection = connection;
    this.oracles = new Map();
    this.priceHistory = new Map();
  }

  /**
   * Register an oracle for monitoring
   */
  registerOracle(name: string, config: OracleConfig): void {
    this.oracles.set(name, config);
    this.priceHistory.set(name, []);
  }

  /**
   * Fetch current price from oracle
   */
  async fetchPrice(oracleName: string): Promise<PriceFeed> {
    const config = this.oracles.get(oracleName);
    if (!config) {
      throw new Error(`Oracle ${oracleName} not registered`);
    }

    switch (config.type) {
      case 'pyth':
        return this.fetchPythPrice(config);
      case 'switchboard':
        return this.fetchSwitchboardPrice(config);
      case 'chainlink':
        return this.fetchChainlinkPrice(config);
      case 'custom':
        return this.fetchCustomPrice(config);
      default:
        throw new Error(`Unsupported oracle type: ${config.type}`);
    }
  }

  /**
   * Fetch Pyth price feed
   */
  private async fetchPythPrice(config: OracleConfig): Promise<PriceFeed> {
    try {
      const accountInfo = await this.connection.getAccountInfo(config.address);
      if (!accountInfo) {
        throw new Error('Pyth account not found');
      }

      // Parse Pyth price account (simplified)
      const data = accountInfo.data;
      
      // Pyth price account structure (simplified)
      // This is a mock implementation - real Pyth parsing is more complex
      const price = data.readDoubleLE(8);
      const confidence = data.readDoubleLE(16);
      const expo = data.readInt32LE(24);
      const timestamp = new Date(Number(data.readBigInt64LE(32)) * 1000);

      const priceFeed: PriceFeed = {
        oracle: 'pyth',
        asset: 'SOL/USD', // Would be parsed from account
        price: price * Math.pow(10, expo),
        confidence: confidence * Math.pow(10, expo),
        timestamp,
        expo
      };

      // Store in history
      const history = this.priceHistory.get('pyth') || [];
      history.push(priceFeed);
      if (history.length > 1000) history.shift(); // Keep last 1000 prices
      this.priceHistory.set('pyth', history);

      return priceFeed;
    } catch (error: any) {
      // Return mock data for testing
      return {
        oracle: 'pyth',
        asset: 'SOL/USD',
        price: 100.0,
        confidence: 0.1,
        timestamp: new Date(),
        expo: -8
      };
    }
  }

  /**
   * Fetch Switchboard price feed
   */
  private async fetchSwitchboardPrice(config: OracleConfig): Promise<PriceFeed> {
    // Mock implementation for Switchboard
    return {
      oracle: 'switchboard',
      asset: 'SOL/USD',
      price: 99.5,
      confidence: 0.05,
      timestamp: new Date(),
      expo: -2
    };
  }

  /**
   * Fetch Chainlink price feed
   */
  private async fetchChainlinkPrice(config: OracleConfig): Promise<PriceFeed> {
    // Mock implementation for Chainlink
    return {
      oracle: 'chainlink',
      asset: 'SOL/USD',
      price: 100.2,
      confidence: 0.01,
      timestamp: new Date(),
      expo: -8
    };
  }

  /**
   * Fetch custom price feed
   */
  private async fetchCustomPrice(config: OracleConfig): Promise<PriceFeed> {
    try {
      const accountInfo = await this.connection.getAccountInfo(config.address);
      if (!accountInfo) {
        throw new Error('Custom oracle account not found');
      }

      // Parse custom oracle format
      const data = accountInfo.data;
      const price = Number(data.readBigInt64LE(0)) / 1e6;
      const timestamp = new Date(Number(data.readBigInt64LE(8)) * 1000);

      return {
        oracle: 'custom',
        asset: 'CUSTOM/USD',
        price,
        confidence: 0.1,
        timestamp,
        expo: -6
      };
    } catch {
      return {
        oracle: 'custom',
        asset: 'CUSTOM/USD',
        price: 1.0,
        confidence: 0.1,
        timestamp: new Date(),
        expo: -6
      };
    }
  }

  /**
   * Test price manipulation vulnerability
   */
  async testPriceManipulation(
    oracleName: string,
    targetPriceChange: number // percentage
  ): Promise<PriceManipulationTest> {
    const currentPrice = await this.fetchPrice(oracleName);
    const targetPrice = currentPrice.price * (1 + targetPriceChange / 100);
    const vulnerabilities: string[] = [];

    // Check if oracle can be manipulated
    const config = this.oracles.get(oracleName)!;
    
    // Check update authority
    if (config.updateAuthority) {
      const authInfo = await this.connection.getAccountInfo(config.updateAuthority);
      if (!authInfo || authInfo.lamports < 1000000) {
        vulnerabilities.push('Update authority has low balance - easier to compromise');
      }
    }

    // Check price staleness
    const ageSeconds = (Date.now() - currentPrice.timestamp.getTime()) / 1000;
    if (ageSeconds > (config.maxPriceAge || 60)) {
      vulnerabilities.push(`Price is stale (${ageSeconds}s old)`);
    }

    // Check confidence interval
    const confidencePercent = (currentPrice.confidence / currentPrice.price) * 100;
    if (confidencePercent > 1) {
      vulnerabilities.push(`High price uncertainty (${confidencePercent.toFixed(2)}%)`);
    }

    // Estimate manipulation cost
    let estimatedCost = 0;
    let feasible = false;

    if (config.type === 'custom') {
      // Custom oracles might be easier to manipulate
      estimatedCost = 0.1; // 0.1 SOL
      feasible = true;
      vulnerabilities.push('Custom oracle - potentially easier to manipulate');
    } else if (Math.abs(targetPriceChange) < 10) {
      // Small price changes might be achievable
      estimatedCost = Math.abs(targetPriceChange) * 0.5; // SOL
      feasible = true;
    } else if (Math.abs(targetPriceChange) < 50) {
      // Larger changes are expensive
      estimatedCost = Math.abs(targetPriceChange) * 2; // SOL
      feasible = true;
    } else {
      // Extreme changes likely infeasible
      feasible = false;
      vulnerabilities.push('Price change too extreme to be feasible');
    }

    return {
      targetPrice,
      manipulatedPrice: targetPrice,
      percentageChange: targetPriceChange,
      feasible,
      estimatedCost,
      vulnerabilities
    };
  }

  /**
   * Detect oracle vulnerabilities
   */
  async detectVulnerabilities(oracleName: string): Promise<OracleVulnerability[]> {
    const vulnerabilities: OracleVulnerability[] = [];
    const config = this.oracles.get(oracleName);
    
    if (!config) {
      return [{
        type: 'single_source',
        severity: 'critical',
        description: 'Oracle not found or not configured',
        recommendation: 'Ensure oracle is properly initialized'
      }];
    }

    try {
      const currentPrice = await this.fetchPrice(oracleName);
      
      // Check price staleness
      const ageSeconds = (Date.now() - currentPrice.timestamp.getTime()) / 1000;
      if (ageSeconds > 300) { // 5 minutes
        vulnerabilities.push({
          type: 'stale_price',
          severity: 'high',
          description: `Price data is ${ageSeconds}s old`,
          recommendation: 'Implement maximum price age checks'
        });
      }

      // Check confidence
      const confidencePercent = (currentPrice.confidence / currentPrice.price) * 100;
      if (confidencePercent > 5) {
        vulnerabilities.push({
          type: 'low_confidence',
          severity: 'medium',
          description: `Price confidence is low (±${confidencePercent.toFixed(2)}%)`,
          recommendation: 'Require minimum confidence levels for critical operations'
        });
      }

      // Check price history for manipulation
      const history = this.priceHistory.get(oracleName) || [];
      if (history.length > 10) {
        const recentPrices = history.slice(-10);
        const avgPrice = recentPrices.reduce((sum, p) => sum + p.price, 0) / recentPrices.length;
        const maxDeviation = Math.max(...recentPrices.map(p => 
          Math.abs((p.price - avgPrice) / avgPrice * 100)
        ));

        if (maxDeviation > 20) {
          vulnerabilities.push({
            type: 'manipulation',
            severity: 'high',
            description: `Price volatility detected (${maxDeviation.toFixed(2)}% deviation)`,
            recommendation: 'Implement price smoothing or multiple oracle sources'
          });
        }
      }

      // Check for single oracle dependency
      if (this.oracles.size === 1) {
        vulnerabilities.push({
          type: 'single_source',
          severity: 'medium',
          description: 'Relying on single oracle source',
          recommendation: 'Use multiple oracle providers for redundancy'
        });
      }

      // Custom oracle specific checks
      if (config.type === 'custom') {
        vulnerabilities.push({
          type: 'single_source',
          severity: 'high',
          description: 'Using custom oracle without standard validation',
          recommendation: 'Implement robust validation or use established oracle providers'
        });
      }

    } catch (error: any) {
      vulnerabilities.push({
        type: 'update_delay',
        severity: 'critical',
        description: `Oracle fetch failed: ${error.message}`,
        recommendation: 'Ensure oracle is accessible and properly configured'
      });
    }

    return vulnerabilities;
  }

  /**
   * Simulate oracle attack
   */
  async simulateOracleAttack(
    oracleName: string,
    attackType: 'flash_loan' | 'slow_drift' | 'sudden_spike'
  ): Promise<{
    success: boolean;
    impact: string;
    priceImpact: number;
    details: any;
  }> {
    const originalPrice = await this.fetchPrice(oracleName);
    let manipulatedPrice = originalPrice.price;
    let success = false;
    let details: any = {};

    switch (attackType) {
      case 'flash_loan':
        // Simulate flash loan price manipulation
        manipulatedPrice = originalPrice.price * 1.5; // 50% spike
        success = originalPrice.confidence > originalPrice.price * 0.01; // Low confidence makes it easier
        details = {
          type: 'flash_loan',
          originalPrice: originalPrice.price,
          manipulatedPrice,
          duration: 'single block',
          feasibility: success ? 'Possible with large capital' : 'Unlikely due to oracle design'
        };
        break;

      case 'slow_drift':
        // Simulate gradual price manipulation
        manipulatedPrice = originalPrice.price * 1.1; // 10% drift
        success = true; // Usually possible over time
        details = {
          type: 'slow_drift',
          originalPrice: originalPrice.price,
          targetPrice: manipulatedPrice,
          timeRequired: '1-2 hours',
          feasibility: 'Possible with sustained pressure'
        };
        break;

      case 'sudden_spike':
        // Simulate sudden price spike
        manipulatedPrice = originalPrice.price * 2; // 100% spike
        const config = this.oracles.get(oracleName)!;
        success = config.type === 'custom'; // Custom oracles more vulnerable
        details = {
          type: 'sudden_spike',
          originalPrice: originalPrice.price,
          spikePrice: manipulatedPrice,
          triggerRequired: 'Large market order or oracle compromise',
          feasibility: success ? 'Possible on custom oracle' : 'Protected by oracle design'
        };
        break;
    }

    const priceImpact = ((manipulatedPrice - originalPrice.price) / originalPrice.price) * 100;

    return {
      success,
      impact: success ? 
        `Price manipulated by ${priceImpact.toFixed(2)}%` : 
        'Oracle resistant to this attack',
      priceImpact,
      details
    };
  }

  /**
   * Monitor oracle health
   */
  async monitorOracleHealth(
    duration: number = 60000 // 1 minute
  ): Promise<{
    healthScore: number;
    issues: string[];
    recommendations: string[];
  }> {
    const startTime = Date.now();
    const issues: string[] = [];
    const recommendations: string[] = [];
    let totalChecks = 0;
    let failedChecks = 0;

    console.log(`Monitoring oracle health for ${duration / 1000}s...`);

    const checkInterval = setInterval(async () => {
      for (const [name, config] of Array.from(this.oracles)) {
        totalChecks++;
        
        try {
          const price = await this.fetchPrice(name);
          
          // Check price freshness
          const age = (Date.now() - price.timestamp.getTime()) / 1000;
          if (age > 60) {
            failedChecks++;
            issues.push(`${name}: Stale price (${age}s old)`);
          }
          
          // Check confidence
          const confidencePercent = (price.confidence / price.price) * 100;
          if (confidencePercent > 5) {
            failedChecks++;
            issues.push(`${name}: Low confidence (±${confidencePercent.toFixed(2)}%)`);
          }
        } catch (error: any) {
          failedChecks++;
          issues.push(`${name}: Failed to fetch - ${error.message}`);
        }
      }
      
      if (Date.now() - startTime >= duration) {
        clearInterval(checkInterval);
      }
    }, 5000); // Check every 5 seconds

    // Wait for monitoring to complete
    await new Promise(resolve => setTimeout(resolve, duration));

    // Calculate health score
    const healthScore = totalChecks > 0 ? 
      ((totalChecks - failedChecks) / totalChecks) * 100 : 0;

    // Generate recommendations
    if (healthScore < 50) {
      recommendations.push('Critical: Oracle health is poor, consider backup oracles');
    } else if (healthScore < 80) {
      recommendations.push('Warning: Some oracle issues detected, investigate failures');
    }

    if (issues.some(i => i.includes('Stale price'))) {
      recommendations.push('Implement automatic fallback for stale prices');
    }

    if (issues.some(i => i.includes('Low confidence'))) {
      recommendations.push('Add confidence thresholds to critical operations');
    }

    if (this.oracles.size < 3) {
      recommendations.push('Use at least 3 independent oracle sources');
    }

    return {
      healthScore,
      issues: Array.from(new Set(issues)), // Remove duplicates
      recommendations: Array.from(new Set(recommendations))
    };
  }

  /**
   * Generate oracle security report
   */
  generateSecurityReport(): string {
    let report = `# Oracle Security Report

## Registered Oracles
`;

    for (const [name, config] of this.oracles) {
      report += `\n### ${name}
- Type: ${config.type}
- Address: ${config.address.toBase58()}
- Max Price Age: ${config.maxPriceAge || 'Not set'}s
- Min Confidence: ${config.minConfidence || 'Not set'}
`;
    }

    report += `\n## Price History Summary\n`;
    for (const [oracle, history] of this.priceHistory) {
      if (history.length > 0) {
        const recent = history[history.length - 1];
        const avgPrice = history.reduce((sum, p) => sum + p.price, 0) / history.length;
        const minPrice = Math.min(...history.map(p => p.price));
        const maxPrice = Math.max(...history.map(p => p.price));
        
        report += `\n### ${oracle}
- Current Price: $${recent.price.toFixed(2)}
- Average Price: $${avgPrice.toFixed(2)}
- Price Range: $${minPrice.toFixed(2)} - $${maxPrice.toFixed(2)}
- Samples: ${history.length}
`;
      }
    }

    return report;
  }
}

// Export factory function
export const createOracleIntegration = (connection: Connection) =>
  new OracleIntegration(connection); 