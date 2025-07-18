import { Connection, PublicKey, Transaction, ParsedTransactionWithMeta } from '@solana/web3.js'
import { Program } from '@coral-xyz/anchor'
import { EventEmitter } from 'events'

export interface TransactionAlert {
  type: 'suspicious' | 'attack' | 'anomaly' | 'high-value'
  severity: 'low' | 'medium' | 'high' | 'critical'
  timestamp: Date
  signature: string
  program: string
  details: string
  metadata?: any
}

export interface MonitoringStats {
  totalTransactions: number
  suspiciousTransactions: number
  alertsGenerated: number
  programActivity: Map<string, number>
  attackPatterns: Map<string, number>
}

export class WebSocketMonitor extends EventEmitter {
  private connection: Connection
  private programs: Map<string, Program> = new Map()
  private subscriptionIds: number[] = []
  private stats: MonitoringStats
  private isMonitoring = false
  private suspiciousPatterns: RegExp[]

  constructor(connection: Connection) {
    super()
    this.connection = connection
    this.stats = {
      totalTransactions: 0,
      suspiciousTransactions: 0,
      alertsGenerated: 0,
      programActivity: new Map(),
      attackPatterns: new Map()
    }
    this.suspiciousPatterns = this.initializePatterns()
  }

  /**
   * Start monitoring programs
   */
  async startMonitoring(programs: Program[]): Promise<void> {
    if (this.isMonitoring) {
      console.log('⚠️ Monitoring already active')
      return
    }

    console.log('🔍 Starting WebSocket monitoring...')
    this.isMonitoring = true

    // Store programs for reference
    for (const program of programs) {
      this.programs.set(program.programId.toBase58(), program)
    }

    // Subscribe to each program
    for (const program of programs) {
      await this.subscribeToProgram(program)
    }

    // Start periodic stats reporting
    this.startStatsReporting()

    console.log(`✅ Monitoring ${programs.length} programs`)
  }

  /**
   * Stop monitoring
   */
  async stopMonitoring(): Promise<void> {
    console.log('🛑 Stopping monitoring...')
    this.isMonitoring = false

    // Unsubscribe from all programs
    for (const subscriptionId of this.subscriptionIds) {
      try {
        await this.connection.removeAccountChangeListener(subscriptionId)
      } catch (error) {
        console.error(`Failed to remove subscription ${subscriptionId}:`, error)
      }
    }

    this.subscriptionIds = []
    this.emit('monitoring-stopped', this.stats)
  }

  /**
   * Subscribe to program logs
   */
  private async subscribeToProgram(program: Program): Promise<void> {
    const programId = program.programId

    // Subscribe to logs
    const logsSubscriptionId = this.connection.onLogs(
      programId,
      (logs, context) => {
        this.processLogs(programId, logs, context)
      },
      'confirmed'
    )

    this.subscriptionIds.push(logsSubscriptionId)

    // Subscribe to program account changes
    const accountSubscriptionId = this.connection.onProgramAccountChange(
      programId,
      (accountInfo, context) => {
        this.processAccountChange(programId, accountInfo, context)
      },
      'confirmed'
    )

    this.subscriptionIds.push(accountSubscriptionId)
  }

  /**
   * Process transaction logs
   */
  private async processLogs(
    programId: PublicKey,
    logs: any,
    context: any
  ): Promise<void> {
    this.stats.totalTransactions++
    
    const programStr = programId.toBase58()
    this.stats.programActivity.set(
      programStr,
      (this.stats.programActivity.get(programStr) || 0) + 1
    )

    // Analyze logs for suspicious patterns
    const analysis = this.analyzeLogs(logs)
    
    if (analysis.suspicious) {
      this.stats.suspiciousTransactions++
      
      const alert: TransactionAlert = {
        type: analysis.type,
        severity: analysis.severity,
        timestamp: new Date(),
        signature: logs.signature,
        program: programStr,
        details: analysis.details,
        metadata: {
          logs: logs.logs,
          err: logs.err
        }
      }

      this.generateAlert(alert)
    }

    // Check for specific attack patterns
    if (logs.err) {
      this.analyzeError(programId, logs.err, logs.signature)
    }
  }

