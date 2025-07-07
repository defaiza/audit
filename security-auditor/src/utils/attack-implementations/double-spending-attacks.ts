import { Connection, PublicKey, Keypair, Transaction, TransactionInstruction, sendAndConfirmRawTransaction } from '@solana/web3.js'
import { Program } from '@coral-xyz/anchor'
import * as anchor from '@coral-xyz/anchor'
import { TestEnvironment } from '../test-infrastructure'

export interface DoubleSpendingAttackResult {
  success: boolean
  type: 'concurrent-spend' | 'race-condition' | 'replay-attack' | 'nonce-manipulation'
  targetFunction: string
  program: string
  attemptedSpends: number
  successfulSpends: number
  totalAmountSpent?: bigint
  error?: string
  logs?: string[]
  signatures?: string[]
}

export class DoubleSpendingAttackTester {
  private connection: Connection
  private environment: TestEnvironment

  constructor(connection: Connection, environment: TestEnvironment) {
    this.connection = connection
    this.environment = environment
  }

  /**
   * Test concurrent spending of same funds
   */
  async testConcurrentSpend(program: Program): Promise<DoubleSpendingAttackResult> {
    console.log(`\n💰💰 Testing concurrent double spend on ${program.programId.toBase58()}...`)
    
    try {
      // Find transfer/spend function
      const spendFunction = this.findSpendFunction(program)
      if (!spendFunction) {
        return {
          success: false,
          type: 'concurrent-spend',
          targetFunction: 'unknown',
          program: program.programId.toBase58(),
          attemptedSpends: 0,
          successfulSpends: 0,
          error: 'No spend function found'
        }
      }

      // Get initial balance
      const initialBalance = await this.getTokenBalance(this.environment.attacker.tokenAccount!)
      
      // Create multiple identical spend transactions
      const spendAmount = new anchor.BN(1000000) // 1 token
      const transactions: Transaction[] = []
      
      for (let i = 0; i < 5; i++) {
        const tx = await this.buildSpendTransaction(
          program,
          spendFunction,
          spendAmount,
          this.environment.attacker.keypair,
          this.environment.victim.publicKey
        )
        transactions.push(tx)
      }

      // Send all transactions concurrently
      const results = await this.sendConcurrentTransactions(transactions, this.environment.attacker.keypair)
      
      // Get final balance
      const finalBalance = await this.getTokenBalance(this.environment.attacker.tokenAccount!)
      const totalSpent = initialBalance - finalBalance
      
      const successfulSpends = results.filter(r => r.success).length
      
      return {
        success: successfulSpends > 1 && totalSpent > Number(spendAmount.toString()),
        type: 'concurrent-spend',
        targetFunction: spendFunction,
        program: program.programId.toBase58(),
        attemptedSpends: transactions.length,
        successfulSpends,
        totalAmountSpent: BigInt(totalSpent),
        signatures: results.filter(r => r.success).map(r => r.signature!)
      }

    } catch (error: any) {
      return {
        success: false,
        type: 'concurrent-spend',
        targetFunction: 'unknown',
        program: program.programId.toBase58(),
        attemptedSpends: 0,
        successfulSpends: 0,
        error: error.message
      }
    }
  }

  /**
   * Test race condition exploits
   */
  async testRaceCondition(program: Program): Promise<DoubleSpendingAttackResult> {
    console.log(`\n🏁 Testing race condition exploit on ${program.programId.toBase58()}...`)
    
    try {
      const withdrawFunction = this.findWithdrawFunction(program)
      if (!withdrawFunction) {
        return {
          success: false,
          type: 'race-condition',
          targetFunction: 'unknown',
          program: program.programId.toBase58(),
          attemptedSpends: 0,
          successfulSpends: 0,
          error: 'No withdraw function found'
        }
      }

      // Create a shared resource/account
      const sharedAccount = await this.createSharedAccount(program)
      
      // Create competing transactions
      const tx1 = await this.buildWithdrawTransaction(
        program,
        withdrawFunction,
        sharedAccount,
        this.environment.attacker.keypair
      )
      
      const tx2 = await this.buildWithdrawTransaction(
        program,
        withdrawFunction,
        sharedAccount,
        this.environment.attacker.keypair
      )

      // Send with minimal delay to trigger race
      const promise1 = this.sendTransactionAsync(tx1, this.environment.attacker.keypair)
      const promise2 = this.sendTransactionAsync(tx2, this.environment.attacker.keypair)
      
      const [result1, result2] = await Promise.all([promise1, promise2])
      
      const successCount = [result1, result2].filter(r => r.success).length
      
      return {
        success: successCount > 1,
        type: 'race-condition',
        targetFunction: withdrawFunction,
        program: program.programId.toBase58(),
        attemptedSpends: 2,
        successfulSpends: successCount,
        logs: [...(result1.logs || []), ...(result2.logs || [])]
      }

    } catch (error: any) {
      return {
        success: false,
        type: 'race-condition',
        targetFunction: 'unknown',
        program: program.programId.toBase58(),
        attemptedSpends: 0,
        successfulSpends: 0,
        error: error.message
      }
    }
  }

