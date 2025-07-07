import { Connection, PublicKey, Keypair, Transaction, TransactionInstruction, SystemProgram } from '@solana/web3.js'
import { Program } from '@coral-xyz/anchor'
import * as anchor from '@coral-xyz/anchor'
import { TestEnvironment } from '../test-infrastructure'

export interface ReentrancyAttackResult {
  success: boolean
  type: 'simple' | 'cross-program' | 'callback'
  targetFunction: string
  program: string
  depth: number
  stateChanges?: string[]
  error?: string
  logs?: string[]
  computeUnits?: number
}

export class ReentrancyAttackTester {
  private connection: Connection
  private environment: TestEnvironment
  private maliciousProgram?: PublicKey

  constructor(connection: Connection, environment: TestEnvironment) {
    this.connection = connection
    this.environment = environment
  }

  /**
   * Test simple reentrancy within same program
   */
  async testSimpleReentrancy(program: Program): Promise<ReentrancyAttackResult> {
    console.log(`\n🔄 Testing simple reentrancy on ${program.programId.toBase58()}...`)
    
    try {
      // Find vulnerable functions (typically withdraw, transfer, etc.)
      const vulnerableFunction = this.findReentrantFunction(program)
      if (!vulnerableFunction) {
        return {
          success: false,
          type: 'simple',
          targetFunction: 'unknown',
          program: program.programId.toBase58(),
          depth: 0,
          error: 'No potentially vulnerable function found'
        }
      }

      // Create a self-referencing transaction
      const tx = await this.buildReentrantTransaction(
        program,
        vulnerableFunction,
        this.environment.attacker.keypair,
        1 // Initial depth
      )

      // Simulate the attack
      const simulation = await this.connection.simulateTransaction(tx)
      
      if (simulation.value.err) {
        // Good - reentrancy prevented
        return {
          success: false,
          type: 'simple',
          targetFunction: vulnerableFunction,
          program: program.programId.toBase58(),
          depth: 1,
          error: JSON.stringify(simulation.value.err),
          logs: simulation.value.logs || undefined,
          computeUnits: simulation.value.unitsConsumed
        }
      }

      // If simulation passes, check for reentrancy indicators
      const reentrancyDetected = this.analyzeLogsForReentrancy(simulation.value.logs || [])
      
      return {
        success: reentrancyDetected,
        type: 'simple',
        targetFunction: vulnerableFunction,
        program: program.programId.toBase58(),
        depth: this.countReentrantCalls(simulation.value.logs || []),
        logs: simulation.value.logs || undefined,
        computeUnits: simulation.value.unitsConsumed
      }

    } catch (error: any) {
      return {
        success: false,
        type: 'simple',
        targetFunction: 'unknown',
        program: program.programId.toBase58(),
        depth: 0,
        error: error.message
      }
    }
  }

  /**
   * Test cross-program reentrancy attack
   */
  async testCrossProgramReentrancy(
    sourceProgram: Program,
    targetProgram: Program
  ): Promise<ReentrancyAttackResult> {
    console.log(`\n🔄 Testing cross-program reentrancy...`)
    console.log(`   Source: ${sourceProgram.programId.toBase58()}`)
    console.log(`   Target: ${targetProgram.programId.toBase58()}`)
    
    try {
      // Deploy or reference malicious intermediary program
      if (!this.maliciousProgram) {
        this.maliciousProgram = await this.deployMaliciousContract()
      }

      // Find CPI functions in source program
      const cpiFunction = this.findCPIFunction(sourceProgram)
      if (!cpiFunction) {
        return {
          success: false,
          type: 'cross-program',
          targetFunction: 'unknown',
          program: sourceProgram.programId.toBase58(),
          depth: 0,
          error: 'No CPI function found in source program'
        }
      }

      // Build cross-program attack transaction
      const tx = await this.buildCrossProgramAttack(
        sourceProgram,
        targetProgram,
        cpiFunction,
        this.environment.attacker.keypair
      )

      const simulation = await this.connection.simulateTransaction(tx)
      
      return {
        success: !simulation.value.err && this.detectCrossProgramReentrancy(simulation.value.logs || []),
        type: 'cross-program',
        targetFunction: cpiFunction,
        program: sourceProgram.programId.toBase58(),
        depth: this.countCrossProgramCalls(simulation.value.logs || []),
        error: simulation.value.err ? JSON.stringify(simulation.value.err) : undefined,
        logs: simulation.value.logs || undefined,
        computeUnits: simulation.value.unitsConsumed
      }

    } catch (error: any) {
      return {
        success: false,
        type: 'cross-program',
        targetFunction: 'unknown',
        program: sourceProgram.programId.toBase58(),
        depth: 0,
        error: error.message
      }
    }
  }