  /**
   * Process account changes
   */
  private processAccountChange(
    programId: PublicKey,
    accountInfo: any,
    context: any
  ): void {
    // Monitor for rapid state changes that might indicate attacks
    const accountPubkey = accountInfo.accountId.toBase58()
    
    // Track account update frequency
    if (this.isRapidUpdate(accountPubkey)) {
      const alert: TransactionAlert = {
        type: 'anomaly',
        severity: 'medium',
        timestamp: new Date(),
        signature: context.slot.toString(),
        program: programId.toBase58(),
        details: `Rapid state changes detected for account ${accountPubkey}`
      }
      
      this.generateAlert(alert)
    }
  }

  /**
   * Analyze logs for suspicious patterns
   */
  private analyzeLogs(logs: any): {
    suspicious: boolean
    type: TransactionAlert['type']
    severity: TransactionAlert['severity']
    details: string
  } {
    const logText = logs.logs.join(' ').toLowerCase()
    
    // Check for attack indicators
    for (const pattern of this.suspiciousPatterns) {
      if (pattern.test(logText)) {
        return {
          suspicious: true,
          type: 'attack',
          severity: 'high',
          details: `Suspicious pattern detected: ${pattern.source}`
        }
      }
    }

    // Check for high-value transfers
    const amountMatch = logText.match(/transfer.*?(\d+)/i)
    if (amountMatch) {
      const amount = parseInt(amountMatch[1])
      if (amount > 1000000000) { // 1 SOL
        return {
          suspicious: true,
          type: 'high-value',
          severity: 'medium',
          details: `High-value transfer detected: ${amount} lamports`
        }
      }
    }

    // Check for failed transactions that might be attack attempts
    if (logs.err) {
      const errorStr = JSON.stringify(logs.err).toLowerCase()
      if (errorStr.includes('overflow') || 
          errorStr.includes('underflow') ||
          errorStr.includes('unauthorized')) {
        return {
          suspicious: true,
          type: 'attack',
          severity: 'high',
          details: `Failed attack attempt: ${errorStr}`
        }
      }
    }

    return {
      suspicious: false,
      type: 'suspicious',
      severity: 'low',
      details: ''
    }
  }

  /**
   * Analyze transaction errors
   */
  private analyzeError(
    programId: PublicKey,
    error: any,
    signature: string
  ): void {
    const errorStr = JSON.stringify(error).toLowerCase()
    
    // Categorize attack patterns
    if (errorStr.includes('overflow')) {
      this.recordAttackPattern('overflow')
    } else if (errorStr.includes('reentr')) {
      this.recordAttackPattern('reentrancy')
    } else if (errorStr.includes('unauthorized') || errorStr.includes('access')) {
      this.recordAttackPattern('access_control')
    } else if (errorStr.includes('invalid') || errorStr.includes('validation')) {
      this.recordAttackPattern('input_validation')
    }
  }

  /**
   * Check for rapid account updates
   */
  private accountUpdateTimes = new Map<string, number[]>()
  
  private isRapidUpdate(accountPubkey: string): boolean {
    const now = Date.now()
    const times = this.accountUpdateTimes.get(accountPubkey) || []
    
    // Add current time
    times.push(now)
    
    // Keep only recent times (last 10 seconds)
    const recentTimes = times.filter(t => now - t < 10000)
    this.accountUpdateTimes.set(accountPubkey, recentTimes)
    
    // Alert if more than 5 updates in 10 seconds
    return recentTimes.length > 5
  }

  /**
   * Record attack pattern
   */
  private recordAttackPattern(pattern: string): void {
    this.stats.attackPatterns.set(
      pattern,
      (this.stats.attackPatterns.get(pattern) || 0) + 1
    )
  }

  /**
   * Generate and emit alert
   */
  private generateAlert(alert: TransactionAlert): void {
    this.stats.alertsGenerated++
    
    // Emit alert event
    this.emit('alert', alert)
    
    // Log critical alerts
    if (alert.severity === 'critical') {
      console.error(`🚨 CRITICAL ALERT: ${alert.details}`)
    } else if (alert.severity === 'high') {
      console.warn(`⚠️ HIGH ALERT: ${alert.details}`)
    }
    
    // Store alert history (in production, this would go to a database)
    this.emit('alert-logged', alert)
  }

