import { Connection, PublicKey, Keypair, Transaction, TransactionInstruction, ComputeBudgetProgram } from '@solana/web3.js'
import { Program } from '@coral-xyz/anchor'
import * as anchor from '@coral-xyz/anchor'
import { TestEnvironment } from '../test-infrastructure'

export interface DOSAttackResult {
  success: boolean
  type: 'resource-exhaustion' | 'state-bloat' | 'transaction-spam' | 'compute-exhaustion'
  targetFunction: string
  program: string
  resourcesConsumed: {
    computeUnits?: number
    accountsCreated?: number
    transactionsSent?: number
    dataSize?: number
  }
  performanceImpact?: string
  error?: string
  logs?: string[]
}

export class DOSAttackTester {
  private connection: Connection
  private environment: TestEnvironment

  constructor(connection: Connection, environment: TestEnvironment) {
    this.connection = connection
    this.environment = environment
  }

  /**
   * Test resource exhaustion attacks
   */
  async testResourceExhaustion(program: Program): Promise<DOSAttackResult> {
    console.log(`\n⚡ Testing resource exhaustion on ${program.programId.toBase58()}...`)
    
    try {
      // Find compute-intensive function
      const intensiveFunction = this.findComputeIntensiveFunction(program)
      if (!intensiveFunction) {
        return {
          success: false,
          type: 'resource-exhaustion',
          targetFunction: 'unknown',
          program: program.programId.toBase58(),
          resourcesConsumed: {},
          error: 'No compute-intensive function found'
        }
      }

      // Build transaction with maximum compute budget
      const tx = await this.buildMaxComputeTx(
        program,
        intensiveFunction,
        this.environment.attacker.keypair
      )

      // Measure performance before
      const startTime = Date.now()
      const simulation = await this.connection.simulateTransaction(tx)
      const endTime = Date.now()
      
      const executionTime = endTime - startTime
      const computeUnits = simulation.value.unitsConsumed || 0
      
      // Check if we can exhaust resources
      const isExhaustive = computeUnits > 200000 || executionTime > 1000
      
      return {
        success: isExhaustive,
        type: 'resource-exhaustion',
        targetFunction: intensiveFunction,
        program: program.programId.toBase58(),
        resourcesConsumed: {
          computeUnits,
          dataSize: tx.serialize().length
        },
        performanceImpact: `${executionTime}ms execution, ${computeUnits} compute units`,
        error: simulation.value.err ? JSON.stringify(simulation.value.err) : undefined,
        logs: simulation.value.logs || undefined
      }

    } catch (error: any) {
      return {
        success: false,
        type: 'resource-exhaustion',
        targetFunction: 'unknown',
        program: program.programId.toBase58(),
        resourcesConsumed: {},
        error: error.message
      }
    }
  }

  /**
   * Test state bloat attacks
   */
  async testStateBloat(program: Program): Promise<DOSAttackResult> {
    console.log(`\n💾 Testing state bloat attack on ${program.programId.toBase58()}...`)
    
    try {
      // Find account creation functions
      const createFunction = this.findAccountCreationFunction(program)
      if (!createFunction) {
        return {
          success: false,
          type: 'state-bloat',
          targetFunction: 'unknown',
          program: program.programId.toBase58(),
          resourcesConsumed: {},
          error: 'No account creation function found'
        }
      }

      // Try to create many accounts
      const accountsToCreate = 10
      let accountsCreated = 0
      let totalSize = 0
      
      for (let i = 0; i < accountsToCreate; i++) {
        try {
          const tx = await this.buildAccountCreationTx(
            program,
            createFunction,
            this.environment.attacker.keypair,
            i
          )
          
          const simulation = await this.connection.simulateTransaction(tx)
          
          if (!simulation.value.err) {
            accountsCreated++
            // Estimate account size (varies by program)
            totalSize += this.estimateAccountSize(program, createFunction)
          }
          
          // Avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 100))
        } catch (error) {
          // Continue on error
        }
      }
      
      // Check if we could bloat state
      const bloatSuccessful = accountsCreated > 5 || totalSize > 10000
      
      return {
        success: bloatSuccessful,
        type: 'state-bloat',
        targetFunction: createFunction,
        program: program.programId.toBase58(),
        resourcesConsumed: {
          accountsCreated,
          dataSize: totalSize
        },
        performanceImpact: `Created ${accountsCreated} accounts, ${totalSize} bytes`
      }

    } catch (error: any) {
      return {
        success: false,
        type: 'state-bloat',
        targetFunction: 'unknown',
        program: program.programId.toBase58(),
        resourcesConsumed: {},
        error: error.message
      }
    }
  }

