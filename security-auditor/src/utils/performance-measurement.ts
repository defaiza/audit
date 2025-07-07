import { Connection, PublicKey, Transaction, TransactionInstruction, ComputeBudgetProgram } from '@solana/web3.js'
import { Program } from '@coral-xyz/anchor'
import * as anchor from '@coral-xyz/anchor'

export interface PerformanceMetrics {
  functionName: string
  computeUnitsUsed: number
  executionTimeMs: number
  transactionSize: number
  accountsAccessed: number
  estimatedCostLamports: number
  gasEfficiency: 'optimal' | 'good' | 'poor' | 'critical'
  optimizationOpportunities: string[]
}

export interface BenchmarkResult {
  program: string
  timestamp: Date
  metrics: PerformanceMetrics[]
  summary: {
    averageComputeUnits: number
    totalCostLamports: number
    mostExpensiveFunction: string
    leastEfficientFunction: string
    totalOptimizationOpportunities: number
  }
}

export class PerformanceMeasurement {
  private connection: Connection
  private lamportsPerComputeUnit = 0.00025 // Current approximate rate

  constructor(connection: Connection) {
    this.connection = connection
  }

  /**
   * Benchmark all functions in a program
   */
  async benchmarkProgram(program: Program): Promise<BenchmarkResult> {
    console.log(`\n📊 Benchmarking performance for ${program.programId.toBase58()}...`)
    
    const timestamp = new Date()
    const metrics: PerformanceMetrics[] = []
    
    // Test each instruction in the IDL
    for (const instruction of program.idl.instructions) {
      try {
        const metric = await this.measureFunction(program, instruction.name)
        metrics.push(metric)
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100))
      } catch (error) {
        console.log(`Failed to benchmark ${instruction.name}: ${error}`)
      }
    }
    
    // Calculate summary statistics
    const summary = this.calculateSummary(metrics)
    
    return {
      program: program.programId.toBase58(),
      timestamp,
      metrics,
      summary
    }
  }

  /**
   * Measure performance of a specific function
   */
  async measureFunction(
    program: Program,
    functionName: string
  ): Promise<PerformanceMetrics> {
    console.log(`  ⚡ Measuring ${functionName}...`)
    
    // Build test transaction
    const tx = await this.buildTestTransaction(program, functionName)
    
    // Add compute budget instruction to get accurate measurements
    tx.add(
      ComputeBudgetProgram.setComputeUnitLimit({
        units: 1400000 // Maximum to see actual usage
      })
    )
    
    // Measure execution time
    const startTime = Date.now()
         const simulation = await this.connection.simulateTransaction(tx)
    const executionTimeMs = Date.now() - startTime
    
    // Extract metrics
    const computeUnitsUsed = simulation.value.unitsConsumed || 0
    const transactionSize = tx.serialize().length
    const accountsAccessed = this.countUniqueAccounts(tx)
    const estimatedCostLamports = this.calculateCost(
      computeUnitsUsed,
      transactionSize,
      simulation.value.err !== null
    )
    
    // Analyze efficiency
    const gasEfficiency = this.analyzeGasEfficiency(
      computeUnitsUsed,
      transactionSize,
      accountsAccessed
    )
    
    // Find optimization opportunities
    const optimizationOpportunities = this.findOptimizations(
      functionName,
      computeUnitsUsed,
      transactionSize,
      accountsAccessed,
      simulation.value.logs || []
    )
    
    return {
      functionName,
      computeUnitsUsed,
      executionTimeMs,
      transactionSize,
      accountsAccessed,
      estimatedCostLamports,
      gasEfficiency,
      optimizationOpportunities
    }
  }

  /**
   * Build test transaction for a function
   */
  private async buildTestTransaction(
    program: Program,
    functionName: string
  ): Promise<Transaction> {
    const tx = new Transaction()
    
    try {
      // Get function metadata from IDL
      const instruction = program.idl.instructions.find(i => i.name === functionName)
      if (!instruction) {
        throw new Error(`Function ${functionName} not found`)
      }
      
      // Build minimal valid arguments
      const args = this.buildMinimalArgs(instruction.args)
      
      // Build minimal valid accounts
      const accounts = this.buildMinimalAccounts(instruction.accounts)
      
      // Create instruction
      const ix = await program.methods[functionName](...Object.values(args))
        .accounts(accounts)
        .instruction()
      
      tx.add(ix)
    } catch (error) {
      // Fallback to raw instruction for measurement
      const data = Buffer.alloc(1) // Minimal data
      data.writeUInt8(0, 0)
      
      tx.add(new TransactionInstruction({
        keys: [{
          pubkey: anchor.web3.Keypair.generate().publicKey,
          isSigner: true,
          isWritable: true
        }],
        programId: program.programId,
        data
      }))
    }
    
    return tx
  }

  /**
   * Build minimal valid arguments for testing
   */
  private buildMinimalArgs(args: any[]): Record<string, any> {
    const result: Record<string, any> = {}
    
    for (const arg of args) {
      const argType = arg.type
      
      // Handle different argument types
      if (typeof argType === 'string') {
        switch (argType) {
          case 'u8':
          case 'u16':
          case 'u32':
          case 'u64':
          case 'u128':
            result[arg.name] = new anchor.BN(1)
            break
          case 'i8':
          case 'i16':
          case 'i32':
          case 'i64':
          case 'i128':
            result[arg.name] = new anchor.BN(0)
            break
          case 'bool':
            result[arg.name] = false
            break
          case 'string':
            result[arg.name] = 'test'
            break
          case 'publicKey':
            result[arg.name] = anchor.web3.PublicKey.default
            break
          default:
            result[arg.name] = null
        }
      } else if (argType.vec) {
        result[arg.name] = []
      } else if (argType.option) {
        result[arg.name] = null
      } else {
        result[arg.name] = {}
      }
    }
    
    return result
  }

  /**
   * Build minimal valid accounts for testing
   */
  private buildMinimalAccounts(accounts: any[]): Record<string, PublicKey> {
    const result: Record<string, PublicKey> = {}
    const testKeypair = anchor.web3.Keypair.generate()
    
    for (const account of accounts) {
      // Use appropriate account based on type
      if (account.name.toLowerCase().includes('system')) {
        result[account.name] = anchor.web3.SystemProgram.programId
      } else if (account.name.toLowerCase().includes('token')) {
        result[account.name] = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')
      } else if (account.name.toLowerCase().includes('rent')) {
        result[account.name] = anchor.web3.SYSVAR_RENT_PUBKEY
      } else if (account.name.toLowerCase().includes('clock')) {
        result[account.name] = anchor.web3.SYSVAR_CLOCK_PUBKEY
      } else {
        // Generate test account
        result[account.name] = testKeypair.publicKey
      }
    }
    
    return result
  }

  /**
   * Count unique accounts in transaction
   */
  private countUniqueAccounts(tx: Transaction): number {
    const accounts = new Set<string>()
    
    for (const instruction of tx.instructions) {
      for (const key of instruction.keys) {
        accounts.add(key.pubkey.toBase58())
      }
    }
    
    return accounts.size
  }

  /**
   * Calculate estimated cost in lamports
   */
  private calculateCost(
    computeUnits: number,
    transactionSize: number,
    failed: boolean
  ): number {
    // Base fee (5000 lamports per signature)
    let cost = 5000
    
    // Compute unit fee
    cost += Math.ceil(computeUnits * this.lamportsPerComputeUnit)
    
    // Size-based fee (approximate)
    cost += Math.ceil(transactionSize * 10)
    
    // Failed transactions still cost base fee
    if (failed) {
      return 5000
    }
    
    return cost
  }

  /**
   * Analyze gas efficiency
   */
  private analyzeGasEfficiency(
    computeUnits: number,
    transactionSize: number,
    accountsAccessed: number
  ): 'optimal' | 'good' | 'poor' | 'critical' {
    // Calculate efficiency score
    const unitsPerAccount = computeUnits / Math.max(accountsAccessed, 1)
    const unitsPerByte = computeUnits / Math.max(transactionSize, 1)
    
    // Thresholds
    if (computeUnits > 1000000) return 'critical'
    if (computeUnits > 500000) return 'poor'
    if (unitsPerAccount > 100000) return 'poor'
    if (unitsPerByte > 1000) return 'poor'
    if (computeUnits < 50000 && unitsPerAccount < 20000) return 'optimal'
    
    return 'good'
  }

  /**
   * Find optimization opportunities
   */
  private findOptimizations(
    functionName: string,
    computeUnits: number,
    transactionSize: number,
    accountsAccessed: number,
    logs: string[]
  ): string[] {
    const opportunities: string[] = []
    
    // High compute usage
    if (computeUnits > 500000) {
      opportunities.push('Consider optimizing algorithm complexity')
      opportunities.push('Break operation into multiple transactions')
    }
    
    // Large transaction size
    if (transactionSize > 1000) {
      opportunities.push('Reduce instruction data size')
      opportunities.push('Consider using compression or more efficient encoding')
    }
    
    // Many accounts
    if (accountsAccessed > 10) {
      opportunities.push('Reduce number of accounts accessed')
      opportunities.push('Consider account consolidation')
    }
    
    // Check logs for specific patterns
    if (logs.some(log => log.includes('iteration'))) {
      opportunities.push('Optimize loops and iterations')
    }
    
    if (logs.some(log => log.includes('allocation'))) {
      opportunities.push('Reduce memory allocations')
    }
    
    if (logs.some(log => log.includes('borsh'))) {
      opportunities.push('Optimize serialization/deserialization')
    }
    
    // Function-specific optimizations
    if (functionName.includes('transfer') || functionName.includes('swap')) {
      opportunities.push('Consider batching multiple operations')
    }
    
    if (functionName.includes('calculate') || functionName.includes('compute')) {
      opportunities.push('Cache intermediate results if possible')
    }
    
         return Array.from(new Set(opportunities))
  }

  /**
   * Calculate summary statistics
   */
  private calculateSummary(metrics: PerformanceMetrics[]): BenchmarkResult['summary'] {
    if (metrics.length === 0) {
      return {
        averageComputeUnits: 0,
        totalCostLamports: 0,
        mostExpensiveFunction: 'none',
        leastEfficientFunction: 'none',
        totalOptimizationOpportunities: 0
      }
    }
    
    // Average compute units
    const totalComputeUnits = metrics.reduce((sum, m) => sum + m.computeUnitsUsed, 0)
    const averageComputeUnits = Math.round(totalComputeUnits / metrics.length)
    
    // Total cost
    const totalCostLamports = metrics.reduce((sum, m) => sum + m.estimatedCostLamports, 0)
    
    // Most expensive function
    const mostExpensive = metrics.reduce((max, m) => 
      m.estimatedCostLamports > max.estimatedCostLamports ? m : max
    )
    
    // Least efficient function
    const leastEfficient = metrics.reduce((worst, m) => {
      const worseEfficiency = ['critical', 'poor'].includes(m.gasEfficiency)
      const currentWorst = ['critical', 'poor'].includes(worst.gasEfficiency)
      
      if (worseEfficiency && !currentWorst) return m
      if (!worseEfficiency && currentWorst) return worst
      if (m.computeUnitsUsed > worst.computeUnitsUsed) return m
      return worst
    })
    
    // Total optimization opportunities
    const totalOptimizationOpportunities = metrics.reduce(
      (sum, m) => sum + m.optimizationOpportunities.length,
      0
    )
    
    return {
      averageComputeUnits,
      totalCostLamports,
      mostExpensiveFunction: mostExpensive.functionName,
      leastEfficientFunction: leastEfficient.functionName,
      totalOptimizationOpportunities
    }
  }

  /**
   * Compare two benchmark results
   */
  compareBenchmarks(
    before: BenchmarkResult,
    after: BenchmarkResult
  ): {
    computeUnitsChange: number
    costChange: number
    improvements: string[]
    regressions: string[]
  } {
    const improvements: string[] = []
    const regressions: string[] = []
    
    // Compare each function
    for (const afterMetric of after.metrics) {
      const beforeMetric = before.metrics.find(m => m.functionName === afterMetric.functionName)
      
      if (beforeMetric) {
        const computeChange = afterMetric.computeUnitsUsed - beforeMetric.computeUnitsUsed
        const percentChange = (computeChange / beforeMetric.computeUnitsUsed) * 100
        
        if (computeChange < -1000) {
          improvements.push(
            `${afterMetric.functionName}: ${Math.abs(percentChange).toFixed(1)}% reduction in compute units`
          )
        } else if (computeChange > 1000) {
          regressions.push(
            `${afterMetric.functionName}: ${percentChange.toFixed(1)}% increase in compute units`
          )
        }
      }
    }
    
    return {
      computeUnitsChange: after.summary.averageComputeUnits - before.summary.averageComputeUnits,
      costChange: after.summary.totalCostLamports - before.summary.totalCostLamports,
      improvements,
      regressions
    }
  }

  /**
   * Generate optimization report
   */
  generateOptimizationReport(benchmark: BenchmarkResult): string {
    const inefficientFunctions = benchmark.metrics.filter(m => 
      m.gasEfficiency === 'poor' || m.gasEfficiency === 'critical'
    )
    
    return `
# Performance Optimization Report

**Program:** ${benchmark.program}
**Date:** ${benchmark.timestamp.toISOString()}

## Summary
- Average Compute Units: ${benchmark.summary.averageComputeUnits.toLocaleString()}
- Total Estimated Cost: ${(benchmark.summary.totalCostLamports / 1e9).toFixed(6)} SOL
- Functions Analyzed: ${benchmark.metrics.length}
- Optimization Opportunities: ${benchmark.summary.totalOptimizationOpportunities}

## Critical Functions
- Most Expensive: ${benchmark.summary.mostExpensiveFunction}
- Least Efficient: ${benchmark.summary.leastEfficientFunction}

## Functions Requiring Optimization
${inefficientFunctions.map(f => `
### ${f.functionName}
- Compute Units: ${f.computeUnitsUsed.toLocaleString()}
- Efficiency: ${f.gasEfficiency}
- Cost: ${(f.estimatedCostLamports / 1e9).toFixed(9)} SOL
- Optimizations:
${f.optimizationOpportunities.map(o => `  - ${o}`).join('\n')}
`).join('\n')}

## Top Recommendations
${this.getTopRecommendations(benchmark).map((r, i) => `${i + 1}. ${r}`).join('\n')}
    `.trim()
  }

  /**
   * Get top optimization recommendations
   */
  private getTopRecommendations(benchmark: BenchmarkResult): string[] {
    const recommendations: string[] = []
    
    // Check for critical efficiency issues
    const criticalFunctions = benchmark.metrics.filter(m => m.gasEfficiency === 'critical')
    if (criticalFunctions.length > 0) {
      recommendations.push(
        `CRITICAL: ${criticalFunctions.length} functions exceed compute limits and need immediate optimization`
      )
    }
    
    // Check average compute units
    if (benchmark.summary.averageComputeUnits > 200000) {
      recommendations.push('Consider breaking complex operations into multiple transactions')
    }
    
    // Check for common patterns
    const allOptimizations = benchmark.metrics.flatMap(m => m.optimizationOpportunities)
    const optimizationCounts = new Map<string, number>()
    
    for (const opt of allOptimizations) {
      optimizationCounts.set(opt, (optimizationCounts.get(opt) || 0) + 1)
    }
    
    // Add most common optimizations
    const sortedOptimizations = Array.from(optimizationCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
    
    for (const [optimization, count] of sortedOptimizations) {
      if (count >= 2) {
        recommendations.push(`${optimization} (affects ${count} functions)`)
      }
    }
    
    return recommendations
  }
}

// Export factory function
export const createPerformanceMeasurement = (connection: Connection) => 
  new PerformanceMeasurement(connection) 