  /**
   * Test replay attack vulnerability
   */
  async testReplayAttack(program: Program): Promise<DoubleSpendingAttackResult> {
    console.log(`\n🔁 Testing replay attack on ${program.programId.toBase58()}...`)
    
    try {
      const targetFunction = this.findReplayableFunction(program)
      if (!targetFunction) {
        return {
          success: false,
          type: 'replay-attack',
          targetFunction: 'unknown',
          program: program.programId.toBase58(),
          attemptedSpends: 0,
          successfulSpends: 0,
          error: 'No replayable function found'
        }
      }

      // Create and execute initial transaction
      const originalTx = await this.buildReplayableTransaction(
        program,
        targetFunction,
        this.environment.attacker.keypair
      )

      const originalResult = await this.sendTransactionAsync(originalTx, this.environment.attacker.keypair)
      
      if (!originalResult.success) {
        return {
          success: false,
          type: 'replay-attack',
          targetFunction: targetFunction,
          program: program.programId.toBase58(),
          attemptedSpends: 1,
          successfulSpends: 0,
          error: 'Original transaction failed'
        }
      }

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 1000))

      // Try to replay the transaction
      const replayTx = await this.modifyTransactionForReplay(originalTx)
      const replayResult = await this.sendTransactionAsync(replayTx, this.environment.attacker.keypair)
      
