import * as anchor from '@coral-xyz/anchor'
import { Connection, Keypair, PublicKey, SystemProgram, LAMPORTS_PER_SOL, Transaction } from '@solana/web3.js'
import { 
  createMint, 
  getOrCreateAssociatedTokenAccount, 
  mintTo,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddress,
  createTransferInstruction
} from '@solana/spl-token'

export interface TestWallet {
  keypair: Keypair
  publicKey: PublicKey
  tokenAccounts: Map<string, PublicKey>
}

export interface TestTokens {
  defaiMint: PublicKey
  rewardsMint: PublicKey
  testNftMint?: PublicKey
}

export interface TestEnvironment {
  connection: Connection
  adminWallet: TestWallet
  attackerWallet: TestWallet
  victimWallet: TestWallet
  tokens: TestTokens
  programIds: {
    swap: PublicKey
    staking: PublicKey
    estate: PublicKey
    appFactory: PublicKey
  }
}

export class SecurityTestEnvironment {
  private connection: Connection
  private payer: Keypair
  private environment?: TestEnvironment

  constructor(connection: Connection, payer: Keypair) {
    this.connection = connection
    this.payer = payer
  }

  async setup(): Promise<TestEnvironment> {
    console.log('🔧 Setting up security test environment...')

    // Create test wallets
    const adminWallet = await this.createTestWallet('Admin', 10)
    const attackerWallet = await this.createTestWallet('Attacker', 5)
    const victimWallet = await this.createTestWallet('Victim', 5)

    // Create test tokens
    const tokens = await this.createTestTokens(adminWallet.keypair)

    // Fund wallets with test tokens
    await this.fundWalletsWithTokens([adminWallet, attackerWallet, victimWallet], tokens)

    // Program IDs from deployed programs
    const programIds = {
      swap: new PublicKey('2rpNRpFnZEbb9Xoonieg7THkKnYEQhZoSK8bKNtVaVLS'),
      staking: new PublicKey('CyYfX3MjkuQBTpD8N3KLXBAr8Nik89f63FZ3jFVSMd6s'),
      estate: new PublicKey('HYJe4U2DToJCjb5T8tysN4784twLUk48dUjPGD7dKYut'),
      appFactory: new PublicKey('AzcDoYYY1cHCd3faCKd8tG76ESUnuRz8jVBXEcxFwznQ')
    }

    this.environment = {
      connection: this.connection,
      adminWallet,
      attackerWallet,
      victimWallet,
      tokens,
      programIds
    }

    console.log('✅ Test environment setup complete')
    return this.environment
  }

  private async createTestWallet(name: string, solAmount: number): Promise<TestWallet> {
    const keypair = Keypair.generate()
    
    // Airdrop SOL
    console.log(`💰 Funding ${name} wallet with ${solAmount} SOL...`)
    const airdropSig = await this.connection.requestAirdrop(
      keypair.publicKey,
      solAmount * LAMPORTS_PER_SOL
    )
    await this.connection.confirmTransaction(airdropSig)

    return {
      keypair,
      publicKey: keypair.publicKey,
      tokenAccounts: new Map()
    }
  }

  private async createTestTokens(authority: Keypair): Promise<TestTokens> {
    console.log('🪙 Creating test tokens...')

    // Create DEFAI token mint
    const defaiMint = await createMint(
      this.connection,
      authority,
      authority.publicKey,
      authority.publicKey,
      6 // 6 decimals
    )

    // Create rewards token mint
    const rewardsMint = await createMint(
      this.connection,
      authority,
      authority.publicKey,
      authority.publicKey,
      6
    )

    console.log('✅ Test tokens created:', {
      defai: defaiMint.toBase58(),
      rewards: rewardsMint.toBase58()
    })

    return { defaiMint, rewardsMint }
  }

