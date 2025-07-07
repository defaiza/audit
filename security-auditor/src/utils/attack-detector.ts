import { Connection, PublicKey } from '@solana/web3.js'
import { Program } from '@coral-xyz/anchor'
import { TestEnvironment } from './test-infrastructure'

// Import all attack result types
import { OverflowAttackResult } from './attack-implementations/overflow-attacks'
import { ReentrancyAttackResult } from './attack-implementations/reentrancy-attacks'
import { AccessControlAttackResult } from './attack-implementations/access-control-attacks'
import { InputValidationAttackResult } from './attack-implementations/input-validation-attacks'
import { DoubleSpendingAttackResult } from './attack-implementations/double-spending-attacks'
import { DOSAttackResult } from './attack-implementations/dos-attacks'

type AttackResult = 
  | OverflowAttackResult
  | ReentrancyAttackResult
  | AccessControlAttackResult
  | InputValidationAttackResult
  | DoubleSpendingAttackResult
  | DOSAttackResult

export interface AttackDetectionReport {
  program: string
  timestamp: Date
  vulnerabilitiesFound: number
  criticalVulnerabilities: number
  attackSummary: {
    category: string
    type: string
    severity: 'low' | 'medium' | 'high' | 'critical'
    targetFunction: string
    success: boolean
    details: string
  }[]
  recommendations: string[]
  overallRiskScore: number
}

export interface VulnerabilityPattern {
  pattern: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  category: string
  indicators: string[]
}

export class AttackSuccessDetector {
  private connection: Connection
  private environment: TestEnvironment
  private vulnerabilityPatterns: VulnerabilityPattern[]

  constructor(connection: Connection, environment: TestEnvironment) {
    this.connection = connection
    this.environment = environment
    this.vulnerabilityPatterns = this.initializePatterns()
  }

  /**
   * Analyze attack results and generate detection report
   */
  async analyzeAttackResults(
    program: Program,
    attackResults: AttackResult[]
  ): Promise<AttackDetectionReport> {
    const timestamp = new Date()
    const attackSummary: AttackDetectionReport['attackSummary'] = []
    const recommendations: string[] = []
    
    let vulnerabilitiesFound = 0
    let criticalVulnerabilities = 0

    // Analyze each attack result
    for (const result of attackResults) {
      const analysis = this.analyzeIndividualAttack(result)
      
      if (analysis.vulnerability) {
        vulnerabilitiesFound++
        if (analysis.severity === 'critical') {
          criticalVulnerabilities++
        }
        
        attackSummary.push({
          category: analysis.category,
          type: analysis.type,
          severity: analysis.severity,
          targetFunction: result.targetFunction,
          success: result.success,
          details: analysis.details
        })
        
        // Add specific recommendations
        recommendations.push(...this.generateRecommendations(analysis))
      }
    }

    // Analyze patterns across attacks
    const crossAttackVulnerabilities = this.analyzeCrossAttackPatterns(attackResults)
    vulnerabilitiesFound += crossAttackVulnerabilities.length
    
    for (const vuln of crossAttackVulnerabilities) {
      attackSummary.push(vuln)
      if (vuln.severity === 'critical') {
        criticalVulnerabilities++
      }
    }

    // Calculate overall risk score
    const overallRiskScore = this.calculateRiskScore(
      vulnerabilitiesFound,
      criticalVulnerabilities,
      attackSummary
    )

    // Add general recommendations
    if (vulnerabilitiesFound === 0) {
      recommendations.push('No vulnerabilities detected. Continue with regular security audits.')
    } else {
      recommendations.unshift('Immediate action required to address identified vulnerabilities.')
    }

    return {
      program: program.programId.toBase58(),
      timestamp,
      vulnerabilitiesFound,
      criticalVulnerabilities,
      attackSummary,
      recommendations: Array.from(new Set(recommendations)), // Remove duplicates
      overallRiskScore
    }
  }

