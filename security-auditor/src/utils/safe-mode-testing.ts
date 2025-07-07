import { Connection, Transaction, PublicKey, TransactionInstruction } from '@solana/web3.js'
import * as anchor from '@coral-xyz/anchor'

export interface SafeModeConfig {
  dryRun: boolean
  logOnly: boolean
  simulateResponses: boolean
  verboseLogging: boolean
  captureInstructions: boolean
}

export interface AttackSimulationResult {
  status: 'success' | 'failed' | 'simulated' | 'blocked'
  wouldSucceed: boolean
  reason?: string
  gasEstimate?: number
  expectedError?: string
  capturedInstructions?: TransactionInstruction[]
  simulatedEffects?: string[]
  riskLevel?: 'low' | 'medium' | 'high' | 'critical'
}

export class SafeModeAttackTester {
  private config: SafeModeConfig
  private connection: Connection
  private capturedInstructions: TransactionInstruction[] = []

  constructor(connection: Connection, config: SafeModeConfig = {
    dryRun: true,
    logOnly: false,
    simulateResponses: true,
    verboseLogging: true,
    captureInstructions: true
  }) {
    this.connection = connection
    this.config = config
  }

  async simulateAttack(
    attackName: string,
    attackLogic: () => Promise<Transaction | TransactionInstruction[]>,
    expectedOutcome: Partial<AttackSimulationResult> = {}
  ): Promise<AttackSimulationResult> {
    if (this.config.verboseLogging) {
      console.log(`\n🧪 [SAFE MODE] Simulating attack: ${attackName}`)
    }

    try {
      // Build the attack transaction/instructions
      const attackTxOrInstructions = await attackLogic()
      
      let transaction: Transaction
      if (Array.isArray(attackTxOrInstructions)) {
        transaction = new Transaction()
        attackTxOrInstructions.forEach(ix => transaction.add(ix))
      } else {
        transaction = attackTxOrInstructions
      }

      if (this.config.captureInstructions) {
        this.capturedInstructions.push(...transaction.instructions)
      }

      // In dry run mode, don't execute
      if (this.config.dryRun) {
        return await this.analyzeDryRun(attackName, transaction, expectedOutcome)
      }

      // In log only mode, log but don't execute
      if (this.config.logOnly) {
        return await this.analyzeLogOnly(attackName, transaction, expectedOutcome)
      }

      // Otherwise, simulate the transaction
      const simulation = await this.connection.simulateTransaction(transaction)
      
      return this.analyzeSimulationResult(attackName, simulation, expectedOutcome)

    } catch (error: any) {
      if (this.config.verboseLogging) {
        console.log(`❌ Attack preparation failed: ${error.message}`)
      }

      return {
        status: 'failed',
        wouldSucceed: false,
        reason: error.message,
        expectedError: error.toString()
      }
    }
  }

  private async analyzeDryRun(
    attackName: string,
    transaction: Transaction,
    expectedOutcome: Partial<AttackSimulationResult>
  ): Promise<AttackSimulationResult> {
    const analysis = this.analyzeTransaction(transaction)
    
    if (this.config.verboseLogging) {
      console.log('📊 Dry Run Analysis:')
      console.log(`  - Instructions: ${transaction.instructions.length}`)
      console.log(`  - Signers required: ${transaction.signatures.length}`)
      console.log(`  - Risk indicators: ${analysis.riskIndicators.join(', ') || 'None'}`)
    }

    // Determine if attack would succeed based on analysis
    const wouldSucceed = this.predictAttackSuccess(attackName, analysis)

    return {
      status: 'simulated',
      wouldSucceed,
      reason: wouldSucceed ? 'Attack would likely succeed' : 'Attack would likely be blocked',
      gasEstimate: analysis.estimatedGas,
      capturedInstructions: this.config.captureInstructions ? transaction.instructions : undefined,
      simulatedEffects: analysis.simulatedEffects,
      riskLevel: analysis.riskLevel,
      ...expectedOutcome
    }
  }

  private async analyzeLogOnly(
    attackName: string,
    transaction: Transaction,
    expectedOutcome: Partial<AttackSimulationResult>
  ): Promise<AttackSimulationResult> {
    console.log(`\n📝 [LOG ONLY] Attack: ${attackName}`)
    console.log('Transaction Details:')
    
    transaction.instructions.forEach((ix, index) => {
      console.log(`  Instruction ${index + 1}:`)
      console.log(`    Program: ${ix.programId.toBase58()}`)
      console.log(`    Keys: ${ix.keys.length}`)
      console.log(`    Data length: ${ix.data.length}`)
    })

    return {
      status: 'simulated',
      wouldSucceed: false,
      reason: 'Log only mode - no execution',
      capturedInstructions: transaction.instructions,
      ...expectedOutcome
    }
  }

