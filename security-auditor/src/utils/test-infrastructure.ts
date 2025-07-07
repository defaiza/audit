import { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL, SystemProgram, Transaction, sendAndConfirmTransaction } from '@solana/web3.js'
import { 
  createMint,
  createAssociatedTokenAccount,
  mintTo,
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID
} from '@solana/spl-token'
import * as anchor from '@coral-xyz/anchor'
import { Program } from '@coral-xyz/anchor'

export interface TestWallet {
  keypair: Keypair
  publicKey: PublicKey
  tokenAccount?: PublicKey
  balance: number
}

export interface TestEnvironment {
  connection: Connection
  admin: TestWallet
  attacker: TestWallet
  victim: TestWallet
  treasury: TestWallet
  tokenMint: PublicKey
  tokenDecimals: number
  programs: {
    swap?: Program
    staking?: Program
    estate?: Program
    appFactory?: Program
  }
}

export class SecurityTestInfrastructure {
  private connection: Connection
  private commitment: anchor.web3.Commitment = 'confirmed'

  constructor(connection: Connection) {
    this.connection = connection
  }

  /**
   * Create a complete test environment with funded wallets and token setup
   */
  async setupTestEnvironment(adminKeypair?: Keypair): Promise<TestEnvironment> {
    console.log('🔧 Setting up test environment...')

    // Create test wallets
    const admin = adminKeypair ? {
      keypair: adminKeypair,
      publicKey: adminKeypair.publicKey,
      balance: 0
    } : await this.createFundedWallet('Admin', 10)

    const attacker = await this.createFundedWallet('Attacker', 5)
    const victim = await this.createFundedWallet('Victim', 5)
    const treasury = await this.createFundedWallet('Treasury', 2)

    // Create token mint
    console.log('🪙 Creating test token mint...')
    const tokenMint = await this.createTokenMint(admin.keypair)

    // Create token accounts for all wallets
    const wallets = [admin, attacker, victim, treasury]
    for (const wallet of wallets) {
      wallet.tokenAccount = await this.createTokenAccount(
        tokenMint,
        wallet.keypair.publicKey
      )
      
      // Mint tokens to each wallet
      await this.mintTokens(
        tokenMint,
        wallet.tokenAccount,
        admin.keypair,
        1_000_000 * 10**6 // 1M tokens with 6 decimals
      )
    }

    // Update balances
    for (const wallet of wallets) {
      wallet.balance = await this.getBalance(wallet.publicKey)
    }

    console.log('✅ Test environment ready!')
    console.log(`   Admin: ${admin.publicKey.toBase58().slice(0, 8)}... (${admin.balance / LAMPORTS_PER_SOL} SOL)`)
    console.log(`   Attacker: ${attacker.publicKey.toBase58().slice(0, 8)}... (${attacker.balance / LAMPORTS_PER_SOL} SOL)`)
    console.log(`   Victim: ${victim.publicKey.toBase58().slice(0, 8)}... (${victim.balance / LAMPORTS_PER_SOL} SOL)`)
    console.log(`   Token Mint: ${tokenMint.toBase58().slice(0, 8)}...`)

    return {
      connection: this.connection,
      admin,
      attacker,
      victim,
      treasury,
      tokenMint,
      tokenDecimals: 6,
      programs: {} // Will be populated by program loader
    }
  }

  /**
   * Create and fund a test wallet
   */
  private async createFundedWallet(name: string, solAmount: number): Promise<TestWallet> {
    const keypair = Keypair.generate()
    console.log(`💰 Creating ${name} wallet: ${keypair.publicKey.toBase58().slice(0, 8)}...`)

    // Request airdrop
    const signature = await this.connection.requestAirdrop(
      keypair.publicKey,
      solAmount * LAMPORTS_PER_SOL
    )
    
    await this.connection.confirmTransaction(signature, this.commitment)
    
    const balance = await this.connection.getBalance(keypair.publicKey)
    
    return {
      keypair,
      publicKey: keypair.publicKey,
      balance
    }
  }

  /**
   * Create a new token mint
   */
  private async createTokenMint(authority: Keypair): Promise<PublicKey> {
    // Use the new SPL token library
    const mint = await createMint(
      this.connection,
      authority,
      authority.publicKey,
      authority.publicKey,
      6 // decimals
    )

    return mint
  }