      return {
        success: replayResult.success,
        type: 'replay-attack',
        targetFunction: targetFunction,
        program: program.programId.toBase58(),
        attemptedSpends: 2,
        successfulSpends: originalResult.success && replayResult.success ? 2 : 1,
        signatures: [originalResult.signature!, replayResult.signature].filter(Boolean) as string[]
      }

    } catch (error: any) {
      return {
        success: false,
        type: 'replay-attack',
        targetFunction: 'unknown',
        program: program.programId.toBase58(),
        attemptedSpends: 0,
        successfulSpends: 0,
        error: error.message
      }
    }
  }

  /**
   * Test nonce manipulation attacks
   */
  async testNonceManipulation(program: Program): Promise<DoubleSpendingAttackResult> {
    console.log(`\n#️⃣ Testing nonce manipulation on ${program.programId.toBase58()}...`)
    
    try {
      const nonceFunction = this.findNonceFunction(program)
      if (!nonceFunction) {
        return {
          success: false,
          type: 'nonce-manipulation',
          targetFunction: 'unknown',
          program: program.programId.toBase58(),
          attemptedSpends: 0,
          successfulSpends: 0,
          error: 'No nonce-based function found'
        }
      }

      // Create transactions with manipulated nonces
      const transactions: Transaction[] = []
      const baseNonce = Date.now()
      
      // Same nonce for multiple transactions
      for (let i = 0; i < 3; i++) {
        const tx = await this.buildNonceTransaction(
          program,
          nonceFunction,
          baseNonce, // Same nonce!
          this.environment.attacker.keypair
        )
        transactions.push(tx)
      }

      // Send all with same nonce
      const results = await this.sendConcurrentTransactions(
        transactions,
        this.environment.attacker.keypair
      )
      
      const successCount = results.filter(r => r.success).length
      
      return {
        success: successCount > 1,
        type: 'nonce-manipulation',
        targetFunction: nonceFunction,
        program: program.programId.toBase58(),
        attemptedSpends: transactions.length,
        successfulSpends: successCount,
        signatures: results.filter(r => r.success).map(r => r.signature!)
      }

    } catch (error: any) {
      return {
        success: false,
        type: 'nonce-manipulation',
        targetFunction: 'unknown',
        program: program.programId.toBase58(),
        attemptedSpends: 0,
        successfulSpends: 0,
        error: error.message
      }
    }
  }

  /**
   * Find spend/transfer functions
   */
  private findSpendFunction(program: Program): string | null {
    const spendKeywords = ['transfer', 'send', 'spend', 'pay']
    
    for (const instruction of program.idl.instructions) {
      if (spendKeywords.some(keyword => 
        instruction.name.toLowerCase().includes(keyword)
      )) {
        return instruction.name
      }
    }
    
    return null
  }

  /**
   * Find withdraw functions
   */
  private findWithdrawFunction(program: Program): string | null {
    const withdrawKeywords = ['withdraw', 'claim', 'redeem']
    
    for (const instruction of program.idl.instructions) {
      if (withdrawKeywords.some(keyword => 
        instruction.name.toLowerCase().includes(keyword)
      )) {
        return instruction.name
      }
    }
    
    return null
  }

  /**
   * Find functions that might be replayable
   */
  private findReplayableFunction(program: Program): string | null {
    // Look for functions without explicit replay protection
    for (const instruction of program.idl.instructions) {
      const hasTimestamp = instruction.args.some(arg =>
        arg.name.toLowerCase().includes('timestamp') ||
        arg.name.toLowerCase().includes('nonce')
      )
      
      if (!hasTimestamp) {
        return instruction.name
      }
    }
    
    return null
  }

  /**
   * Find nonce-based functions
   */
  private findNonceFunction(program: Program): string | null {
    for (const instruction of program.idl.instructions) {
      const hasNonce = instruction.args.some(arg =>
        arg.name.toLowerCase().includes('nonce') ||
        arg.name.toLowerCase().includes('sequence')
      )
      
      if (hasNonce) {
        return instruction.name
      }
    }
    
    return null
  }

  /**
   * Build spend transaction
   */
  private async buildSpendTransaction(
    program: Program,
    functionName: string,
    amount: anchor.BN,
    signer: Keypair,
    recipient: PublicKey
  ): Promise<Transaction> {
    const tx = new Transaction()
    
    try {
      const instruction = await program.methods[functionName]({
        amount: amount
      })
      .accounts({
        from: signer.publicKey,
        to: recipient,
        systemProgram: anchor.web3.SystemProgram.programId
      })
      .instruction()
      
      tx.add(instruction)
    } catch (error) {
      // Raw spend instruction
      const data = Buffer.alloc(41)
      data.writeUInt8(0x01, 0) // Transfer instruction
      data.writeBigUInt64LE(BigInt(amount.toString()), 1)
      data.write(recipient.toBuffer().toString('hex'), 9, 'hex')
      
      tx.add(new TransactionInstruction({
        keys: [
          {
            pubkey: signer.publicKey,
            isSigner: true,
            isWritable: true
          },
          {
            pubkey: recipient,
            isSigner: false,
            isWritable: true
          }
        ],
        programId: program.programId,
        data
      }))
    }
    
    return tx
  }

  /**
   * Build withdraw transaction
   */
  private async buildWithdrawTransaction(
    program: Program,
    functionName: string,
    account: PublicKey,
    signer: Keypair
  ): Promise<Transaction> {
    const tx = new Transaction()
    
    try {
      const instruction = await program.methods[functionName]()
        .accounts({
          user: signer.publicKey,
          vault: account,
          systemProgram: anchor.web3.SystemProgram.programId
        })
        .instruction()
      
      tx.add(instruction)
    } catch (error) {
      // Raw withdraw
      const data = Buffer.from([0x02]) // Withdraw instruction
      
      tx.add(new TransactionInstruction({
        keys: [
          {
            pubkey: signer.publicKey,
            isSigner: true,
            isWritable: true
          },
          {
            pubkey: account,
            isSigner: false,
            isWritable: true
          }
        ],
        programId: program.programId,
        data
      }))
    }
    
    return tx
  }

  /**
   * Build replayable transaction
   */
  private async buildReplayableTransaction(
    program: Program,
    functionName: string,
    signer: Keypair
  ): Promise<Transaction> {
    const tx = new Transaction()
    
    try {
      const instruction = await program.methods[functionName]()
        .accounts({
          user: signer.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId
        })
        .instruction()
      
      tx.add(instruction)
    } catch (error) {
      // Simple instruction without replay protection
      const data = Buffer.from([0x03])
      
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
   * Build transaction with nonce
   */
  private async buildNonceTransaction(
    program: Program,
    functionName: string,
    nonce: number,
    signer: Keypair
  ): Promise<Transaction> {
    const tx = new Transaction()
    
    try {
      const instruction = await program.methods[functionName]({
        nonce: new anchor.BN(nonce)
      })
      .accounts({
        user: signer.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId
      })
      .instruction()
      
      tx.add(instruction)
    } catch (error) {
      // Raw nonce instruction
      const data = Buffer.alloc(9)
      data.writeUInt8(0x04, 0)
      data.writeBigUInt64LE(BigInt(nonce), 1)
      
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
   * Create shared account for race condition test
   */
  private async createSharedAccount(program: Program): Promise<PublicKey> {
    // Create a PDA that multiple users can access
    const [pda] = await PublicKey.findProgramAddress(
      [Buffer.from('shared'), Buffer.from('vault')],
      program.programId
    )
    return pda
  }

  /**
   * Modify transaction for replay attempt
   */
  private async modifyTransactionForReplay(originalTx: Transaction): Promise<Transaction> {
    const replayTx = new Transaction()
    
    // Copy instructions
    for (const instruction of originalTx.instructions) {
      replayTx.add(instruction)
    }
    
    // Get new blockhash
    const { blockhash } = await this.connection.getLatestBlockhash()
    replayTx.recentBlockhash = blockhash
    
    return replayTx
  }

  /**
   * Send concurrent transactions
   */
  private async sendConcurrentTransactions(
    transactions: Transaction[],
    signer: Keypair
  ): Promise<Array<{success: boolean, signature?: string, error?: string}>> {
    // Get recent blockhash for all
    const { blockhash } = await this.connection.getLatestBlockhash()
    
    // Prepare all transactions
    const preparedTxs = transactions.map(tx => {
      tx.recentBlockhash = blockhash
      tx.feePayer = signer.publicKey
      tx.sign(signer)
      return tx
    })
    
    // Send all at once
    const promises = preparedTxs.map(tx => 
      this.sendTransactionAsync(tx, signer, true)
    )
    
    return Promise.all(promises)
  }

  /**
   * Send transaction asynchronously
   */
  private async sendTransactionAsync(
    transaction: Transaction,
    signer: Keypair,
    skipSigning: boolean = false
  ): Promise<{success: boolean, signature?: string, logs?: string[], error?: string}> {
    try {
      if (!skipSigning) {
        const { blockhash } = await this.connection.getLatestBlockhash()
        transaction.recentBlockhash = blockhash
        transaction.feePayer = signer.publicKey
        transaction.sign(signer)
      }
      
      const signature = await this.connection.sendRawTransaction(
        transaction.serialize(),
        { skipPreflight: true }
      )
      
      // Don't wait for confirmation in race conditions
      return {
        success: true,
        signature
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message
      }
    }
  }

  /**
   * Get token balance
   */
  private async getTokenBalance(tokenAccount: PublicKey): Promise<number> {
    try {
      const info = await this.connection.getTokenAccountBalance(tokenAccount)
      return parseInt(info.value.amount)
    } catch (error) {
      return 0
    }
  }

  /**
   * Run all double spending tests
   */
  async runAllTests(program: Program): Promise<DoubleSpendingAttackResult[]> {
    const results: DoubleSpendingAttackResult[] = []
    
    results.push(await this.testConcurrentSpend(program))
    results.push(await this.testRaceCondition(program))
    results.push(await this.testReplayAttack(program))
    results.push(await this.testNonceManipulation(program))
    
    return results
  }
}

// Export factory function
export const createDoubleSpendingAttackTester = (
  connection: Connection,
  environment: TestEnvironment
) => new DoubleSpendingAttackTester(connection, environment) 