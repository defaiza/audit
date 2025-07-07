import * as anchor from '@coral-xyz/anchor'
import { Program, Idl } from '@coral-xyz/anchor'
import { Connection, PublicKey, Keypair, SystemProgram, Transaction, sendAndConfirmTransaction } from '@solana/web3.js'
import { 
  createMint, 
  getOrCreateAssociatedTokenAccount, 
  mintTo,
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  createInitializeMintInstruction,
  getMintLen,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddress,
  MINT_SIZE
} from '@solana/spl-token'
// IDL types are not needed since we're using them as Idl
import defaiSwapIdl from '@/idl/defai_swap.json'
import defaiStakingIdl from '@/idl/defai_staking.json'
import defaiEstateIdl from '@/idl/defai_estate.json'
import defaiAppFactoryIdl from '@/idl/defai_app_factory.json'
import toast from 'react-hot-toast'

export interface InitializationResult {
  program: string
  status: 'success' | 'error' | 'skipped'
  message: string
  details?: any
}

export class ProgramInitializer {
  connection: Connection
  provider: anchor.AnchorProvider

  constructor(connection: Connection, wallet: any) {
    this.connection = connection
    
    // Ensure we have the adapter for signing transactions
    const adapter = wallet.adapter || wallet
    const anchorWallet = {
      publicKey: wallet.publicKey,
      signTransaction: adapter.signTransaction ? adapter.signTransaction.bind(adapter) : wallet.signTransaction.bind(wallet),
      signAllTransactions: adapter.signAllTransactions ? adapter.signAllTransactions.bind(adapter) : wallet.signAllTransactions.bind(wallet),
    }
    
    this.provider = new anchor.AnchorProvider(connection, anchorWallet as any, {
      commitment: 'confirmed'
    })
  }

  async initializeAll(): Promise<InitializationResult[]> {
    const results: InitializationResult[] = []
    
    toast.loading('Creating token mints...', { id: 'init-mints' })
    
    try {
      // Step 1: Create token mints
      const mints = await this.createTokenMints()
      results.push({
        program: 'Token Mints',
        status: 'success',
        message: 'Created DEFAI and Rewards mints',
        details: mints
      })
      toast.success('Token mints created!', { id: 'init-mints' })
      
      // Step 2: Initialize each program
      const swapResult = await this.initializeSwap(mints.defaiMint, mints.rewardsMint)
      results.push(swapResult)
      
      const stakingResult = await this.initializeStaking(mints.defaiMint)
      results.push(stakingResult)
      
      const estateResult = await this.initializeEstate()
      results.push(estateResult)
      
      const appFactoryResult = await this.initializeAppFactory(mints.defaiMint)
      results.push(appFactoryResult)
      
      // Step 3: Mint some tokens for testing
      await this.mintTestTokens(mints.defaiMint, mints.rewardsMint)
      results.push({
        program: 'Test Tokens',
        status: 'success',
        message: 'Minted test tokens to wallet'
      })
      
    } catch (err: any) {
      results.push({
        program: 'Initialization',
        status: 'error',
        message: `Failed: ${err.message}`
      })
    }
    
    return results
  }

  async createTokenMints() {
    const wallet = this.provider.wallet
    
    console.log('Creating token mints...')
    console.log('Wallet publicKey:', wallet.publicKey?.toBase58())
    
    // Create DEFAI mint (regular SPL token)
    const defaiMint = Keypair.generate()
    await createMint(
      this.connection,
      wallet as any, // Use wallet directly as payer
      wallet.publicKey,
      wallet.publicKey,
      6, // 6 decimals
      defaiMint,
      undefined,
      TOKEN_PROGRAM_ID
    )
    
    // Create Rewards mint (Token-2022)
    const rewardsMint = Keypair.generate()
    const mintLen = getMintLen([])
    const lamports = await this.connection.getMinimumBalanceForRentExemption(mintLen)
    
    const createMintTx = new Transaction().add(
      SystemProgram.createAccount({
        fromPubkey: wallet.publicKey,
        newAccountPubkey: rewardsMint.publicKey,
        space: mintLen,
        lamports,
        programId: TOKEN_2022_PROGRAM_ID,
      }),
      createInitializeMintInstruction(
        rewardsMint.publicKey,
        6, // decimals
        wallet.publicKey,
        wallet.publicKey,
        TOKEN_2022_PROGRAM_ID
      )
    )
    
    // Sign and send transaction
    createMintTx.feePayer = wallet.publicKey
    createMintTx.recentBlockhash = (await this.connection.getLatestBlockhash()).blockhash
    createMintTx.partialSign(rewardsMint)
    
    const signedTx = await wallet.signTransaction(createMintTx)
    const txId = await this.connection.sendRawTransaction(signedTx.serialize())
    await this.connection.confirmTransaction(txId, 'confirmed')
    
    return {
      defaiMint: defaiMint.publicKey,
      rewardsMint: rewardsMint.publicKey
    }
  }