  /**
   * Create associated token account
   */
  private async createTokenAccount(
    mint: PublicKey,
    owner: PublicKey
  ): Promise<PublicKey> {
    const associatedTokenAddress = await getAssociatedTokenAddress(
      mint,
      owner
    )

    // Check if account exists
    const info = await this.connection.getAccountInfo(associatedTokenAddress)
    if (!info) {
      // Create associated token account
      const tokenAccount = await createAssociatedTokenAccount(
        this.connection,
        Keypair.generate(), // payer (will be replaced)
        mint,
        owner
      )
      return tokenAccount
    }

    return associatedTokenAddress
  }

  /**
   * Mint tokens to an account
   */
  private async mintTokens(
    mint: PublicKey,
    destination: PublicKey,
    authority: Keypair,
    amount: number
  ): Promise<void> {
    await mintTo(
      this.connection,
      authority,
      mint,
      destination,
      authority.publicKey,
      amount
    )
  }

  /**
   * Get SOL balance
   */
  private async getBalance(publicKey: PublicKey): Promise<number> {
    return await this.connection.getBalance(publicKey)
  }

  /**
   * Get token balance
   */
  async getTokenBalance(tokenAccount: PublicKey): Promise<number> {
    const info = await this.connection.getTokenAccountBalance(tokenAccount)
    return parseInt(info.value.amount)
  }

  /**
   * Create a malicious program for testing CPI attacks
   */
  async deployMaliciousProgram(): Promise<PublicKey> {
    // In a real implementation, this would deploy a program designed to exploit vulnerabilities
    // For now, return a dummy program ID
    console.log('🦹 Deploying malicious program (simulated)...')
    return Keypair.generate().publicKey
  }

  /**
   * Take a snapshot of account states
   */
  async takeAccountSnapshot(accounts: PublicKey[]): Promise<Map<string, any>> {
    const snapshot = new Map<string, any>()
    
    for (const account of accounts) {
      const info = await this.connection.getAccountInfo(account)
      if (info) {
        snapshot.set(account.toBase58(), {
          lamports: info.lamports,
          data: info.data,
          owner: info.owner.toBase58(),
          executable: info.executable,
          rentEpoch: info.rentEpoch
        })
      }
    }
    
    return snapshot
  }

  /**
   * Compare account states before and after
   */
  compareSnapshots(
    before: Map<string, any>,
    after: Map<string, any>
  ): {
    changed: string[]
    differences: Map<string, any>
  } {
    const changed: string[] = []
    const differences = new Map<string, any>()
    
    for (const [account, beforeState] of Array.from(before)) {
      const afterState = after.get(account)
      
      if (!afterState) {
        changed.push(account)
        differences.set(account, { status: 'deleted' })
        continue
      }
      
      // Compare states
      if (beforeState.lamports !== afterState.lamports ||
          beforeState.owner !== afterState.owner ||
          !beforeState.data.equals(afterState.data)) {
        changed.push(account)
        differences.set(account, {
          lamports: {
            before: beforeState.lamports,
            after: afterState.lamports,
            diff: afterState.lamports - beforeState.lamports
          },
          owner: {
            before: beforeState.owner,
            after: afterState.owner,
            changed: beforeState.owner !== afterState.owner
          },
          dataChanged: !beforeState.data.equals(afterState.data)
        })
      }
    }
    
    // Check for new accounts
    for (const [account] of after) {
      if (!before.has(account)) {
        changed.push(account)
        differences.set(account, { status: 'created' })
      }
    }
    
    return { changed, differences }
  }

  /**
   * Monitor transaction logs
   */
  async getTransactionLogs(signature: string): Promise<string[]> {
    const tx = await this.connection.getTransaction(signature, {
      commitment: 'confirmed',
      maxSupportedTransactionVersion: 0
    })
    
    return tx?.meta?.logMessages || []
  }

  /**
   * Simulate transaction and get detailed results
   */
  async simulateTransaction(
    transaction: Transaction,
    signers: Keypair[]
  ): Promise<{
    success: boolean
    logs: string[]
    computeUnits: number
    error?: any
  }> {
    try {
      // Get recent blockhash
      const { blockhash } = await this.connection.getLatestBlockhash()
      transaction.recentBlockhash = blockhash
      transaction.feePayer = signers[0].publicKey

      // Sign transaction
      transaction.sign(...signers)

      // Simulate
      const result = await this.connection.simulateTransaction(transaction)

      return {
        success: result.value.err === null,
        logs: result.value.logs || [],
        computeUnits: result.value.unitsConsumed || 0,
        error: result.value.err
      }
    } catch (error) {
      return {
        success: false,
        logs: [],
        computeUnits: 0,
        error
      }
    }
  }
}

// Export singleton instance
export const testInfrastructure = (connection: Connection) => 
  new SecurityTestInfrastructure(connection) 