import * as anchor from '@coral-xyz/anchor'
import { Program, Idl } from '@coral-xyz/anchor'
import { Connection, PublicKey, Keypair, SystemProgram, Transaction } from '@solana/web3.js'
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

export class SimpleInitializer {
  connection: Connection
  provider: anchor.AnchorProvider

  constructor(connection: Connection, wallet: any) {
    this.connection = connection
    this.provider = new anchor.AnchorProvider(connection, wallet, {
      commitment: 'confirmed',
      preflightCommitment: 'confirmed',
      skipPreflight: false // Enable preflight for better error messages
    })
    anchor.setProvider(this.provider)
  }

  async initializeAll(): Promise<InitializationResult[]> {
    const results: InitializationResult[] = []
    
    // For localnet testing, we'll use dummy mints instead of creating real ones
    const dummyMint = Keypair.generate().publicKey
    const dummyRewardsMint = Keypair.generate().publicKey
    
    toast.loading('Initializing programs...', { id: 'init-programs' })
    
    try {
      // Initialize each program with dummy mints
      const swapResult = await this.initializeSwap(dummyMint, dummyRewardsMint)
      results.push(swapResult)
      
      const stakingResult = await this.initializeStaking(dummyMint)
      results.push(stakingResult)
      
      const estateResult = await this.initializeEstate()
      results.push(estateResult)
      
      const appFactoryResult = await this.initializeAppFactory(dummyMint)
      results.push(appFactoryResult)
      
      toast.success('Programs initialized!', { id: 'init-programs' })
      
    } catch (err: any) {
      console.error('Initialization error:', err)
      results.push({
        program: 'Initialization',
        status: 'error',
        message: `Failed: ${err.message || err.toString()}`
      })
      toast.error('Initialization failed', { id: 'init-programs' })
    }
    
    return results
  }

  async checkProgramDeployment(programId: PublicKey, programName: string): Promise<boolean> {
    try {
      const accountInfo = await this.connection.getAccountInfo(programId)
      if (!accountInfo) {
        console.error(`${programName} program not found at ${programId.toBase58()}`)
        return false
      }
      if (!accountInfo.executable) {
        console.error(`${programName} account is not executable`)
        return false
      }
      console.log(`${programName} program found and executable`)
      return true
    } catch (err) {
      console.error(`Error checking ${programName} deployment:`, err)
      return false
    }
  }

  async createProgramInstance(programId: PublicKey, idl: Idl, programName: string): Promise<Program | null> {
    try {
      // Create a copy of the IDL and set the correct program ID
      const idlCopy = JSON.parse(JSON.stringify(idl))
      idlCopy.address = programId.toBase58()
      
      const program = new Program(idlCopy as Idl, programId, this.provider)
      return program
    } catch (err: any) {
      console.error(`Error creating ${programName} program instance:`, err)
      if (err.message?.includes('DeclaredProgramIdMismatch')) {
        console.log(`Trying to fix program ID mismatch for ${programName}...`)
        try {
          // Try without the address field
          const idlWithoutAddress = JSON.parse(JSON.stringify(idl))
          delete idlWithoutAddress.address
          const program = new Program(idlWithoutAddress as Idl, programId, this.provider)
          return program
        } catch (retryErr) {
          console.error(`Retry failed for ${programName}:`, retryErr)
          return null
        }
      }
      return null
    }
  }