  /**
   * Test callback-based reentrancy
   */
  async testCallbackReentrancy(program: Program): Promise<ReentrancyAttackResult> {
    console.log(`\n🔄 Testing callback reentrancy on ${program.programId.toBase58()}...`)
    
    try {
      // Find functions that accept callbacks or hooks
      const callbackFunction = this.findCallbackFunction(program)
      if (!callbackFunction) {
        return {
          success: false,
          type: 'callback',
          targetFunction: 'unknown',
          program: program.programId.toBase58(),
          depth: 0,
          error: 'No callback function found'
        }
      }

      // Create malicious callback that re-enters
      const tx = await this.buildCallbackAttack(
        program,
        callbackFunction,
        this.environment.attacker.keypair
      )

      const simulation = await this.connection.simulateTransaction(tx)
      
      // Analyze state changes
      const stateChanges = await this.detectStateChanges(
        program,
        simulation.value.logs || []
      )
      
      return {
        success: !simulation.value.err && stateChanges.length > 1,
        type: 'callback',
        targetFunction: callbackFunction,
        program: program.programId.toBase58(),
        depth: stateChanges.length,
        stateChanges,
        error: simulation.value.err ? JSON.stringify(simulation.value.err) : undefined,
        logs: simulation.value.logs || undefined,
        computeUnits: simulation.value.unitsConsumed
      }

    } catch (error: any) {
      return {
        success: false,
        type: 'callback',
        targetFunction: 'unknown',
        program: program.programId.toBase58(),
        depth: 0,
        error: error.message
      }
    }
  }

  /**
   * Find functions susceptible to reentrancy
   */
  private findReentrantFunction(program: Program): string | null {
    const vulnerableKeywords = [
      'withdraw', 'transfer', 'send', 'claim', 
      'redeem', 'execute', 'process', 'handle'
    ]
    
    for (const instruction of program.idl.instructions) {
      if (vulnerableKeywords.some(keyword => 
        instruction.name.toLowerCase().includes(keyword)
      )) {
        return instruction.name
      }
    }
    
    return null
  }

  /**
   * Find functions that make cross-program invocations
   */
  private findCPIFunction(program: Program): string | null {
    const cpiKeywords = ['invoke', 'call', 'execute', 'cpi', 'cross']
    
    for (const instruction of program.idl.instructions) {
      if (cpiKeywords.some(keyword => 
        instruction.name.toLowerCase().includes(keyword)
      )) {
        return instruction.name
      }
    }
    
    // Also check for functions with program accounts
    for (const instruction of program.idl.instructions) {
      const hasProgramAccount = instruction.accounts.some(acc =>
        acc.name.toLowerCase().includes('program')
      )
      if (hasProgramAccount) {
        return instruction.name
      }
    }
    
    return null
  }

  /**
   * Find functions that accept callbacks
   */
  private findCallbackFunction(program: Program): string | null {
    const callbackKeywords = ['callback', 'hook', 'handler', 'listener']
    
    for (const instruction of program.idl.instructions) {
      if (callbackKeywords.some(keyword => 
        instruction.name.toLowerCase().includes(keyword)
      )) {
        return instruction.name
      }
    }
    
    return null
  }

  /**
   * Build a reentrant transaction
   */
  private async buildReentrantTransaction(
    program: Program,
    functionName: string,
    signer: Keypair,
    depth: number
  ): Promise<Transaction> {
    const tx = new Transaction()
    
    try {
      // Create the initial instruction
      const instruction = await program.methods[functionName]()
        .accounts({
          user: signer.publicKey,
          systemProgram: SystemProgram.programId
        })
        .instruction()
      
      // Add the same instruction multiple times to simulate reentrancy
      for (let i = 0; i < depth; i++) {
        tx.add(instruction)
      }
      
    } catch (error) {
      // Fallback to raw instruction
      const data = Buffer.from([0x01]) // Reentrant call marker
      
      for (let i = 0; i < depth; i++) {
        tx.add(new TransactionInstruction({
          keys: [
            {
              pubkey: signer.publicKey,
              isSigner: true,
              isWritable: true
            },
            {
              pubkey: program.programId,
              isSigner: false,
              isWritable: false
            }
          ],
          programId: program.programId,
          data
        }))
      }
    }
    
    return tx
  }

  /**
   * Build cross-program attack transaction
   */
  private async buildCrossProgramAttack(
    sourceProgram: Program,
    targetProgram: Program,
    functionName: string,
    signer: Keypair
  ): Promise<Transaction> {
    const tx = new Transaction()
    
    try {
      // Create instruction that calls into target program
      const instruction = await sourceProgram.methods[functionName]()
        .accounts({
          user: signer.publicKey,
          targetProgram: targetProgram.programId,
          systemProgram: SystemProgram.programId
        })
        .remainingAccounts([
          {
            pubkey: this.maliciousProgram || Keypair.generate().publicKey,
            isSigner: false,
            isWritable: false
          }
        ])
        .instruction()
      
      tx.add(instruction)
      
    } catch (error) {
      // Create raw CPI instruction
      const data = Buffer.alloc(33)
      data.writeUInt8(0x02, 0) // CPI marker
      data.write(targetProgram.programId.toBuffer().toString('hex'), 1, 'hex')
      
      tx.add(new TransactionInstruction({
        keys: [
          {
            pubkey: signer.publicKey,
            isSigner: true,
            isWritable: true
          },
          {
            pubkey: targetProgram.programId,
            isSigner: false,
            isWritable: false
          }
        ],
        programId: sourceProgram.programId,
        data
      }))
    }
    
    return tx
  }