  /**
   * Analyze individual attack result
   */
  private analyzeIndividualAttack(result: AttackResult): {
    vulnerability: boolean
    category: string
    type: string
    severity: 'low' | 'medium' | 'high' | 'critical'
    details: string
  } {
    // Check overflow/underflow attacks
    if ('type' in result && (result.type === 'overflow' || result.type === 'underflow')) {
      const overflowResult = result as OverflowAttackResult
      if (overflowResult.success) {
        return {
          vulnerability: true,
          category: 'Integer Overflow/Underflow',
          type: overflowResult.type,
          severity: 'critical',
          details: `Integer ${overflowResult.type} vulnerability detected with value ${overflowResult.attemptedValue}`
        }
      }
    }

    // Check reentrancy attacks
    if ('depth' in result) {
      const reentrancyResult = result as ReentrancyAttackResult
      if (reentrancyResult.success) {
        return {
          vulnerability: true,
          category: 'Reentrancy',
          type: reentrancyResult.type,
          severity: reentrancyResult.type === 'cross-program' ? 'critical' : 'high',
          details: `Reentrancy vulnerability with depth ${reentrancyResult.depth}`
        }
      }
    }

    // Check access control attacks
    if ('attackerRole' in result && 'requiredRole' in result) {
      const accessResult = result as AccessControlAttackResult
      if (accessResult.success) {
        return {
          vulnerability: true,
          category: 'Access Control',
          type: accessResult.type,
          severity: accessResult.type === 'unauthorized-admin' ? 'critical' : 'high',
          details: `Access control bypass: ${accessResult.attackerRole} accessed ${accessResult.requiredRole} function`
        }
      }
    }

    // Check input validation attacks
    if ('inputValue' in result) {
      const inputResult = result as InputValidationAttackResult
      if (inputResult.success) {
        return {
          vulnerability: true,
          category: 'Input Validation',
          type: inputResult.type,
          severity: inputResult.type === 'boundary-test' ? 'medium' : 'high',
          details: `Input validation failure with value: ${inputResult.inputValue}`
        }
      }
    }

    // Check double spending attacks
    if ('attemptedSpends' in result && 'successfulSpends' in result) {
      const doubleSpendResult = result as DoubleSpendingAttackResult
      if (doubleSpendResult.success) {
        return {
          vulnerability: true,
          category: 'Double Spending',
          type: doubleSpendResult.type,
          severity: 'critical',
          details: `Double spending vulnerability: ${doubleSpendResult.successfulSpends} of ${doubleSpendResult.attemptedSpends} succeeded`
        }
      }
    }

    // Check DOS attacks
    if ('resourcesConsumed' in result) {
      const dosResult = result as DOSAttackResult
      if (dosResult.success) {
        const severity = this.calculateDOSSeverity(dosResult)
        return {
          vulnerability: true,
          category: 'Denial of Service',
          type: dosResult.type,
          severity,
          details: `DOS vulnerability: ${dosResult.performanceImpact || 'Resource exhaustion detected'}`
        }
      }
    }

    return {
      vulnerability: false,
      category: 'Unknown',
      type: 'unknown',
      severity: 'low',
      details: 'No vulnerability detected'
    }
  }