  /**
   * Test transaction spam attacks
   */
  async testTransactionSpam(program: Program): Promise<DOSAttackResult> {
    console.log(`\n📨 Testing transaction spam on ${program.programId.toBase58()}...`)
    
    try {
      // Find cheapest function to spam
      const spamFunction = this.findCheapestFunction(program)
      if (!spamFunction) {
        return {
          success: false,
          type: 'transaction-spam',
          targetFunction: 'unknown',
          program: program.programId.toBase58(),
          resourcesConsumed: {},
          error: 'No suitable function for spam found'
        }
      }

      // Create spam transactions
      const spamCount = 50
      const transactions: Transaction[] = []
      
      for (let i = 0; i < spamCount; i++) {
        const tx = await this.buildSpamTx(
          program,
          spamFunction,
          this.environment.attacker.keypair,
          i
        )
        transactions.push(tx)
      }

      // Send spam burst
      const startTime = Date.now()
      let successCount = 0
      
      // Send in batches to avoid rate limits
      const batchSize = 5
      for (let i = 0; i < transactions.length; i += batchSize) {
        const batch = transactions.slice(i, i + batchSize)
        const promises = batch.map(tx => this.sendSpamTx(tx, this.environment.attacker.keypair))
        
        const results = await Promise.all(promises)
        successCount += results.filter(r => r).length
        
        // Small delay between batches
        if (i + batchSize < transactions.length) {
          await new Promise(resolve => setTimeout(resolve, 50))
        }
      }
      
      const endTime = Date.now()
      const totalTime = endTime - startTime
      const tps = (successCount / totalTime) * 1000
      
      return {
        success: successCount > 20 && tps > 10,
        type: 'transaction-spam',
        targetFunction: spamFunction,
        program: program.programId.toBase58(),
        resourcesConsumed: {
          transactionsSent: successCount
        },
        performanceImpact: `${successCount} txs in ${totalTime}ms (${tps.toFixed(2)} TPS)`
      }

    } catch (error: any) {
      return {
        success: false,
        type: 'transaction-spam',
        targetFunction: 'unknown',
        program: program.programId.toBase58(),
        resourcesConsumed: {},
        error: error.message
      }
    }
  }

  /**
   * Test compute unit exhaustion
   */
  async testComputeExhaustion(program: Program): Promise<DOSAttackResult> {
    console.log(`\n🔥 Testing compute exhaustion on ${program.programId.toBase58()}...`)
    
    try {
      // Find loops or recursive functions
      const loopFunction = this.findLoopFunction(program)
      if (!loopFunction) {
        return {
          success: false,
          type: 'compute-exhaustion',
          targetFunction: 'unknown',
          program: program.programId.toBase58(),
          resourcesConsumed: {},
          error: 'No loop/recursive function found'
        }
      }

      // Build transaction with large iteration count
      const tx = await this.buildComputeExhaustionTx(
        program,
        loopFunction,
        this.environment.attacker.keypair
      )

      // Add maximum compute budget
      tx.add(
        ComputeBudgetProgram.setComputeUnitLimit({
          units: 1400000 // Maximum allowed
        })
      )

      const simulation = await this.connection.simulateTransaction(tx)
      
      const exhausted = simulation.value.err?.toString().includes('exceeded') ||
                       (simulation.value.unitsConsumed || 0) > 1000000
      
      return {
        success: exhausted,
        type: 'compute-exhaustion',
        targetFunction: loopFunction,
        program: program.programId.toBase58(),
        resourcesConsumed: {
          computeUnits: simulation.value.unitsConsumed || 0
        },
        error: simulation.value.err ? JSON.stringify(simulation.value.err) : undefined,
        logs: simulation.value.logs || undefined
      }

    } catch (error: any) {
      return {
        success: false,
        type: 'compute-exhaustion',
        targetFunction: 'unknown',
        program: program.programId.toBase58(),
        resourcesConsumed: {},
        error: error.message
      }
    }
  }

  /**
   * Find compute-intensive functions
   */
  private findComputeIntensiveFunction(program: Program): string | null {
    const intensiveKeywords = ['calculate', 'compute', 'process', 'verify', 'validate', 'hash']
    
    for (const instruction of program.idl.instructions) {
      if (intensiveKeywords.some(keyword => 
        instruction.name.toLowerCase().includes(keyword)
      )) {
        return instruction.name
      }
      
      // Also look for functions with array parameters
      const hasArray = instruction.args.some(arg =>
        arg.type.toString().includes('vec') || arg.type.toString().includes('[]')
      )
      if (hasArray) return instruction.name
    }
    
    return null
  }

  /**
   * Find account creation functions
   */
  private findAccountCreationFunction(program: Program): string | null {
    const createKeywords = ['create', 'initialize', 'new', 'mint', 'register']
    
    for (const instruction of program.idl.instructions) {
      if (createKeywords.some(keyword => 
        instruction.name.toLowerCase().includes(keyword)
      )) {
        return instruction.name
      }
    }
    
    return null
  }

  /**
   * Find cheapest function for spam
   */
  private findCheapestFunction(program: Program): string | null {
    // Look for simple read operations or minimal state changes
    const cheapKeywords = ['get', 'read', 'view', 'check', 'ping']
    
    for (const instruction of program.idl.instructions) {
      if (cheapKeywords.some(keyword => 
        instruction.name.toLowerCase().includes(keyword)
      )) {
        return instruction.name
      }
    }
    
    // Fallback to any function
    return program.idl.instructions[0]?.name || null
  }