  async initializeSwap(defaiMint: PublicKey, rewardsMint: PublicKey): Promise<InitializationResult> {
    try {
      const programId = new PublicKey('3WeYbjGoiTQ6qZ8s9Ek6sUZCy2FzG7b9NbGfbVCtHS2n')
      const program = new Program(defaiSwapIdl as Idl, programId, this.provider)
      
      // PDAs
      const [configPda] = PublicKey.findProgramAddressSync([Buffer.from('config')], programId)
      const [escrowPda] = PublicKey.findProgramAddressSync([Buffer.from('escrow')], programId)
      const [taxPda] = PublicKey.findProgramAddressSync([Buffer.from('tax_state')], programId)
      
      // Check if already initialized
      const configAccount = await this.connection.getAccountInfo(configPda)
      if (configAccount) {
        return {
          program: 'DeFAI Swap',
          status: 'skipped',
          message: 'Already initialized'
        }
      }
      
      // Create dummy collection mint for NFTs
      const collectionMint = Keypair.generate()
      
      // Initialize with tier prices (in microDEFAI)
      const tierPrices = [
        new anchor.BN(1_000_000_000),      // 1,000 DEFAI
        new anchor.BN(10_000_000_000),     // 10,000 DEFAI
        new anchor.BN(500_000_000_000),    // 500,000 DEFAI
        new anchor.BN(1_000_000_000_000),  // 1,000,000 DEFAI
        new anchor.BN(5_000_000_000_000),  // 5,000,000 DEFAI
      ]
      
      await program.methods
        .initialize(tierPrices)
        .accounts({
          admin: this.provider.wallet.publicKey,
          oldMint: defaiMint,
          newMint: rewardsMint,
          collection: collectionMint.publicKey,
          treasury: this.provider.wallet.publicKey,
          config: configPda,
          escrow: escrowPda,
          taxState: taxPda,
          systemProgram: SystemProgram.programId
        })
        .rpc()
      
      return {
        program: 'DeFAI Swap',
        status: 'success',
        message: 'Initialized successfully',
        details: { configPda: configPda.toBase58() }
      }
    } catch (err: any) {
      return {
        program: 'DeFAI Swap',
        status: 'error',
        message: err.message
      }
    }
  }

  async initializeStaking(defaiMint: PublicKey): Promise<InitializationResult> {
    try {
      const programId = new PublicKey('3sKj7jgDkiT3hroWho3YZSWAfcmpXXucNKipN4vC3EFM')
      const program = new Program(defaiStakingIdl as Idl, programId, this.provider)
      
      // PDAs
      const [programStatePda] = PublicKey.findProgramAddressSync([Buffer.from('program-state')], programId)
      const [vaultPda] = PublicKey.findProgramAddressSync([Buffer.from('vault')], programId)
      
      // Check if already initialized
      const stateAccount = await this.connection.getAccountInfo(programStatePda)
      if (stateAccount) {
        return {
          program: 'DeFAI Staking',
          status: 'skipped',
          message: 'Already initialized'
        }
      }
      
      await program.methods
        .initializeProgram()
        .accounts({
          authority: this.provider.wallet.publicKey,
          programState: programStatePda,
          vault: vaultPda,
          defaiMint: defaiMint,
          funder: this.provider.wallet.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId
        })
        .rpc()
      
      return {
        program: 'DeFAI Staking',
        status: 'success',
        message: 'Initialized successfully',
        details: { programStatePda: programStatePda.toBase58() }
      }
    } catch (err: any) {
      return {
        program: 'DeFAI Staking',
        status: 'error',
        message: err.message
      }
    }
  }