  /**
   * Analyze patterns across multiple attacks
   */
  private analyzeCrossAttackPatterns(results: AttackResult[]): AttackDetectionReport['attackSummary'] {
    const patterns: AttackDetectionReport['attackSummary'] = []
    
    // Check for systemic input validation issues
    const inputValidationFailures = results.filter(r => 
      'inputValue' in r && r.success
    ).length
    
    if (inputValidationFailures >= 2) {
      patterns.push({
        category: 'Systemic',
        type: 'multiple-input-validation',
        severity: 'high',
        targetFunction: 'multiple',
        success: true,
        details: 'Multiple input validation vulnerabilities suggest systemic validation issues'
      })
    }

    // Check for combined attack potential
    const hasAccessControl = results.some(r => 'attackerRole' in r && r.success)
    const hasDoubleSpend = results.some(r => 'attemptedSpends' in r && r.success)
    
    if (hasAccessControl && hasDoubleSpend) {
      patterns.push({
        category: 'Combined Attack',
        type: 'access-control-double-spend',
        severity: 'critical',
        targetFunction: 'multiple',
        success: true,
        details: 'Access control and double spending vulnerabilities can be combined for maximum damage'
      })
    }

    // Check for missing security features
    const noReentrancyProtection = results.some(r => 'depth' in r && r.success)
    const noOverflowProtection = results.some(r => 
      'type' in r && (r.type === 'overflow' || r.type === 'underflow') && r.success
    )
    
    if (noReentrancyProtection && noOverflowProtection) {
      patterns.push({
        category: 'Missing Protection',
        type: 'no-basic-protections',
        severity: 'critical',
        targetFunction: 'program-wide',
        success: true,
        details: 'Program lacks basic security protections (reentrancy guards, overflow checks)'
      })
    }

    return patterns
  }

  /**
   * Generate recommendations based on vulnerabilities
   */
  private generateRecommendations(analysis: {
    category: string
    type: string
    severity: string
  }): string[] {
    const recommendations: string[] = []
    
    switch (analysis.category) {
      case 'Integer Overflow/Underflow':
        recommendations.push(
          'Use checked arithmetic operations (checked_add, checked_sub, etc.)',
          'Implement SafeMath library or use built-in overflow protection',
          'Add explicit bounds checking for all numeric inputs'
        )
        break
        
      case 'Reentrancy':
        recommendations.push(
          'Implement reentrancy guards using checks-effects-interactions pattern',
          'Use mutex locks for critical functions',
          'Avoid external calls in the middle of state changes'
        )
        break
        
      case 'Access Control':
        recommendations.push(
          'Implement role-based access control (RBAC)',
          'Use program-derived addresses (PDAs) for authority management',
          'Add explicit signer checks for all privileged operations'
        )
        break
        
      case 'Input Validation':
        recommendations.push(
          'Validate all inputs at the beginning of functions',
          'Implement whitelisting instead of blacklisting',
          'Use custom types with built-in validation'
        )
        break
        
      case 'Double Spending':
        recommendations.push(
          'Implement nonce-based transaction ordering',
          'Use account locks during critical operations',
          'Add idempotency keys to prevent replay attacks'
        )
        break
        
      case 'Denial of Service':
        recommendations.push(
          'Implement rate limiting and compute budget limits',
          'Add account size limits and cleanup mechanisms',
          'Use efficient data structures and algorithms'
        )
        break
    }
    
    return recommendations
  }

  /**
   * Calculate DOS severity based on resources consumed
   */
  private calculateDOSSeverity(result: DOSAttackResult): 'low' | 'medium' | 'high' | 'critical' {
    const resources = result.resourcesConsumed
    
    if ((resources.computeUnits || 0) > 1000000) return 'critical'
    if ((resources.accountsCreated || 0) > 50) return 'critical'
    if ((resources.transactionsSent || 0) > 100) return 'high'
    if ((resources.dataSize || 0) > 100000) return 'high'
    if ((resources.computeUnits || 0) > 500000) return 'medium'
    
    return 'low'
  }

  /**
   * Calculate overall risk score (0-100)
   */
  private calculateRiskScore(
    vulnerabilitiesFound: number,
    criticalVulnerabilities: number,
    attackSummary: AttackDetectionReport['attackSummary']
  ): number {
    let score = 0
    
    // Base score from vulnerability count
    score += Math.min(vulnerabilitiesFound * 10, 40)
    
    // Critical vulnerabilities have higher impact
    score += criticalVulnerabilities * 20
    
    // Severity-based scoring
    for (const attack of attackSummary) {
      switch (attack.severity) {
        case 'critical': score += 15; break
        case 'high': score += 10; break
        case 'medium': score += 5; break
        case 'low': score += 2; break
      }
    }
    
    // Cap at 100
    return Math.min(score, 100)
  }