  /**
   * Find functions with loops
   */
  private findLoopFunction(program: Program): string | null {
    const loopKeywords = ['loop', 'iterate', 'batch', 'bulk', 'multiple']
    
    for (const instruction of program.idl.instructions) {
      if (loopKeywords.some(keyword => 
        instruction.name.toLowerCase().includes(keyword)
      )) {
        return instruction.name
      }
      
      // Look for array processing
      const hasArrayParam = instruction.args.some(arg =>
        arg.type.toString().includes('vec')
      )
      if (hasArrayParam) return instruction.name
    }
    
    return null
  }

  /**
   * Build max compute transaction
   */
  private async buildMaxComputeTx(
    program: Program,
    functionName: string,
    signer: Keypair
  ): Promise<Transaction> {
    const tx = new Transaction()
    
    try {
      // Create large input data
      const largeArray = new Array(100).fill(0).map((_, i) => new anchor.BN(i))
      
      const instruction = await program.methods[functionName]({
        data: largeArray
      })
      .accounts({
        user: signer.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId
      })
      .instruction()
      
      tx.add(instruction)
    } catch (error) {
      // Raw compute-heavy instruction
      const data = Buffer.alloc(1000) // Large data
      for (let i = 0; i < data.length; i++) {
        data[i] = i % 256
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
   * Build account creation transaction
   */
  private async buildAccountCreationTx(
    program: Program,
    functionName: string,
    signer: Keypair,
    index: number
  ): Promise<Transaction> {
    const tx = new Transaction()
    
    try {
      // Create unique seed for each account
      const seed = `dos_test_${index}_${Date.now()}`
      
      const instruction = await program.methods[functionName]({
        seed: seed,
        data: Buffer.alloc(1000) // Try to create large account
      })
      .accounts({
        user: signer.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId
      })
      .instruction()
      
      tx.add(instruction)
    } catch (error) {
      // Raw account creation
      const data = Buffer.alloc(33)
      data.writeUInt8(0x00, 0) // Create instruction
      data.write(Keypair.generate().publicKey.toBuffer().toString('hex'), 1, 'hex')
      
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
   * Build spam transaction
   */
  private async buildSpamTx(
    program: Program,
    functionName: string,
    signer: Keypair,
    nonce: number
  ): Promise<Transaction> {
    const tx = new Transaction()
    
    try {
      const instruction = await program.methods[functionName]({
        nonce: new anchor.BN(nonce)
      })
      .accounts({
        user: signer.publicKey
      })
      .instruction()
      
      tx.add(instruction)
    } catch (error) {
      // Minimal instruction
      const data = Buffer.alloc(5)
      data.writeUInt8(0xFF, 0) // Noop or ping
      data.writeUInt32LE(nonce, 1)
      
      tx.add(new TransactionInstruction({
        keys: [{
          pubkey: signer.publicKey,
          isSigner: true,
          isWritable: false
        }],
        programId: program.programId,
        data
      }))
    }
    
    return tx
  }

  /**
   * Build compute exhaustion transaction
   */
  private async buildComputeExhaustionTx(
    program: Program,
    functionName: string,
    signer: Keypair
  ): Promise<Transaction> {
    const tx = new Transaction()
    
    try {
      // Large iteration count
      const instruction = await program.methods[functionName]({
        iterations: new anchor.BN(1000000),
        data: new Array(1000).fill(0)
      })
      .accounts({
        user: signer.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId
      })
      .instruction()
      
      tx.add(instruction)
    } catch (error) {
      // Raw loop instruction
      const data = Buffer.alloc(9)
      data.writeUInt8(0x10, 0) // Loop instruction
      data.writeBigUInt64LE(BigInt(1000000), 1) // Large iteration count
      
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
   * Send spam transaction
   */
  private async sendSpamTx(tx: Transaction, signer: Keypair): Promise<boolean> {
    try {
      const { blockhash } = await this.connection.getLatestBlockhash()
      tx.recentBlockhash = blockhash
      tx.feePayer = signer.publicKey
      tx.sign(signer)
      
      await this.connection.sendRawTransaction(
        tx.serialize(),
        { skipPreflight: true }
      )
      
      return true
    } catch (error) {
      return false
    }
  }

  /**
   * Estimate account size
   */
  private estimateAccountSize(program: Program, functionName: string): number {
    // Estimate based on function name and program type
    if (functionName.includes('create')) return 1000
    if (functionName.includes('initialize')) return 500
    if (functionName.includes('register')) return 200
    return 100
  }

  /**
   * Run all DOS tests
   */
  async runAllTests(program: Program): Promise<DOSAttackResult[]> {
    const results: DOSAttackResult[] = []
    
    results.push(await this.testResourceExhaustion(program))
    results.push(await this.testStateBloat(program))
    results.push(await this.testTransactionSpam(program))
    results.push(await this.testComputeExhaustion(program))
    
    return results
  }
}

// Export factory function
export const createDOSAttackTester = (
  connection: Connection,
  environment: TestEnvironment
) => new DOSAttackTester(connection, environment) 