  /**
   * Build callback attack transaction
   */
  private async buildCallbackAttack(
    program: Program,
    functionName: string,
    signer: Keypair
  ): Promise<Transaction> {
    const tx = new Transaction()
    
    // Create a malicious callback address
    const maliciousCallback = Keypair.generate().publicKey
    
    try {
      const instruction = await program.methods[functionName]()
        .accounts({
          user: signer.publicKey,
          callback: maliciousCallback,
          systemProgram: SystemProgram.programId
        })
        .instruction()
      
      tx.add(instruction)
      
    } catch (error) {
      // Raw callback instruction
      const data = Buffer.alloc(33)
      data.writeUInt8(0x03, 0) // Callback marker
      data.write(maliciousCallback.toBuffer().toString('hex'), 1, 'hex')
      
      tx.add(new TransactionInstruction({
        keys: [
          {
            pubkey: signer.publicKey,
            isSigner: true,
            isWritable: true
          },
          {
            pubkey: maliciousCallback,
            isSigner: false,
            isWritable: false
          }
        ],
        programId: program.programId,
        data
      }))
    }
    
    return tx
  }

  /**
   * Deploy a malicious contract for testing
   */
  private async deployMaliciousContract(): Promise<PublicKey> {
    // In a real scenario, this would deploy an actual malicious program
    // For testing, we'll use a mock address
    console.log('🦹 Deploying malicious contract (simulated)...')
    return Keypair.generate().publicKey
  }

  /**
   * Analyze logs for reentrancy patterns
   */
  private analyzeLogsForReentrancy(logs: string[]): boolean {
    const reentrancyIndicators = [
      'reentrant',
      'recursive call',
      'already processing',
      'locked',
      'reentrancy guard',
      'call depth exceeded'
    ]
    
    return logs.some(log => 
      reentrancyIndicators.some(indicator => 
        log.toLowerCase().includes(indicator)
      )
    )
  }

  /**
   * Count reentrant calls in logs
   */
  private countReentrantCalls(logs: string[]): number {
    let count = 0
    const callPattern = /invoke|call|enter/i
    
    for (const log of logs) {
      if (callPattern.test(log)) {
        count++
      }
    }
    
    return count
  }

  /**
   * Detect cross-program reentrancy
   */
  private detectCrossProgramReentrancy(logs: string[]): boolean {
    const programCalls = new Map<string, number>()
    
    for (const log of logs) {
      const programMatch = log.match(/Program (\w+) invoke/i)
      if (programMatch) {
        const programId = programMatch[1]
        programCalls.set(programId, (programCalls.get(programId) || 0) + 1)
      }
    }
    
    // Reentrancy detected if any program called more than once
    return Array.from(programCalls.values()).some(count => count > 1)
  }

  /**
   * Count cross-program calls
   */
  private countCrossProgramCalls(logs: string[]): number {
    const programPattern = /Program \w+ invoke/i
    return logs.filter(log => programPattern.test(log)).length
  }

  /**
   * Detect state changes from logs
   */
  private async detectStateChanges(
    program: Program,
    logs: string[]
  ): Promise<string[]> {
    const stateChanges: string[] = []
    const statePattern = /state change|updated|modified|written/i
    
    for (const log of logs) {
      if (statePattern.test(log)) {
        stateChanges.push(log)
      }
    }
    
    return stateChanges
  }

  /**
   * Run all reentrancy tests
   */
  async runAllTests(
    program: Program,
    otherPrograms?: Program[]
  ): Promise<ReentrancyAttackResult[]> {
    const results: ReentrancyAttackResult[] = []
    
    // Test simple reentrancy
    results.push(await this.testSimpleReentrancy(program))
    
    // Test callback reentrancy
    results.push(await this.testCallbackReentrancy(program))
    
    // Test cross-program reentrancy with other programs
    if (otherPrograms && otherPrograms.length > 0) {
      for (const otherProgram of otherPrograms) {
        if (otherProgram.programId.toBase58() !== program.programId.toBase58()) {
          results.push(await this.testCrossProgramReentrancy(program, otherProgram))
        }
      }
    }
    
    return results
  }
}

// Export factory function
export const createReentrancyAttackTester = (
  connection: Connection,
  environment: TestEnvironment
) => new ReentrancyAttackTester(connection, environment) 