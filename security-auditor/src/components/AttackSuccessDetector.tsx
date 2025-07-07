import React, { useState, useEffect } from 'react'
import { Connection, PublicKey, Transaction } from '@solana/web3.js'
import * as anchor from '@coral-xyz/anchor'

interface AttackDetectionRule {
  id: string
  name: string
  description: string
  category: string
  detectFunc: (txResult: any, context: DetectionContext) => boolean
  severity: 'low' | 'medium' | 'high' | 'critical'
}

interface DetectionContext {
  preState: AccountState
  postState: AccountState
  transaction: Transaction
  logs: string[]
  programErrors: any[]
  executionTime: number
  gasUsed: number
}

interface AccountState {
  balances: Map<string, number>
  programAccounts: Map<string, any>
  timestamp: number
}

interface VulnerabilityReport {
  attackId: string
  vulnerabilityFound: boolean
  confidence: number // 0-100
  severity: string
  details: string
  recommendations: string[]
  affectedAccounts: string[]
  exploitPath: string[]
}

// Detection rules for various attack patterns
const DETECTION_RULES: AttackDetectionRule[] = [
  {
    id: 'unexpected_balance_change',
    name: 'Unexpected Balance Change',
    description: 'Detects unauthorized token transfers or balance modifications',
    category: 'theft',
    severity: 'critical',
    detectFunc: (result, context) => {
      // Check if any account balance changed more than expected
      for (const [account, preBal] of Array.from(context.preState.balances)) {
        const postBal = context.postState.balances.get(account) || 0
        const diff = Math.abs(postBal - preBal)
        
        // If balance changed by more than 10% without corresponding instruction
        if (diff > preBal * 0.1) {
          return true
        }
      }
      return false
    }
  },
  {
    id: 'privilege_escalation',
    name: 'Privilege Escalation',
    description: 'Detects unauthorized admin or owner changes',
    category: 'access_control',
    severity: 'critical',
    detectFunc: (result, context) => {
      // Check for owner/admin field changes
      for (const [account, preData] of Array.from(context.preState.programAccounts)) {
        const postData = context.postState.programAccounts.get(account)
        if (!postData) continue
        
        // Check common admin fields
        if (preData.admin && postData.admin && 
            preData.admin !== postData.admin) {
          return true
        }
        if (preData.owner && postData.owner && 
            preData.owner !== postData.owner) {
          return true
        }
        if (preData.authority && postData.authority && 
            preData.authority !== postData.authority) {
          return true
        }
      }
      return false
    }
  },
  {
    id: 'reentrancy_pattern',
    name: 'Reentrancy Pattern',
    description: 'Detects potential reentrancy attacks',
    category: 'reentrancy',
    severity: 'high',
    detectFunc: (result, context) => {
      // Look for recursive calls in logs
      const instructionCalls = context.logs.filter(log => 
        log.includes('Program log: Instruction:')
      )
      
      // Check for same instruction called multiple times
      const callCounts = new Map<string, number>()
      for (const call of instructionCalls) {
        const count = callCounts.get(call) || 0
        callCounts.set(call, count + 1)
        if (count > 1) return true
      }
      return false
    }
  },
  {
    id: 'overflow_underflow',
    name: 'Integer Overflow/Underflow',
    description: 'Detects arithmetic errors',
    category: 'arithmetic',
    severity: 'high',
    detectFunc: (result, context) => {
      // Check for overflow errors in logs
      return context.logs.some(log => 
        log.includes('overflow') || 
        log.includes('underflow') ||
        log.includes('attempt to subtract with overflow') ||
        log.includes('attempt to add with overflow')
      )
    }
  },
  {
    id: 'dos_pattern',
    name: 'DOS Attack Pattern',
    description: 'Detects denial of service attempts',
    category: 'dos',
    severity: 'medium',
    detectFunc: (result, context) => {
      // High gas usage or excessive compute units
      if (context.gasUsed > 1_000_000) return true
      
      // Too many accounts or instructions
      if (context.transaction.instructions.length > 10) return true
      
      // Execution timeout
      if (context.executionTime > 30000) return true // 30 seconds
      
      return false
    }
  },
  {
    id: 'data_manipulation',
    name: 'Data Manipulation',
    description: 'Detects unauthorized data modifications',
    category: 'integrity',
    severity: 'high',
    detectFunc: (result, context) => {
      // Check for unexpected state changes
      for (const [account, preData] of Array.from(context.preState.programAccounts)) {
        const postData = context.postState.programAccounts.get(account)
        if (!postData) continue
        
        // Check critical fields that shouldn't change
        const criticalFields = ['totalSupply', 'decimals', 'mintAuthority', 'freezeAuthority']
        for (const field of criticalFields) {
          if (preData[field] !== undefined && 
              postData[field] !== undefined &&
              preData[field] !== postData[field]) {
            return true
          }
        }
      }
      return false
    }
  },
  {
    id: 'timing_attack',
    name: 'Timing Attack',
    description: 'Detects time-based vulnerabilities',
    category: 'timing',
    severity: 'medium',
    detectFunc: (result, context) => {
      // Check for timestamp manipulation
      const timeDiff = context.postState.timestamp - context.preState.timestamp
      
      // If timestamp jumped too much (more than 1 hour)
      if (timeDiff > 3600) return true
      
      // If timestamp went backwards
      if (timeDiff < 0) return true
      
      return false
    }
  },
  {
    id: 'cross_program_exploit',
    name: 'Cross-Program Exploit',
    description: 'Detects vulnerabilities from program interactions',
    category: 'cross_program',
    severity: 'critical',
    detectFunc: (result, context) => {
      // Check for unexpected CPI calls
      const cpiCalls = context.logs.filter(log => 
        log.includes('Program log: CPI:') || 
        log.includes('invoke')
      )
      
      // Multiple different programs called
      const uniquePrograms = new Set(
        context.transaction.instructions.map(ix => ix.programId.toBase58())
      )
      
      if (uniquePrograms.size > 3 && cpiCalls.length > 5) {
        return true
      }
      
      return false
    }
  }
]

