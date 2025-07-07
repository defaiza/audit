import { Connection, PublicKey, Keypair, Transaction, TransactionInstruction } from '@solana/web3.js'
import { Program } from '@coral-xyz/anchor'
import * as anchor from '@coral-xyz/anchor'
import { TestEnvironment } from '../test-infrastructure'

export interface InputValidationAttackResult {
  success: boolean
  type: 'zero-amount' | 'negative-value' | 'invalid-params' | 'boundary-test'
  targetFunction: string
  program: string
  inputValue: string | number | bigint
  expectedRange?: string
  error?: string
  logs?: string[]
  computeUnits?: number
}

export class InputValidationAttackTester {
  private connection: Connection
  private environment: TestEnvironment

  constructor(connection: Connection, environment: TestEnvironment) {
    this.connection = connection
    this.environment = environment
  }

  /**
   * Test zero amount attacks
   */
  async testZeroAmountAttack(program: Program): Promise<InputValidationAttackResult> {
    console.log(`\n0️⃣ Testing zero amount attack on ${program.programId.toBase58()}...`)
    
    try {
      // Find functions that accept amounts
      const amountFunction = this.findAmountFunction(program)
      if (!amountFunction) {
        return {
          success: false,
          type: 'zero-amount',
          targetFunction: 'unknown',
          program: program.programId.toBase58(),
          inputValue: 0,
          error: 'No amount-based function found'
        }
      }

      // Build transaction with zero amount
      const tx = await this.buildZeroAmountTx(
        program,
        amountFunction,
        this.environment.attacker.keypair
      )

      const simulation = await this.connection.simulateTransaction(tx)
      
      // Check if zero amount was rejected
      const zeroRejected = this.isZeroAmountRejected(
        simulation.value.err,
        simulation.value.logs || []
      )
      
      return {
        success: !zeroRejected && !simulation.value.err,
        type: 'zero-amount',
        targetFunction: amountFunction,
        program: program.programId.toBase58(),
        inputValue: 0,
        expectedRange: '> 0',
        error: simulation.value.err ? JSON.stringify(simulation.value.err) : undefined,
        logs: simulation.value.logs || undefined,
        computeUnits: simulation.value.unitsConsumed
      }

    } catch (error: any) {
      return {
        success: false,
        type: 'zero-amount',
        targetFunction: 'unknown',
        program: program.programId.toBase58(),
        inputValue: 0,
        error: error.message
      }
    }
  }

  /**
   * Test negative value attacks
   */
  async testNegativeValueAttack(program: Program): Promise<InputValidationAttackResult> {
    console.log(`\n➖ Testing negative value attack on ${program.programId.toBase58()}...`)
    
    try {
      const targetFunction = this.findSignedIntFunction(program)
      if (!targetFunction) {
        return {
          success: false,
          type: 'negative-value',
          targetFunction: 'unknown',
          program: program.programId.toBase58(),
          inputValue: -1,
          error: 'No signed integer function found'
        }
      }

      // Try negative values
      const negativeValue = new anchor.BN(-1000)
      const tx = await this.buildNegativeValueTx(
        program,
        targetFunction,
        negativeValue,
        this.environment.attacker.keypair
      )

      const simulation = await this.connection.simulateTransaction(tx)
      
      return {
        success: !simulation.value.err,
        type: 'negative-value',
        targetFunction: targetFunction,
        program: program.programId.toBase58(),
        inputValue: BigInt(negativeValue.toString()),
        expectedRange: '>= 0',
        error: simulation.value.err ? JSON.stringify(simulation.value.err) : undefined,
        logs: simulation.value.logs || undefined,
        computeUnits: simulation.value.unitsConsumed
      }

    } catch (error: any) {
      return {
        success: false,
        type: 'negative-value',
        targetFunction: 'unknown',
        program: program.programId.toBase58(),
        inputValue: -1,
        error: error.message
      }
    }
  }

  /**
   * Test invalid parameter combinations
   */
  async testInvalidParams(program: Program): Promise<InputValidationAttackResult> {
    console.log(`\n❌ Testing invalid parameters on ${program.programId.toBase58()}...`)
    
    try {
      // Find complex functions with multiple parameters
      const complexFunction = this.findComplexFunction(program)
      if (!complexFunction) {
        return {
          success: false,
          type: 'invalid-params',
          targetFunction: 'unknown',
          program: program.programId.toBase58(),
          inputValue: 'invalid',
          error: 'No complex function found'
        }
      }

      // Test various invalid combinations
      const invalidCombos = await this.testInvalidCombinations(
        program,
        complexFunction,
        this.environment.attacker.keypair
      )

      const successfulAttack = invalidCombos.find(combo => combo.success)
      
      if (successfulAttack) {
        return {
          success: true,
          type: 'invalid-params',
          targetFunction: complexFunction,
          program: program.programId.toBase58(),
          inputValue: successfulAttack.params,
          logs: successfulAttack.logs,
          computeUnits: successfulAttack.computeUnits
        }
      }

      return {
        success: false,
        type: 'invalid-params',
        targetFunction: complexFunction,
        program: program.programId.toBase58(),
        inputValue: 'various invalid combinations',
        error: 'All invalid parameter combinations were rejected'
      }

    } catch (error: any) {
      return {
        success: false,
        type: 'invalid-params',
        targetFunction: 'unknown',
        program: program.programId.toBase58(),
        inputValue: 'invalid',
        error: error.message
      }
    }
  }