  async initializeSwap(defaiMint: PublicKey, rewardsMint: PublicKey): Promise<InitializationResult> {
    try {
      const programId = new PublicKey('877w653ayrjqM6fT5yjCuPuTABo8h7N6ffF3es1HRrxm')
      
      // Check if program is deployed
      const isDeployed = await this.checkProgramDeployment(programId, 'DeFAI Swap')
      if (!isDeployed) {
        return {
          program: 'DeFAI Swap',
          status: 'error',
          message: 'Program not deployed to localnet'
        }
      }

      const program = await this.createProgramInstance(programId, defaiSwapIdl as Idl, 'DeFAI Swap')
      if (!program) {
        return {
          program: 'DeFAI Swap',
          status: 'error',
          message: 'Failed to create program instance'
        }
      }
      
      // PDAs
      const [configPda] = PublicKey.findProgramAddressSync([Buffer.from('config')], programId)
      const [escrowPda] = PublicKey.findProgramAddressSync([Buffer.from('escrow')], programId)
      const [taxPda] = PublicKey.findProgramAddressSync([Buffer.from('tax_state')], programId)
      
      console.log('DeFAI Swap PDAs:', {
        config: configPda.toBase58(),
        escrow: escrowPda.toBase58(),
        taxState: taxPda.toBase58()
      })
      
      // Check if already initialized
      try {
        const configAccount = await program.account.config.fetch(configPda)
        if (configAccount) {
          return {
            program: 'DeFAI Swap',
            status: 'skipped',
            message: 'Already initialized'
          }
        }
      } catch (e) {
        // Not initialized, continue
        console.log('DeFAI Swap not yet initialized, proceeding...')
      }
      
      // Create dummy collection mint
      const collectionMint = Keypair.generate().publicKey
      
      // Initialize with tier prices - FIX: Use anchor.BN for proper encoding
      const tierPrices = [
        new anchor.BN(1_000_000_000),      // 1,000 DEFAI
        new anchor.BN(10_000_000_000),     // 10,000 DEFAI  
        new anchor.BN(500_000_000_000),    // 500,000 DEFAI
        new anchor.BN(1_000_000_000_000),  // 1,000,000 DEFAI
        new anchor.BN(5_000_000_000_000),  // 5,000,000 DEFAI
      ]
      
      console.log('Calling DeFAI Swap initialize with:', {
        admin: this.provider.wallet.publicKey.toBase58(),
        oldMint: defaiMint.toBase58(),
        newMint: rewardsMint.toBase58(),
        collection: collectionMint.toBase58(),
        treasury: this.provider.wallet.publicKey.toBase58(),
        prices: tierPrices.map(p => p.toString())
      })
      
      const tx = await program.methods
        .initialize(tierPrices)
        .accounts({
          admin: this.provider.wallet.publicKey,
          oldMint: defaiMint,
          newMint: rewardsMint,
          collection: collectionMint,
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
        details: { 
          tx,
          configPda: configPda.toBase58() 
        }
      }
    } catch (err: any) {
      console.error('Swap init error:', err)
      return {
        program: 'DeFAI Swap',
        status: 'error',
        message: err.message || err.toString()
      }
    }
  }

  async initializeStaking(defaiMint: PublicKey): Promise<InitializationResult> {
    try {
      const programId = new PublicKey('CvDs2FSKiNAmtdGmY3LaVcCpqAudK3otmrG3ksmUBzpG')
      
      // Check if program is deployed
      const isDeployed = await this.checkProgramDeployment(programId, 'DeFAI Staking')
      if (!isDeployed) {
        return {
          program: 'DeFAI Staking',
          status: 'error',
          message: 'Program not deployed to localnet'
        }
      }

      const program = await this.createProgramInstance(programId, defaiStakingIdl as Idl, 'DeFAI Staking')
      if (!program) {
        return {
          program: 'DeFAI Staking',
          status: 'error',
          message: 'Failed to create program instance - IDL mismatch detected'
        }
      }
      
      // PDAs
      const [programStatePda] = PublicKey.findProgramAddressSync([Buffer.from('program-state')], programId)
      const [stakeVaultPda] = PublicKey.findProgramAddressSync([Buffer.from('stake-vault')], programId)
      
      console.log('DeFAI Staking PDAs:', {
        programState: programStatePda.toBase58(),
        stakeVault: stakeVaultPda.toBase58()
      })
      
      // Check if already initialized
      try {
        const stateAccount = await program.account.programState.fetch(programStatePda)
        if (stateAccount) {
          return {
            program: 'DeFAI Staking',
            status: 'skipped',
            message: 'Already initialized'
          }
        }
      } catch (e) {
        // Not initialized, continue
        console.log('DeFAI Staking not yet initialized, proceeding...')
      }
      
      console.log('Calling DeFAI Staking initializeProgram with:', {
        authority: this.provider.wallet.publicKey.toBase58(),
        defaiMint: defaiMint.toBase58()
      })
      
      // Fix: Only pass defaiMint as argument - the authority is already in accounts
      const tx = await program.methods
        .initializeProgram(defaiMint)
        .accounts({
          programState: programStatePda,
          stakeVault: stakeVaultPda,
          authority: this.provider.wallet.publicKey,
          defaiMint: defaiMint,
          tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY
        })
        .rpc()
      
      return {
        program: 'DeFAI Staking',
        status: 'success',
        message: 'Initialized successfully',
        details: { 
          tx,
          programStatePda: programStatePda.toBase58() 
        }
      }
    } catch (err: any) {
      console.error('Staking init error:', err)
      return {
        program: 'DeFAI Staking',
        status: 'error',
        message: err.message || err.toString()
      }
    }
  }

  async initializeEstate(): Promise<InitializationResult> {
    try {
      const programId = new PublicKey('J8qubfQ5SdvYiJLo5V2mMspZp9as75RePwstVXrtJxo8')
      
      // Check if program is deployed
      const isDeployed = await this.checkProgramDeployment(programId, 'DeFAI Estate')
      if (!isDeployed) {
        return {
          program: 'DeFAI Estate',
          status: 'error',
          message: 'Program not deployed to localnet'
        }
      }

      const program = await this.createProgramInstance(programId, defaiEstateIdl as Idl, 'DeFAI Estate')
      if (!program) {
        return {
          program: 'DeFAI Estate',
          status: 'error',
          message: 'Failed to create program instance - IDL mismatch detected'
        }
      }
      
      // PDAs
      const [globalCounterPda] = PublicKey.findProgramAddressSync([Buffer.from('global-counter')], programId)
      
      console.log('DeFAI Estate PDAs:', {
        globalCounter: globalCounterPda.toBase58()
      })
      
      // Check if already initialized
      try {
        const counterAccount = await program.account.globalCounter.fetch(globalCounterPda)
        if (counterAccount) {
          return {
            program: 'DeFAI Estate',
            status: 'skipped',
            message: 'Already initialized'
          }
        }
      } catch (e) {
        // Not initialized, continue
        console.log('DeFAI Estate not yet initialized, proceeding...')
      }
      
      console.log('Calling DeFAI Estate initializeGlobalCounter with:', {
        admin: this.provider.wallet.publicKey.toBase58()
      })
      
      const tx = await program.methods
        .initializeGlobalCounter()
        .accounts({
          admin: this.provider.wallet.publicKey,
          globalCounter: globalCounterPda,
          systemProgram: SystemProgram.programId
        })
        .rpc()
      
      return {
        program: 'DeFAI Estate',
        status: 'success',
        message: 'Initialized successfully',
        details: { 
          tx,
          globalCounterPda: globalCounterPda.toBase58() 
        }
      }
    } catch (err: any) {
      console.error('Estate init error:', err)
      return {
        program: 'DeFAI Estate',
        status: 'error',
        message: err.message || err.toString()
      }
    }
  }

  async initializeAppFactory(defaiMint: PublicKey): Promise<InitializationResult> {
    try {
      const programId = new PublicKey('4HsYtGADv25mPs1CqicceHK1BuaLhBD66ZFjZ8jnJZr3')
      
      // Check if program is deployed
      const isDeployed = await this.checkProgramDeployment(programId, 'DeFAI App Factory')
      if (!isDeployed) {
        return {
          program: 'DeFAI App Factory',
          status: 'error',
          message: 'Program not deployed to localnet'
        }
      }

      const program = await this.createProgramInstance(programId, defaiAppFactoryIdl as Idl, 'DeFAI App Factory')
      if (!program) {
        return {
          program: 'DeFAI App Factory',
          status: 'error',
          message: 'Failed to create program instance - IDL mismatch detected'
        }
      }
      
      // PDAs
      const [appFactoryPda] = PublicKey.findProgramAddressSync([Buffer.from('app_factory')], programId)
      
      console.log('DeFAI App Factory PDAs:', {
        appFactory: appFactoryPda.toBase58()
      })
      
      // Check if already initialized
      try {
        const factoryAccount = await program.account.appFactory.fetch(appFactoryPda)
        if (factoryAccount) {
          return {
            program: 'DeFAI App Factory',
            status: 'skipped',
            message: 'Already initialized'
          }
        }
      } catch (e) {
        // Not initialized, continue
        console.log('DeFAI App Factory not yet initialized, proceeding...')
      }
      
      // Create a dummy master collection for testing
      const masterCollection = Keypair.generate().publicKey
      
      console.log('Calling DeFAI App Factory initializeAppFactory with:', {
        authority: this.provider.wallet.publicKey.toBase58(),
        defaiMint: defaiMint.toBase58(),
        treasury: this.provider.wallet.publicKey.toBase58(),
        masterCollection: masterCollection.toBase58(),
        platformFeeBps: 2000
      })
      
      const tx = await program.methods
        .initializeAppFactory(2000) // 20% platform fee
        .accounts({
          appFactory: appFactoryPda,
          authority: this.provider.wallet.publicKey,
          defaiMint: defaiMint,
          treasury: this.provider.wallet.publicKey,
          masterCollection: masterCollection,
          systemProgram: SystemProgram.programId
        })
        .rpc()
      
      return {
        program: 'DeFAI App Factory',
        status: 'success',
        message: 'Initialized successfully',
        details: { 
          tx,
          appFactoryPda: appFactoryPda.toBase58() 
        }
      }
    } catch (err: any) {
      console.error('App Factory init error:', err)
      return {
        program: 'DeFAI App Factory',
        status: 'error',
        message: err.message || err.toString()
      }
    }
  }
}