  /**
   * Initialize vulnerability patterns for detection
   */
  private initializePatterns(): VulnerabilityPattern[] {
    return [
      {
        pattern: 'integer_overflow',
        severity: 'critical',
        category: 'Arithmetic',
        indicators: ['overflow', 'exceeds maximum', 'wrapped']
      },
      {
        pattern: 'reentrancy',
        severity: 'high',
        category: 'Control Flow',
        indicators: ['reentrant', 'recursive call', 'already processing']
      },
      {
        pattern: 'access_control',
        severity: 'critical',
        category: 'Authorization',
        indicators: ['unauthorized', 'access denied', 'not authorized']
      },
      {
        pattern: 'input_validation',
        severity: 'medium',
        category: 'Data Validation',
        indicators: ['invalid', 'out of range', 'malformed']
      },
      {
        pattern: 'double_spend',
        severity: 'critical',
        category: 'Transaction',
        indicators: ['already spent', 'duplicate', 'replay']
      },
      {
        pattern: 'dos',
        severity: 'high',
        category: 'Availability',
        indicators: ['exhausted', 'limit exceeded', 'too many']
      }
    ]
  }

  /**
   * Monitor live transactions for attack patterns
   */
  async monitorLiveTransactions(
    program: Program,
    duration: number = 60000 // 1 minute default
  ): Promise<{
    suspiciousTransactions: number
    patterns: Map<string, number>
  }> {
    const startTime = Date.now()
    const patterns = new Map<string, number>()
    let suspiciousTransactions = 0
    
    // This would connect to WebSocket in production
    console.log(`Monitoring transactions for ${duration}ms...`)
    
    // Simulate monitoring
    while (Date.now() - startTime < duration) {
      // In production, this would analyze real transactions
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // Check for patterns (simulated)
      for (const pattern of this.vulnerabilityPatterns) {
        const count = patterns.get(pattern.pattern) || 0
        patterns.set(pattern.pattern, count)
      }
    }
    
    return { suspiciousTransactions, patterns }
  }

  /**
   * Generate executive summary
   */
  generateExecutiveSummary(report: AttackDetectionReport): string {
    const riskLevel = 
      report.overallRiskScore >= 80 ? 'CRITICAL' :
      report.overallRiskScore >= 60 ? 'HIGH' :
      report.overallRiskScore >= 40 ? 'MEDIUM' :
      report.overallRiskScore >= 20 ? 'LOW' : 'MINIMAL'
    
    return `
# Security Audit Executive Summary

**Program:** ${report.program}
**Date:** ${report.timestamp.toISOString()}
**Overall Risk Level:** ${riskLevel} (Score: ${report.overallRiskScore}/100)

## Key Findings
- Total Vulnerabilities: ${report.vulnerabilitiesFound}
- Critical Vulnerabilities: ${report.criticalVulnerabilities}

## Immediate Actions Required
${report.criticalVulnerabilities > 0 ? 
  '⚠️ CRITICAL: Immediate remediation required for critical vulnerabilities.' :
  '✅ No critical vulnerabilities found.'}

## Top Recommendations
${report.recommendations.slice(0, 3).map(r => `- ${r}`).join('\n')}

## Risk Categories
${this.summarizeRiskCategories(report.attackSummary)}
    `.trim()
  }

  /**
   * Summarize risk categories
   */
  private summarizeRiskCategories(attacks: AttackDetectionReport['attackSummary']): string {
    const categories = new Map<string, number>()
    
    for (const attack of attacks) {
      if (attack.success) {
        categories.set(attack.category, (categories.get(attack.category) || 0) + 1)
      }
    }
    
    return Array.from(categories.entries())
      .map(([category, count]) => `- ${category}: ${count} vulnerabilities`)
      .join('\n')
  }
}

// Export factory function
export const createAttackSuccessDetector = (
  connection: Connection,
  environment: TestEnvironment
) => new AttackSuccessDetector(connection, environment) 