  /**
   * Test boundary conditions
   */
  async testBoundaryConditions(program: Program): Promise<InputValidationAttackResult> {
    console.log(`\n🔲 Testing boundary conditions on ${program.programId.toBase58()}...`)
    
    try {
      const numericFunction = this.findNumericFunction(program)
      if (!numericFunction) {
        return {
          success: false,
          type: 'boundary-test',
          targetFunction: 'unknown',
          program: program.programId.toBase58(),
          inputValue: 'boundary',
          error: 'No numeric function found'
        }
      }

      // Test various boundaries
      const boundaryTests = [
        { value: new anchor.BN(1), name: 'minimum' },
        { value: new anchor.BN(2).pow(new anchor.BN(32)).sub(new anchor.BN(1)), name: 'u32_max' },
        { value: new anchor.BN(2).pow(new anchor.BN(64)).sub(new anchor.BN(1)), name: 'u64_max' },
        { value: new anchor.BN(999999999), name: 'large_decimal' }
      ]

      for (const test of boundaryTests) {
        const tx = await this.buildBoundaryTestTx(
          program,
          numericFunction,
          test.value,
          this.environment.attacker.keypair
        )

        const simulation = await this.connection.simulateTransaction(tx)
        
        if (!simulation.value.err) {
          // Check if boundary caused unexpected behavior
          const unexpectedBehavior = this.detectUnexpectedBehavior(
            simulation.value.logs || [],
            test.value
          )
          
          if (unexpectedBehavior) {
            return {
              success: true,
              type: 'boundary-test',
              targetFunction: numericFunction,
              program: program.programId.toBase58(),
              inputValue: `${test.name}: ${test.value.toString()}`,
              logs: simulation.value.logs || undefined,
              computeUnits: simulation.value.unitsConsumed
            }
          }
        }
      }

      return {
        success: false,
        type: 'boundary-test',
        targetFunction: numericFunction,
        program: program.programId.toBase58(),
        inputValue: 'various boundaries',
        error: 'All boundary tests handled correctly'
      }

    } catch (error: any) {
      return {
        success: false,
        type: 'boundary-test',
        targetFunction: 'unknown',
        program: program.programId.toBase58(),
        inputValue: 'boundary',
        error: error.message
      }
    }
  }

  /**
   * Find functions that accept amounts
   */
  private findAmountFunction(program: Program): string | null {
    const amountKeywords = ['transfer', 'deposit', 'withdraw', 'stake', 'swap', 'mint', 'burn']
    
    for (const instruction of program.idl.instructions) {
      if (amountKeywords.some(keyword => 
        instruction.name.toLowerCase().includes(keyword)
      )) {
        // Check if it has amount parameter
        const hasAmount = instruction.args.some(arg =>
          arg.name.toLowerCase().includes('amount') ||
          arg.name.toLowerCase().includes('value')
        )
        if (hasAmount) return instruction.name
      }
    }
    
    return null
  }

  /**
   * Find functions with signed integers
   */
  private findSignedIntFunction(program: Program): string | null {
    for (const instruction of program.idl.instructions) {
      const hasSignedInt = instruction.args.some(arg =>
        ['i8', 'i16', 'i32', 'i64', 'i128'].includes(arg.type as string)
      )
      if (hasSignedInt) return instruction.name
    }
    return null
  }

  /**
   * Find complex functions
   */
  private findComplexFunction(program: Program): string | null {
    // Look for functions with 3+ parameters
    for (const instruction of program.idl.instructions) {
      if (instruction.args.length >= 3) {
        return instruction.name
      }
    }
    return null
  }

  /**
   * Find numeric functions
   */
  private findNumericFunction(program: Program): string | null {
    for (const instruction of program.idl.instructions) {
      const hasNumeric = instruction.args.some(arg =>
        ['u8', 'u16', 'u32', 'u64', 'u128', 'i8', 'i16', 'i32', 'i64', 'i128'].includes(arg.type as string)
      )
      if (hasNumeric) return instruction.name
    }
    return null
  }