interface AttackSuccessDetectorProps {
  connection: Connection
  onDetection: (report: VulnerabilityReport) => void
}

export function AttackSuccessDetector({ connection, onDetection }: AttackSuccessDetectorProps) {
  const [isMonitoring, setIsMonitoring] = useState(false)
  const [detectedVulnerabilities, setDetectedVulnerabilities] = useState<VulnerabilityReport[]>([])
  const [detectionStats, setDetectionStats] = useState({
    testsAnalyzed: 0,
    vulnerabilitiesFound: 0,
    criticalFindings: 0,
    highFindings: 0,
    mediumFindings: 0,
    lowFindings: 0
  })

  const analyzeAttackResult = async (
    attackId: string,
    preState: AccountState,
    postState: AccountState,
    transaction: Transaction,
    logs: string[],
    error?: any
  ): Promise<VulnerabilityReport> => {
    const context: DetectionContext = {
      preState,
      postState,
      transaction,
      logs,
      programErrors: error ? [error] : [],
      executionTime: Date.now() - preState.timestamp,
      gasUsed: estimateGasUsage(transaction)
    }

    // Run all detection rules
    const detectedIssues: string[] = []
    let maxSeverity = 'low'
    const affectedAccounts = new Set<string>()
    const exploitPath: string[] = []

    for (const rule of DETECTION_RULES) {
      try {
        if (rule.detectFunc({}, context)) {
          detectedIssues.push(rule.name)
          
          // Update max severity
          if (severityToNumber(rule.severity) > severityToNumber(maxSeverity)) {
            maxSeverity = rule.severity
          }
          
          // Track affected accounts
          transaction.instructions.forEach(ix => {
            ix.keys.forEach(key => {
              if (key.isWritable) {
                affectedAccounts.add(key.pubkey.toBase58())
              }
            })
          })
          
          // Build exploit path
          exploitPath.push(`${rule.name}: ${rule.description}`)
        }
      } catch (e) {
        console.error(`Detection rule ${rule.id} failed:`, e)
      }
    }

    // Calculate confidence based on number of rules triggered
    const confidence = Math.min(100, detectedIssues.length * 20)

    // Generate recommendations
    const recommendations = generateRecommendations(detectedIssues, context)

    const report: VulnerabilityReport = {
      attackId,
      vulnerabilityFound: detectedIssues.length > 0,
      confidence,
      severity: maxSeverity,
      details: detectedIssues.length > 0 
        ? `Detected ${detectedIssues.length} vulnerability patterns: ${detectedIssues.join(', ')}`
        : 'No vulnerabilities detected',
      recommendations,
      affectedAccounts: Array.from(affectedAccounts),
      exploitPath
    }

    // Update stats
    setDetectionStats(prev => ({
      testsAnalyzed: prev.testsAnalyzed + 1,
      vulnerabilitiesFound: prev.vulnerabilitiesFound + (report.vulnerabilityFound ? 1 : 0),
      criticalFindings: prev.criticalFindings + (maxSeverity === 'critical' ? 1 : 0),
      highFindings: prev.highFindings + (maxSeverity === 'high' ? 1 : 0),
      mediumFindings: prev.mediumFindings + (maxSeverity === 'medium' ? 1 : 0),
      lowFindings: prev.lowFindings + (maxSeverity === 'low' ? 1 : 0)
    }))

    // Store and notify
    if (report.vulnerabilityFound) {
      setDetectedVulnerabilities(prev => [...prev, report])
      onDetection(report)
    }

    return report
  }

  const severityToNumber = (severity: string): number => {
    switch (severity) {
      case 'critical': return 4
      case 'high': return 3
      case 'medium': return 2
      case 'low': return 1
      default: return 0
    }
  }

  const estimateGasUsage = (transaction: Transaction): number => {
    // Rough estimate based on instruction count and account usage
    let gas = 5000 // Base fee
    gas += transaction.instructions.length * 10000
    
    transaction.instructions.forEach(ix => {
      gas += ix.keys.length * 2000
      gas += ix.data.length * 100
    })
    
    return gas
  }

  const generateRecommendations = (issues: string[], context: DetectionContext): string[] => {
    const recommendations: string[] = []
    
    if (issues.includes('Unexpected Balance Change')) {
      recommendations.push('Implement balance change limits and approval mechanisms')
      recommendations.push('Add balance tracking and validation in critical functions')
    }
    
    if (issues.includes('Privilege Escalation')) {
      recommendations.push('Use multi-signature for admin changes')
      recommendations.push('Implement timelocks for critical operations')
      recommendations.push('Add access control modifiers to all admin functions')
    }
    
    if (issues.includes('Reentrancy Pattern')) {
      recommendations.push('Implement reentrancy guards on all external functions')
      recommendations.push('Follow checks-effects-interactions pattern')
      recommendations.push('Use mutex locks for critical sections')
    }
    
    if (issues.includes('Integer Overflow/Underflow')) {
      recommendations.push('Use checked arithmetic operations')
      recommendations.push('Implement SafeMath or similar libraries')
      recommendations.push('Add bounds checking for all numeric inputs')
    }
    
    if (issues.includes('Cross-Program Exploit')) {
      recommendations.push('Validate all CPI calls and return values')
      recommendations.push('Implement program-level access controls')
      recommendations.push('Use signed invocations for critical CPIs')
    }
    
    // General recommendations
    recommendations.push('Conduct thorough security audits before mainnet deployment')
    recommendations.push('Implement comprehensive logging and monitoring')
    recommendations.push('Create incident response procedures')
    
    return Array.from(new Set(recommendations)) // Remove duplicates
  }

  const exportDetectionReport = () => {
    const report = {
      timestamp: new Date().toISOString(),
      stats: detectionStats,
      vulnerabilities: detectedVulnerabilities,
      summary: {
        totalTests: detectionStats.testsAnalyzed,
        successRate: ((detectionStats.testsAnalyzed - detectionStats.vulnerabilitiesFound) / detectionStats.testsAnalyzed * 100).toFixed(2) + '%',
        criticalIssues: detectionStats.criticalFindings,
        recommendations: Array.from(new Set(
          detectedVulnerabilities.flatMap(v => v.recommendations)
        ))
      }
    }
    
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `attack-detection-report-${Date.now()}.json`
    a.click()
  }

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-white">🎯 Attack Success Detection</h3>
        <button
          onClick={() => setIsMonitoring(!isMonitoring)}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            isMonitoring 
              ? 'bg-red-600 hover:bg-red-700 text-white' 
              : 'bg-green-600 hover:bg-green-700 text-white'
          }`}
        >
          {isMonitoring ? '⏸️ Stop Monitoring' : '▶️ Start Monitoring'}
        </button>
      </div>

      {/* Detection Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <div className="bg-gray-700 rounded p-3">
          <p className="text-gray-400 text-xs">Tests Analyzed</p>
          <p className="text-white text-xl font-bold">{detectionStats.testsAnalyzed}</p>
        </div>
        <div className="bg-gray-700 rounded p-3">
          <p className="text-gray-400 text-xs">Vulnerabilities</p>
          <p className="text-white text-xl font-bold">{detectionStats.vulnerabilitiesFound}</p>
        </div>
        <div className="bg-red-900 bg-opacity-20 border border-red-700 rounded p-3">
          <p className="text-red-400 text-xs">Critical</p>
          <p className="text-red-400 text-xl font-bold">{detectionStats.criticalFindings}</p>
        </div>
        <div className="bg-orange-900 bg-opacity-20 border border-orange-700 rounded p-3">
          <p className="text-orange-400 text-xs">High</p>
          <p className="text-orange-400 text-xl font-bold">{detectionStats.highFindings}</p>
        </div>
        <div className="bg-yellow-900 bg-opacity-20 border border-yellow-700 rounded p-3">
          <p className="text-yellow-400 text-xs">Medium</p>
          <p className="text-yellow-400 text-xl font-bold">{detectionStats.mediumFindings}</p>
        </div>
        <div className="bg-gray-700 rounded p-3">
          <p className="text-gray-400 text-xs">Low</p>
          <p className="text-gray-300 text-xl font-bold">{detectionStats.lowFindings}</p>
        </div>
      </div>

      {/* Detection Rules */}
      <div className="mb-6">
        <h4 className="text-sm font-medium text-white mb-3">Active Detection Rules</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {DETECTION_RULES.map(rule => (
            <div key={rule.id} className="bg-gray-700 rounded p-3 flex items-start space-x-3">
              <span className={`text-xs px-2 py-1 rounded ${
                rule.severity === 'critical' ? 'bg-red-900 text-red-300' :
                rule.severity === 'high' ? 'bg-orange-900 text-orange-300' :
                rule.severity === 'medium' ? 'bg-yellow-900 text-yellow-300' :
                'bg-gray-600 text-gray-300'
              }`}>
                {rule.severity.toUpperCase()}
              </span>
              <div className="flex-1">
                <p className="text-white text-sm font-medium">{rule.name}</p>
                <p className="text-gray-400 text-xs mt-1">{rule.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Detections */}
      {detectedVulnerabilities.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium text-white">Recent Vulnerability Detections</h4>
            <button
              onClick={exportDetectionReport}
              className="text-xs text-defai-primary hover:underline"
            >
              Export Report
            </button>
          </div>
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {detectedVulnerabilities.slice(-5).reverse().map((vuln, idx) => (
              <div key={idx} className={`rounded-lg p-4 border ${
                vuln.severity === 'critical' ? 'bg-red-900 bg-opacity-20 border-red-700' :
                vuln.severity === 'high' ? 'bg-orange-900 bg-opacity-20 border-orange-700' :
                vuln.severity === 'medium' ? 'bg-yellow-900 bg-opacity-20 border-yellow-700' :
                'bg-gray-700 border-gray-600'
              }`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-white font-medium text-sm">{vuln.attackId}</p>
                    <p className="text-gray-300 text-xs mt-1">{vuln.details}</p>
                    <p className="text-gray-400 text-xs mt-2">
                      Confidence: {vuln.confidence}% | Affected Accounts: {vuln.affectedAccounts.length}
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded ${
                    vuln.severity === 'critical' ? 'bg-red-900 text-red-300' :
                    vuln.severity === 'high' ? 'bg-orange-900 text-orange-300' :
                    vuln.severity === 'medium' ? 'bg-yellow-900 text-yellow-300' :
                    'bg-gray-600 text-gray-300'
                  }`}>
                    {vuln.severity.toUpperCase()}
                  </span>
                </div>
                {vuln.exploitPath.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs text-gray-400 mb-1">Exploit Path:</p>
                    <ol className="list-decimal list-inside text-xs text-gray-300 space-y-1">
                      {vuln.exploitPath.map((step, i) => (
                        <li key={i}>{step}</li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Status */}
      <div className={`rounded-lg p-4 ${
        isMonitoring 
          ? 'bg-green-900 bg-opacity-20 border border-green-700' 
          : 'bg-gray-700'
      }`}>
        <div className="flex items-center space-x-3">
          <span className={`text-lg ${isMonitoring ? 'text-green-400' : 'text-gray-400'}`}>
            {isMonitoring ? '🟢' : '⭕'}
          </span>
          <div>
            <p className={`font-medium text-sm ${isMonitoring ? 'text-green-400' : 'text-gray-400'}`}>
              {isMonitoring ? 'Actively Monitoring' : 'Monitoring Paused'}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {isMonitoring 
                ? 'Analyzing attack test results in real-time for vulnerability patterns'
                : 'Click Start Monitoring to begin automated vulnerability detection'}
            </p>
          </div>
        </div>
      </div>

      {/* Export for integration */}
      {detectionStats.testsAnalyzed > 0 && (
        <div className="mt-4 text-center">
          <p className="text-xs text-gray-400">
            Success Rate: {((detectionStats.testsAnalyzed - detectionStats.vulnerabilitiesFound) / detectionStats.testsAnalyzed * 100).toFixed(2)}%
          </p>
        </div>
      )}
    </div>
  )
}

// Export utilities for use in other components
export { DETECTION_RULES, type VulnerabilityReport } 