  private analyzeSimulationResult(
    attackName: string,
    simulation: any,
    expectedOutcome: Partial<AttackSimulationResult>
  ): AttackSimulationResult {
    const { err, logs, unitsConsumed } = simulation.value

    if (err) {
      const isExpectedError = this.isExpectedSecurityError(err)
      
      return {
        status: isExpectedError ? 'blocked' : 'failed',
        wouldSucceed: false,
        reason: err.toString(),
        gasEstimate: unitsConsumed,
        expectedError: err.toString(),
        riskLevel: 'low',
        ...expectedOutcome
      }
    }

    // If simulation succeeded, the attack would work
    return {
      status: 'success',
      wouldSucceed: true,
      reason: 'Simulation succeeded - vulnerability detected!',
      gasEstimate: unitsConsumed,
      riskLevel: 'critical',
      ...expectedOutcome
    }
  }

  private analyzeTransaction(transaction: Transaction) {
    const riskIndicators: string[] = []
    const simulatedEffects: string[] = []
    
    // Analyze each instruction
    transaction.instructions.forEach(ix => {
      // Check for admin operations
      if (this.isAdminOperation(ix)) {
        riskIndicators.push('admin_operation')
        simulatedEffects.push('Would attempt admin operation')
      }

      // Check for large transfers
      if (this.isLargeTransfer(ix)) {
        riskIndicators.push('large_transfer')
        simulatedEffects.push('Would transfer large amount')
      }

      // Check for program invocations
      if (this.isProgramInvocation(ix)) {
        riskIndicators.push('cross_program_invocation')
        simulatedEffects.push('Would invoke external program')
      }
    })

    // Estimate gas based on instruction count and complexity
    const estimatedGas = transaction.instructions.length * 5000 + 
                        riskIndicators.length * 2000

    // Determine risk level
    let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low'
    if (riskIndicators.length === 0) riskLevel = 'low'
    else if (riskIndicators.length === 1) riskLevel = 'medium'
    else if (riskIndicators.length === 2) riskLevel = 'high'
    else riskLevel = 'critical'

    return {
      riskIndicators,
      simulatedEffects,
      estimatedGas,
      riskLevel
    }
  }

  private predictAttackSuccess(attackName: string, analysis: any): boolean {
    // Predict based on attack type and risk indicators
    const attackPatterns: Record<string, string[]> = {
      'unauthorized_admin': ['admin_operation'],
      'overflow': ['large_transfer'],
      'reentrancy': ['cross_program_invocation'],
      'double_spending': ['large_transfer', 'cross_program_invocation']
    }

    const pattern = attackPatterns[attackName.toLowerCase()] || []
    
    // If attack has required risk indicators, it might succeed
    return pattern.every(indicator => 
      analysis.riskIndicators.includes(indicator)
    )
  }

  private isExpectedSecurityError(error: any): boolean {
    const securityErrors = [
      'Unauthorized',
      'Access denied',
      'Invalid authority',
      'Program failed',
      'custom program error'
    ]

    const errorStr = error.toString().toLowerCase()
    return securityErrors.some(secErr => 
      errorStr.includes(secErr.toLowerCase())
    )
  }

  private isAdminOperation(instruction: TransactionInstruction): boolean {
    // Check if instruction modifies admin/authority accounts
    return instruction.keys.some(key => 
      key.isWritable && key.isSigner
    )
  }

  private isLargeTransfer(instruction: TransactionInstruction): boolean {
    // Check instruction data for large values (simplified)
    return instruction.data.length > 32
  }

  private isProgramInvocation(instruction: TransactionInstruction): boolean {
    // Check if instruction invokes another program
    return instruction.keys.length > 3
  }

  getCapturedInstructions(): TransactionInstruction[] {
    return this.capturedInstructions
  }

  clearCapturedInstructions() {
    this.capturedInstructions = []
  }

  generateReport(): string {
    const report = `
# Safe Mode Attack Test Report

## Configuration
- Dry Run: ${this.config.dryRun}
- Log Only: ${this.config.logOnly}
- Verbose Logging: ${this.config.verboseLogging}

## Captured Instructions
Total: ${this.capturedInstructions.length}

### Instruction Details:
${this.capturedInstructions.map((ix, i) => `
${i + 1}. Program: ${ix.programId.toBase58()}
   Keys: ${ix.keys.length}
   Data: ${ix.data.length} bytes
`).join('')}

## Risk Analysis
Based on captured instructions, potential vulnerabilities include:
- Admin operation bypasses: ${this.capturedInstructions.filter(ix => this.isAdminOperation(ix)).length}
- Large transfers: ${this.capturedInstructions.filter(ix => this.isLargeTransfer(ix)).length}
- Cross-program calls: ${this.capturedInstructions.filter(ix => this.isProgramInvocation(ix)).length}
`
    return report
  }
}

// Helper function to create safe mode tester with default config
export function createSafeTester(connection: Connection, options: Partial<SafeModeConfig> = {}): SafeModeAttackTester {
  return new SafeModeAttackTester(connection, {
    dryRun: true,
    logOnly: false,
    simulateResponses: true,
    verboseLogging: true,
    captureInstructions: true,
    ...options
  })
} 