  /**
   * Build zero amount transaction
   */
  private async buildZeroAmountTx(
    program: Program,
    functionName: string,
    signer: Keypair
  ): Promise<Transaction> {
    const tx = new Transaction()
    
    try {
      const instruction = await program.methods[functionName]({
        amount: new anchor.BN(0)
      })
      .accounts({
        user: signer.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId
      })
      .instruction()
      
      tx.add(instruction)
    } catch (error) {
      // Raw instruction fallback
      const data = Buffer.alloc(9)
      data.writeUInt8(0, 0)
      data.writeBigUInt64LE(BigInt(0), 1) // Zero amount
      
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
   * Build negative value transaction
   */
  private async buildNegativeValueTx(
    program: Program,
    functionName: string,
    negativeValue: anchor.BN,
    signer: Keypair
  ): Promise<Transaction> {
    const tx = new Transaction()
    
    try {
      const instruction = await program.methods[functionName]({
        value: negativeValue
      })
      .accounts({
        user: signer.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId
      })
      .instruction()
      
      tx.add(instruction)
    } catch (error) {
      // Raw instruction with negative value
      const data = Buffer.alloc(9)
      data.writeUInt8(1, 0)
      data.writeBigInt64LE(BigInt(negativeValue.toString()), 1)
      
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
   * Test invalid parameter combinations
   */
  private async testInvalidCombinations(
    program: Program,
    functionName: string,
    signer: Keypair
  ): Promise<Array<{success: boolean, params: string, logs?: string[], computeUnits?: number}>> {
    const results = []
    
    // Test 1: Mismatched accounts
    try {
      const tx1 = await program.methods[functionName]({
        source: signer.publicKey,
        destination: signer.publicKey // Same as source!
      })
      .accounts({
        user: signer.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId
      })
      .transaction()
      
      const sim1 = await this.connection.simulateTransaction(tx1)
      results.push({
        success: !sim1.value.err,
        params: 'source == destination',
        logs: sim1.value.logs || undefined,
        computeUnits: sim1.value.unitsConsumed
      })
    } catch (error) {
      results.push({ success: false, params: 'mismatched accounts' })
    }
    
    // Test 2: Invalid enum values
    try {
      const tx2 = new Transaction()
      const data = Buffer.alloc(2)
      data.writeUInt8(99, 0) // Invalid instruction
      data.writeUInt8(255, 1) // Invalid enum
      
      tx2.add(new TransactionInstruction({
        keys: [{
          pubkey: signer.publicKey,
          isSigner: true,
          isWritable: true
        }],
        programId: program.programId,
        data
      }))
      
      const sim2 = await this.connection.simulateTransaction(tx2)
      results.push({
        success: !sim2.value.err,
        params: 'invalid enum value',
        logs: sim2.value.logs || undefined,
        computeUnits: sim2.value.unitsConsumed
      })
    } catch (error) {
      results.push({ success: false, params: 'invalid enum' })
    }
    
    return results
  }

  /**
   * Build boundary test transaction
   */
  private async buildBoundaryTestTx(
    program: Program,
    functionName: string,
    value: anchor.BN,
    signer: Keypair
  ): Promise<Transaction> {
    const tx = new Transaction()
    
    try {
      const instruction = await program.methods[functionName]({
        value: value
      })
      .accounts({
        user: signer.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId
      })
      .instruction()
      
      tx.add(instruction)
    } catch (error) {
      // Raw boundary value
      const data = Buffer.alloc(9)
      data.writeUInt8(2, 0)
      
      // Handle different sizes
      if (value.lte(new anchor.BN(2).pow(new anchor.BN(64)).sub(new anchor.BN(1)))) {
        data.writeBigUInt64LE(BigInt(value.toString()), 1)
      } else {
        // Truncate for testing
        data.writeBigUInt64LE(BigInt('18446744073709551615'), 1) // MAX_U64
      }
      
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
   * Check if zero amount was rejected
   */
  private isZeroAmountRejected(error: any, logs: string[]): boolean {
    if (!error) return false
    
    const zeroIndicators = [
      'zero amount',
      'amount must be greater than 0',
      'invalid amount',
      'minimum amount'
    ]
    
    const errorStr = JSON.stringify(error).toLowerCase()
    const hasErrorIndicator = zeroIndicators.some(indicator => 
      errorStr.includes(indicator)
    )
    
    const hasLogIndicator = logs.some(log =>
      zeroIndicators.some(indicator => 
        log.toLowerCase().includes(indicator)
      )
    )
    
    return hasErrorIndicator || hasLogIndicator
  }

  /**
   * Detect unexpected behavior from boundary values
   */
  private detectUnexpectedBehavior(logs: string[], value: anchor.BN): boolean {
    const unexpectedIndicators = [
      'overflow',
      'underflow',
      'panic',
      'unexpected',
      'invalid state'
    ]
    
    return logs.some(log =>
      unexpectedIndicators.some(indicator => 
        log.toLowerCase().includes(indicator)
      )
    )
  }

  /**
   * Run all input validation tests
   */
  async runAllTests(program: Program): Promise<InputValidationAttackResult[]> {
    const results: InputValidationAttackResult[] = []
    
    results.push(await this.testZeroAmountAttack(program))
    results.push(await this.testNegativeValueAttack(program))
    results.push(await this.testInvalidParams(program))
    results.push(await this.testBoundaryConditions(program))
    
    return results
  }
}

// Export factory function
export const createInputValidationAttackTester = (
  connection: Connection,
  environment: TestEnvironment
) => new InputValidationAttackTester(connection, environment) 