  async initializeEstate(): Promise<InitializationResult> {
    try {
      const programId = new PublicKey('2zkarMr8w1k6t1jjcZvmcfVPoFnKy3b1kbxEZH6aATJi')
      const program = new Program(defaiEstateIdl as Idl, programId, this.provider)
      
      // PDAs
      const [estateManagerPda] = PublicKey.findProgramAddressSync([Buffer.from('estate_manager')], programId)
      
      // Check if already initialized
      const managerAccount = await this.connection.getAccountInfo(estateManagerPda)
      if (managerAccount) {
        return {
          program: 'DeFAI Estate',
          status: 'skipped',
          message: 'Already initialized'
        }
      }
      
      await program.methods
        .initializeManager(200) // 2% platform fee
        .accounts({
          owner: this.provider.wallet.publicKey,
          estateManager: estateManagerPda,
          treasury: this.provider.wallet.publicKey,
          systemProgram: SystemProgram.programId
        })
        .rpc()
      
      return {
        program: 'DeFAI Estate',
        status: 'success',
        message: 'Initialized successfully',
        details: { estateManagerPda: estateManagerPda.toBase58() }
      }
    } catch (err: any) {
      return {
        program: 'DeFAI Estate',
        status: 'error',
        message: err.message
      }
    }
  }

  async initializeAppFactory(defaiMint: PublicKey): Promise<InitializationResult> {
    try {
      const programId = new PublicKey('Ckp11QQpgdP8poYAPVdVjaA5yqfk9Kc4Bd3zmKfzhFAZ')
      const program = new Program(defaiAppFactoryIdl as Idl, programId, this.provider)
      
      // PDAs
      const [appFactoryPda] = PublicKey.findProgramAddressSync([Buffer.from('app_factory')], programId)
      
      // Check if already initialized
      const factoryAccount = await this.connection.getAccountInfo(appFactoryPda)
      if (factoryAccount) {
        return {
          program: 'DeFAI App Factory',
          status: 'skipped',
          message: 'Already initialized'
        }
      }
      
      await program.methods
        .initializeAppFactory(2000) // 20% platform fee
        .accounts({
          authority: this.provider.wallet.publicKey,
          appFactory: appFactoryPda,
          treasury: this.provider.wallet.publicKey,
          defaiMint: defaiMint,
          systemProgram: SystemProgram.programId
        })
        .rpc()
      
      return {
        program: 'DeFAI App Factory',
        status: 'success',
        message: 'Initialized successfully',
        details: { appFactoryPda: appFactoryPda.toBase58() }
      }
    } catch (err: any) {
      return {
        program: 'DeFAI App Factory',
        status: 'error',
        message: err.message
      }
    }
  }

  async mintTestTokens(defaiMint: PublicKey, rewardsMint: PublicKey) {
    const wallet = this.provider.wallet
    
    // Mint DEFAI tokens
    const defaiAta = await getOrCreateAssociatedTokenAccount(
      this.connection,
      wallet as any,
      defaiMint,
      wallet.publicKey
    )
    
    await mintTo(
      this.connection,
      wallet as any,
      defaiMint,
      defaiAta.address,
      wallet.publicKey,
      10_000_000_000_000, // 10M tokens
      [],
      undefined,
      TOKEN_PROGRAM_ID
    )
    
    // Mint Rewards tokens
    const rewardsAta = await getOrCreateAssociatedTokenAccount(
      this.connection,
      wallet as any,
      rewardsMint,
      wallet.publicKey,
      false,
      undefined,
      undefined,
      TOKEN_2022_PROGRAM_ID
    )
    
    await mintTo(
      this.connection,
      wallet as any,
      rewardsMint,
      rewardsAta.address,
      wallet.publicKey,
      10_000_000_000_000, // 10M tokens
      [],
      undefined,
      TOKEN_2022_PROGRAM_ID
    )
  }
}