  /**
   * Initialize suspicious patterns
   */
  private initializePatterns(): RegExp[] {
    return [
      /overflow|underflow/i,
      /reentr(y|ant)/i,
      /unauthorized|forbidden/i,
      /double.*spend/i,
      /exhaust|dos|denial/i,
      /malicious|exploit/i,
      /bypass|escalat/i,
      /manipulat/i,
      /invalid.*nonce/i,
      /replay.*attack/i
    ]
  }

  /**
   * Start periodic stats reporting
   */
  private startStatsReporting(): void {
    const reportInterval = setInterval(() => {
      if (!this.isMonitoring) {
        clearInterval(reportInterval)
        return
      }
      
      this.reportStats()
    }, 30000) // Report every 30 seconds
  }

  /**
   * Report current stats
   */
  private reportStats(): void {
    console.log('\n📊 Monitoring Statistics:')
    console.log(`  Total Transactions: ${this.stats.totalTransactions}`)
    console.log(`  Suspicious Transactions: ${this.stats.suspiciousTransactions}`)
    console.log(`  Alerts Generated: ${this.stats.alertsGenerated}`)
    
    if (this.stats.programActivity.size > 0) {
      console.log('  Program Activity:')
             for (const [program, count] of Array.from(this.stats.programActivity)) {
        console.log(`    ${program.slice(0, 8)}...: ${count} transactions`)
      }
    }
    
    if (this.stats.attackPatterns.size > 0) {
      console.log('  Attack Patterns Detected:')
             for (const [pattern, count] of Array.from(this.stats.attackPatterns)) {
        console.log(`    ${pattern}: ${count} attempts`)
      }
    }
    
    this.emit('stats-update', this.stats)
  }

  /**
   * Get current monitoring stats
   */
  getStats(): MonitoringStats {
    return { ...this.stats }
  }

  /**
   * Analyze historical transactions
   */
  async analyzeHistoricalTransactions(
    programId: PublicKey,
    limit: number = 100
  ): Promise<{
    suspiciousCount: number
    patterns: string[]
  }> {
    console.log(`\n🔍 Analyzing last ${limit} transactions for ${programId.toBase58()}...`)
    
    try {
      // Get recent signatures
      const signatures = await this.connection.getSignaturesForAddress(
        programId,
        { limit }
      )
      
      let suspiciousCount = 0
      const patterns = new Set<string>()
      
      // Analyze each transaction
      for (const sigInfo of signatures) {
        if (sigInfo.err) {
          suspiciousCount++
          const errorStr = JSON.stringify(sigInfo.err).toLowerCase()
          
          // Identify patterns
          for (const pattern of this.suspiciousPatterns) {
            if (pattern.test(errorStr)) {
              patterns.add(pattern.source)
            }
          }
        }
      }
      
      return {
        suspiciousCount,
        patterns: Array.from(patterns)
      }
    } catch (error) {
      console.error('Failed to analyze historical transactions:', error)
      return { suspiciousCount: 0, patterns: [] }
    }
  }

  /**
   * Monitor specific account for attacks
   */
  async monitorAccount(
    accountPubkey: PublicKey,
    callback: (alert: TransactionAlert) => void
  ): Promise<number> {
    const subscriptionId = this.connection.onAccountChange(
      accountPubkey,
      (accountInfo, context) => {
        // Check for suspicious changes
        const dataSize = accountInfo.data.length
        const lamports = accountInfo.lamports
        
        // Alert on unusual conditions
        if (dataSize > 10000) {
          callback({
            type: 'anomaly',
            severity: 'medium',
            timestamp: new Date(),
            signature: context.slot.toString(),
            program: accountInfo.owner.toBase58(),
            details: `Large data size detected: ${dataSize} bytes`
          })
        }
        
        if (lamports === 0) {
          callback({
            type: 'suspicious',
            severity: 'high',
            timestamp: new Date(),
            signature: context.slot.toString(),
            program: accountInfo.owner.toBase58(),
            details: 'Account drained to zero balance'
          })
        }
      },
      'confirmed'
    )
    
    this.subscriptionIds.push(subscriptionId)
    return subscriptionId
  }
}

// Export factory function
export const createWebSocketMonitor = (connection: Connection) => 
  new WebSocketMonitor(connection) 