  private async fundWalletsWithTokens(wallets: TestWallet[], tokens: TestTokens) {
    console.log('💸 Distributing test tokens to wallets...')

    for (const wallet of wallets) {
      // Create token accounts
      const defaiAccount = await getOrCreateAssociatedTokenAccount(
        this.connection,
        wallet.keypair,
        tokens.defaiMint,
        wallet.publicKey
      )
      wallet.tokenAccounts.set('defai', defaiAccount.address)

      const rewardsAccount = await getOrCreateAssociatedTokenAccount(
        this.connection,
        wallet.keypair,
        tokens.rewardsMint,
        wallet.publicKey
      )
      wallet.tokenAccounts.set('rewards', rewardsAccount.address)

      // Mint tokens to wallets (1M tokens each)
      await mintTo(
        this.connection,
        this.payer,
        tokens.defaiMint,
        defaiAccount.address,
        this.payer,
        1_000_000 * 10**6
      )

      await mintTo(
        this.connection,
        this.payer,
        tokens.rewardsMint,
        rewardsAccount.address,
        this.payer,
        1_000_000 * 10**6
      )
    }
  }

  // Helper methods for test scenarios
  async createMaliciousWallet(): Promise<TestWallet> {
    return await this.createTestWallet('Malicious', 1)
  }

  async drainWalletFunds(wallet: TestWallet) {
    // Drain SOL (leave minimum for rent)
    const balance = await this.connection.getBalance(wallet.publicKey)
    if (balance > 890880) { // Minimum rent
      const drainTx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: wallet.publicKey,
          toPubkey: this.payer.publicKey,
          lamports: balance - 890880
        })
      )
      await this.connection.sendTransaction(drainTx, [wallet.keypair])
    }
  }

  async createDummyAccounts(count: number): Promise<PublicKey[]> {
    const accounts: PublicKey[] = []
    for (let i = 0; i < count; i++) {
      accounts.push(Keypair.generate().publicKey)
    }
    return accounts
  }

  getEnvironment(): TestEnvironment {
    if (!this.environment) {
      throw new Error('Test environment not initialized. Call setup() first.')
    }
    return this.environment
  }

  // Attack scenario helpers
  async setupReentrancyScenario() {
    // Create accounts and state needed for reentrancy tests
    const env = this.getEnvironment()
    
    // Implementation specific to reentrancy setup
    return {
      targetAccount: Keypair.generate().publicKey,
      callbackProgram: Keypair.generate().publicKey,
      // Add more as needed
    }
  }

  async setupFlashLoanScenario() {
    const env = this.getEnvironment()
    
    // Create large token reserves for flash loan testing
    const flashLoanPool = await this.createTestWallet('FlashLoanPool', 10)
    const poolTokenAccount = await getOrCreateAssociatedTokenAccount(
      this.connection,
      flashLoanPool.keypair,
      env.tokens.defaiMint,
      flashLoanPool.publicKey
    )

    // Mint large amount for flash loan pool
    await mintTo(
      this.connection,
      this.payer,
      env.tokens.defaiMint,
      poolTokenAccount.address,
      this.payer,
      1_000_000_000 * 10**6 // 1B tokens
    )

    return {
      poolWallet: flashLoanPool,
      poolTokenAccount: poolTokenAccount.address,
      availableAmount: 1_000_000_000 * 10**6
    }
  }

  // Cleanup method
  async cleanup() {
    console.log('🧹 Cleaning up test environment...')
    // Close token accounts, return funds, etc.
  }
}

// Utility functions for common test patterns
export async function measureGasUsage(
  connection: Connection,
  transaction: Transaction
): Promise<number> {
  const { value: simulationResult } = await connection.simulateTransaction(transaction)
  return simulationResult?.unitsConsumed || 0
}

export function generateRandomAddresses(count: number): PublicKey[] {
  return Array.from({ length: count }, () => Keypair.generate().publicKey)
}

export async function createTokenTransferTx(
  from: PublicKey,
  to: PublicKey,
  mint: PublicKey,
  amount: number,
  signer: PublicKey
): Promise<Transaction> {
  const fromAta = await getAssociatedTokenAddress(mint, from)
  const toAta = await getAssociatedTokenAddress(mint, to)

  const tx = new Transaction()
  
  // Check if destination ATA exists, create if not
  try {
    await getAssociatedTokenAddress(mint, to)
  } catch {
    tx.add(
      createAssociatedTokenAccountInstruction(
        signer,
        toAta,
        to,
        mint
      )
    )
  }

  tx.add(
    createTransferInstruction(
      fromAta,
      toAta,
      from,
      amount
    )
  )

  return tx
} 