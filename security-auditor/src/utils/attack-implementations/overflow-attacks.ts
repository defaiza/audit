import { Connection, PublicKey, Keypair, Transaction, TransactionInstruction } from '@solana/web3.js'
import { Program } from '@coral-xyz/anchor'
import * as anchor from '@coral-xyz/anchor'
import { TestEnvironment } from '../test-infrastructure'

export interface OverflowAttackResult {
  success: boolean
  type: 'overflow' | 'underflow'
  targetFunction: string
  program: string
  attemptedValue: bigint
  resultValue?: bigint
  error?: string
  logs?: string[]
  computeUnits?: number
}

export class OverflowAttackTester {
  private connection: Connection
  private environment: TestEnvironment

  constructor(connection: Connection, environment: TestEnvironment) {
    this.connection = connection
    this.environment = environment
  }

  /**
   * Test integer overflow with maximum values
   */
  async testMaxU64Overflow(program: Program): Promise<OverflowAttackResult> {
    console.log(`\n🔢 Testing MAX_U64 overflow on ${program.programId.toBase58()}...`)
    
    try {
      const maxU64 = new anchor.BN(2).pow(new anchor.BN(64)).sub(new anchor.BN(1))
      const overflowValue = maxU64.add(new anchor.BN(1))
      
      // Find a suitable instruction that takes numeric input
      const targetInstruction = this.findNumericInstruction(program)
      if (!targetInstruction) {
        return {
          success: false,
          type: 'overflow',
          targetFunction: 'unknown',
          program: program.programId.toBase58(),
          attemptedValue: BigInt(overflowValue.toString()),
          error: 'No suitable numeric instruction found'
        }
      }

      // Build transaction with overflow value
      const tx = await this.buildOverflowTransaction(
        program,
        targetInstruction,
        overflowValue,
        this.environment.attacker.keypair
      )

      // Simulate first
      const simulation = await this.connection.simulateTransaction(tx)
      
      if (simulation.value.err) {
        // Attack prevented!
        return {
          success: false,
          type: 'overflow',
          targetFunction: targetInstruction,
          program: program.programId.toBase58(),
          attemptedValue: BigInt(overflowValue.toString()),
          error: JSON.stringify(simulation.value.err),
          logs: simulation.value.logs || undefined,
          computeUnits: simulation.value.unitsConsumed
        }
      }

      // If simulation passes, try actual execution
      const signature = await this.connection.sendTransaction(tx, [this.environment.attacker.keypair])
      await this.connection.confirmTransaction(signature)

      // Check the result
      const txDetails = await this.connection.getTransaction(signature, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0
      })

      // Analyze logs for overflow behavior
      const overflowDetected = this.analyzeLogsForOverflow(txDetails?.meta?.logMessages || [])

      return {
        success: overflowDetected,
        type: 'overflow',
        targetFunction: targetInstruction,
        program: program.programId.toBase58(),
        attemptedValue: BigInt(overflowValue.toString()),
        logs: txDetails?.meta?.logMessages || undefined,
        computeUnits: txDetails?.meta?.computeUnitsConsumed
      }

    } catch (error: any) {
      return {
        success: false,
        type: 'overflow',
        targetFunction: 'unknown',
        program: program.programId.toBase58(),
        attemptedValue: BigInt(0),
        error: error.message
      }
    }
  }

  /**
   * Test integer underflow with zero/negative values
   */
  async testUnderflow(program: Program): Promise<OverflowAttackResult> {
    console.log(`\n➖ Testing underflow on ${program.programId.toBase58()}...`)
    
    try {
      // Try to cause underflow by subtracting from zero
      const targetInstruction = this.findSubtractionInstruction(program)
      if (!targetInstruction) {
        return {
          success: false,
          type: 'underflow',
          targetFunction: 'unknown',
          program: program.programId.toBase58(),
          attemptedValue: BigInt(-1),
          error: 'No suitable subtraction instruction found'
        }
      }

      // Build transaction that attempts underflow
      const tx = await this.buildUnderflowTransaction(
        program,
        targetInstruction,
        this.environment.attacker.keypair
      )

      // Simulate
      const simulation = await this.connection.simulateTransaction(tx)
      
      if (simulation.value.err) {
        // Good - underflow prevented
        return {
          success: false,
          type: 'underflow',
          targetFunction: targetInstruction,
          program: program.programId.toBase58(),
          attemptedValue: BigInt(-1),
          error: JSON.stringify(simulation.value.err),
          logs: simulation.value.logs || undefined,
          computeUnits: simulation.value.unitsConsumed
        }
      }

      // Execute if simulation passes
      const signature = await this.connection.sendTransaction(tx, [this.environment.attacker.keypair])
      await this.connection.confirmTransaction(signature)

      const txDetails = await this.connection.getTransaction(signature, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0
      })

      const underflowDetected = this.analyzeLogsForUnderflow(txDetails?.meta?.logMessages || [])

      return {
        success: underflowDetected,
        type: 'underflow',
        targetFunction: targetInstruction,
        program: program.programId.toBase58(),
        attemptedValue: BigInt(-1),
        logs: txDetails?.meta?.logMessages || undefined,
        computeUnits: txDetails?.meta?.computeUnitsConsumed
      }

    } catch (error: any) {
      return {
        success: false,
        type: 'underflow',
        targetFunction: 'unknown',
        program: program.programId.toBase58(),
        attemptedValue: BigInt(-1),
        error: error.message
      }
    }
  }

  /**
   * Test multiplication overflow
   */
  async testMultiplicationOverflow(program: Program): Promise<OverflowAttackResult> {
    console.log(`\n✖️ Testing multiplication overflow on ${program.programId.toBase58()}...`)
    
    try {
      // Large values that when multiplied will overflow
      const largeValue = new anchor.BN(2).pow(new anchor.BN(32))
      
      const targetInstruction = this.findMultiplicationInstruction(program)
      if (!targetInstruction) {
        return {
          success: false,
          type: 'overflow',
          targetFunction: 'unknown',
          program: program.programId.toBase58(),
          attemptedValue: BigInt(largeValue.toString()),
          error: 'No multiplication instruction found'
        }
      }

      const tx = await this.buildMultiplicationOverflowTransaction(
        program,
        targetInstruction,
        largeValue,
        this.environment.attacker.keypair
      )

      const simulation = await this.connection.simulateTransaction(tx)
      
      return {
        success: !simulation.value.err,
        type: 'overflow',
        targetFunction: targetInstruction,
        program: program.programId.toBase58(),
        attemptedValue: BigInt(largeValue.toString()),
        error: simulation.value.err ? JSON.stringify(simulation.value.err) : undefined,
        logs: simulation.value.logs || undefined,
        computeUnits: simulation.value.unitsConsumed
      }

    } catch (error: any) {
      return {
        success: false,
        type: 'overflow',
        targetFunction: 'unknown',
        program: program.programId.toBase58(),
        attemptedValue: BigInt(0),
        error: error.message
      }
    }
  }

  /**
   * Find instructions that accept numeric inputs
   */
  private findNumericInstruction(program: Program): string | null {
    const idl = program.idl
    
    // Look for instructions with u64/u128/i64/i128 parameters
    for (const instruction of idl.instructions) {
      for (const arg of instruction.args) {
        if (['u64', 'u128', 'i64', 'i128'].includes(arg.type as string)) {
          return instruction.name
        }
      }
    }
    
    return null
  }

  /**
   * Find instructions that perform subtraction
   */
  private findSubtractionInstruction(program: Program): string | null {
    const idl = program.idl
    
    // Look for instructions with names suggesting subtraction
    const subtractionKeywords = ['withdraw', 'unstake', 'burn', 'decrease', 'subtract', 'remove']
    
    for (const instruction of idl.instructions) {
      if (subtractionKeywords.some(keyword => instruction.name.toLowerCase().includes(keyword))) {
        return instruction.name
      }
    }
    
    return this.findNumericInstruction(program) // Fallback to any numeric instruction
  }

  /**
   * Find instructions that perform multiplication
   */
  private findMultiplicationInstruction(program: Program): string | null {
    const idl = program.idl
    
    // Look for instructions related to fees, rewards, or calculations
    const multiplicationKeywords = ['calculate', 'fee', 'reward', 'interest', 'compound']
    
    for (const instruction of idl.instructions) {
      if (multiplicationKeywords.some(keyword => instruction.name.toLowerCase().includes(keyword))) {
        return instruction.name
      }
    }
    
    return null
  }

  /**
   * Build a transaction with overflow attempt
   */
  private async buildOverflowTransaction(
    program: Program,
    instructionName: string,
    overflowValue: anchor.BN,
    signer: Keypair
  ): Promise<Transaction> {
    const tx = new Transaction()
    
    try {
      // This is program-specific and would need to be adapted
      // For now, create a generic instruction
      const instruction = await program.methods[instructionName]({
        amount: overflowValue
      })
      .accounts({
        user: signer.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId
      })
      .instruction()
      
      tx.add(instruction)
    } catch (error) {
      // Fallback to raw instruction
      const data = Buffer.alloc(9)
      data.writeUInt8(0, 0) // Instruction index
      data.writeBigUInt64LE(BigInt(overflowValue.toString()), 1)
      
      tx.add(new TransactionInstruction({
        keys: [{
          pubkey: signer.publicKey,
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
   * Build a transaction that attempts underflow
   */
  private async buildUnderflowTransaction(
    program: Program,
    instructionName: string,
    signer: Keypair
  ): Promise<Transaction> {
    const tx = new Transaction()
    
    try {
      // Attempt to subtract more than available
      const instruction = await program.methods[instructionName]({
        amount: new anchor.BN(1000000) // Large amount to cause underflow
      })
      .accounts({
        user: signer.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId
      })
      .instruction()
      
      tx.add(instruction)
    } catch (error) {
      // Fallback
      const data = Buffer.alloc(9)
      data.writeUInt8(1, 0) // Different instruction index
      data.writeBigUInt64LE(BigInt(1000000), 1)
      
      tx.add(new TransactionInstruction({
        keys: [{
          pubkey: signer.publicKey,
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
   * Build multiplication overflow transaction
   */
  private async buildMultiplicationOverflowTransaction(
    program: Program,
    instructionName: string,
    largeValue: anchor.BN,
    signer: Keypair
  ): Promise<Transaction> {
    const tx = new Transaction()
    
    try {
      const instruction = await program.methods[instructionName]({
        value1: largeValue,
        value2: largeValue
      })
      .accounts({
        user: signer.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId
      })
      .instruction()
      
      tx.add(instruction)
    } catch (error) {
      // Raw instruction fallback
      const data = Buffer.alloc(17)
      data.writeUInt8(2, 0)
      data.writeBigUInt64LE(BigInt(largeValue.toString()), 1)
      data.writeBigUInt64LE(BigInt(largeValue.toString()), 9)
      
      tx.add(new TransactionInstruction({
        keys: [{
          pubkey: signer.publicKey,
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
   * Analyze logs for overflow indicators
   */
  private analyzeLogsForOverflow(logs: string[]): boolean {
    const overflowIndicators = [
      'overflow',
      'arithmetic overflow',
      'integer overflow',
      'value too large',
      'exceeds maximum',
      'wrapped around',
      'unexpected value'
    ]
    
    for (const log of logs) {
      if (overflowIndicators.some(indicator => log.toLowerCase().includes(indicator))) {
        return true
      }
    }
    
    return false
  }

  /**
   * Analyze logs for underflow indicators
   */
  private analyzeLogsForUnderflow(logs: string[]): boolean {
    const underflowIndicators = [
      'underflow',
      'arithmetic underflow',
      'integer underflow',
      'insufficient',
      'negative value',
      'below zero',
      'wrapped to max'
    ]
    
    for (const log of logs) {
      if (underflowIndicators.some(indicator => log.toLowerCase().includes(indicator))) {
        return true
      }
    }
    
    return false
  }

  /**
   * Run all overflow tests on a program
   */
  async runAllTests(program: Program): Promise<OverflowAttackResult[]> {
    const results: OverflowAttackResult[] = []
    
    results.push(await this.testMaxU64Overflow(program))
    results.push(await this.testUnderflow(program))
    results.push(await this.testMultiplicationOverflow(program))
    
    return results
  }
}

// Export factory function
export const createOverflowAttackTester = (
  connection: Connection,
  environment: TestEnvironment
) => new OverflowAttackTester(connection, environment) 