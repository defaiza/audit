import * as anchor from '@coral-xyz/anchor';
import { Program, Idl } from '@coral-xyz/anchor';
import { Connection, PublicKey, Keypair, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import defaiSwapIdl from '@/idl/defai_swap.json';
import defaiStakingIdl from '@/idl/defai_staking.json';
import defaiEstateIdl from '@/idl/defai_estate.json';
import defaiAppFactoryIdl from '@/idl/defai_app_factory.json';
import { PROGRAMS } from './constants';
import { TokenUtils } from './token-utils';

export interface TestConfig {
  connection: Connection;
  wallet: any;
  adminKeypair?: Keypair;
}

export interface ProgramInstance {
  program: Program;
  programId: PublicKey;
  name: string;
}

export interface TestResult {
  test: string;
  program: string;
  status: 'success' | 'failed' | 'error' | 'warning';
  message: string;
  details?: any;
  error?: any;
}

export class UnifiedTestUtils {
  private connection: Connection;
  private provider: anchor.AnchorProvider;
  private programs: Map<string, ProgramInstance> = new Map();
  private tokenUtils?: TokenUtils;
  
  constructor(config: TestConfig) {
    this.connection = config.connection;
    this.provider = new anchor.AnchorProvider(
      config.connection,
      config.wallet,
      {
        commitment: 'confirmed',
        preflightCommitment: 'confirmed',
        skipPreflight: false
      }
    );
    anchor.setProvider(this.provider);
    
    // Initialize token utils if we have an admin keypair
    if (config.adminKeypair) {
      this.tokenUtils = new TokenUtils(this.connection, config.adminKeypair);
    }
  }

  /**
   * Initialize all program instances
   */
  async initializePrograms(): Promise<Map<string, ProgramInstance>> {
    const idlMap = {
      SWAP: defaiSwapIdl,
      STAKING: defaiStakingIdl,
      ESTATE: defaiEstateIdl,
      APP_FACTORY: defaiAppFactoryIdl
    };

    for (const [key, programInfo] of Object.entries(PROGRAMS)) {
      try {
        const programId = new PublicKey(programInfo.programId);
        const idl = idlMap[key as keyof typeof idlMap];
        
        if (!idl) {
          console.error(`No IDL found for ${key}`);
          continue;
        }

        const program = await this.createProgramInstance(programId, idl as Idl, programInfo.name);
        
        if (program) {
          this.programs.set(key, {
            program,
            programId,
            name: programInfo.name
          });
        }
      } catch (error) {
        console.error(`Failed to initialize ${key}:`, error);
      }
    }

    return this.programs;
  }

  /**
   * Create a program instance with proper error handling
   */
  async createProgramInstance(programId: PublicKey, idl: Idl, name: string): Promise<Program | null> {
    try {
      // Use the IDL as-is since it should already have the correct address
      return new Program(idl, programId, this.provider);
    } catch (err: any) {
      console.error(`Error creating ${name} program instance:`, err);
      
      if (err.message?.includes('DeclaredProgramIdMismatch')) {
        console.error(`Program ID mismatch for ${name}:`);
        console.error(`  Expected (from IDL): ${(idl as any).address}`);
        console.error(`  Provided: ${programId.toBase58()}`);
        
        // If the IDL has the wrong address, try updating it
        try {
          const idlCopy = JSON.parse(JSON.stringify(idl));
          idlCopy.address = programId.toBase58();
          if (idlCopy.metadata) {
            idlCopy.metadata.address = programId.toBase58();
          }
          return new Program(idlCopy as Idl, programId, this.provider);
        } catch (retryErr) {
          console.error(`Retry failed for ${name}:`, retryErr);
          return null;
        }
      }
      
      return null;
    }
  }

  /**
   * Check if a program is deployed
   */
  async isProgramDeployed(programId: PublicKey): Promise<boolean> {
    try {
      const accountInfo = await this.connection.getAccountInfo(programId);
      return accountInfo !== null && accountInfo.executable;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check deployment status of all programs
   */
  async checkAllProgramsDeployed(): Promise<Record<string, boolean>> {
    const status: Record<string, boolean> = {};
    
    for (const [key, programInfo] of Object.entries(PROGRAMS)) {
      const programId = new PublicKey(programInfo.programId);
      status[key] = await this.isProgramDeployed(programId);
    }
    
    return status;
  }

  /**
   * Initialize a specific program's state
   */
  async initializeProgramState(programKey: string): Promise<TestResult> {
    const programInstance = this.programs.get(programKey);
    
    if (!programInstance) {
      return {
        test: 'Initialize Program State',
        program: programKey,
        status: 'error',
        message: 'Program instance not found'
      };
    }

    try {
      switch (programKey) {
        case 'SWAP':
          return await this.initializeSwap(programInstance);
        case 'STAKING':
          return await this.initializeStaking(programInstance);
        case 'ESTATE':
          return await this.initializeEstate(programInstance);
        case 'APP_FACTORY':
          return await this.initializeAppFactory(programInstance);
        default:
          return {
            test: 'Initialize Program State',
            program: programKey,
            status: 'error',
            message: 'Unknown program type'
          };
      }
    } catch (error: any) {
      return {
        test: 'Initialize Program State',
        program: programKey,
        status: 'error',
        message: error.message,
        error
      };
    }
  }

  private async initializeSwap(programInstance: ProgramInstance): Promise<TestResult> {
    const { program, programId } = programInstance;
    
    // PDAs
    const [configPda] = PublicKey.findProgramAddressSync([Buffer.from('config')], programId);
    const [escrowPda] = PublicKey.findProgramAddressSync([Buffer.from('escrow')], programId);
    const [taxStatePda] = PublicKey.findProgramAddressSync([Buffer.from('tax_state')], programId);
    
    // Check if already initialized
    try {
      const config = await program.account.config.fetch(configPda);
      if (config) {
        return {
          test: 'Initialize Swap',
          program: 'SWAP',
          status: 'warning',
          message: 'Already initialized',
          details: { config }
        };
      }
    } catch (e) {
      // Not initialized, continue
    }

    // Create real tokens for testing
    if (!this.tokenUtils) {
      throw new Error('TokenUtils not initialized - admin keypair required');
    }
    
    const oldMint = await this.tokenUtils.createMint();
    const newMint = await this.tokenUtils.createMint();
    const collection = await this.tokenUtils.createCollectionMint();
    const treasury = this.provider.wallet.publicKey; // Use admin as treasury for testing
    
    // Initial tier prices (Tier 0, 1, 2, 3)
    const prices = [
      new anchor.BN(69000000), // 69 SOL
      new anchor.BN(42000000), // 42 SOL
      new anchor.BN(21000000), // 21 SOL
      new anchor.BN(10000000)  // 10 SOL
    ];

    // Initialize
    const tx = await program.methods
      .initialize(prices)
      .accounts({
        admin: this.provider.wallet.publicKey,
        oldMint,
        newMint,
        collection,
        treasury,
        config: configPda,
        escrow: escrowPda,
        taxState: taxStatePda,
        systemProgram: SystemProgram.programId
      })
      .rpc();

    return {
      test: 'Initialize Swap',
      program: 'SWAP',
      status: 'success',
      message: 'Swap program initialized',
      details: { tx, configPda: configPda.toBase58() }
    };
  }

  private async initializeStaking(programInstance: ProgramInstance): Promise<TestResult> {
    const { program, programId } = programInstance;
    
    // PDAs
    const [programStatePda] = PublicKey.findProgramAddressSync([Buffer.from('program-state')], programId);
    const [rewardEscrowPda] = PublicKey.findProgramAddressSync([Buffer.from('reward-escrow')], programId);
    
    // Check if already initialized
    try {
      const programState = await program.account.programState.fetch(programStatePda);
      if (programState) {
        return {
          test: 'Initialize Staking',
          program: 'STAKING',
          status: 'warning',
          message: 'Already initialized',
          details: { programState }
        };
      }
    } catch (e) {
      // Not initialized, continue
    }

    // Create real DEFAI token for testing
    if (!this.tokenUtils) {
      throw new Error('TokenUtils not initialized - admin keypair required');
    }
    const defaiMint = await this.tokenUtils.createMint();
    
    // PDAs for staking vault 
    const [stakeVaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('stake_vault')],
      programId
    );
    
    // Initialize
    const tx = await program.methods
      .initializeProgram()
      .accounts({
        programState: programStatePda,
        stakeVault: stakeVaultPda,
        defaiMint,
        authority: this.provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
        tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY
      })
      .rpc();

    return {
      test: 'Initialize Staking',
      program: 'STAKING',
      status: 'success',
      message: 'Staking program initialized',
      details: { tx, programStatePda: programStatePda.toBase58() }
    };
  }

  private async initializeEstate(programInstance: ProgramInstance): Promise<TestResult> {
    const { program, programId } = programInstance;
    
    // PDAs
    const [globalCounterPda] = PublicKey.findProgramAddressSync([Buffer.from('global-counter')], programId);
    
    // Check if already initialized
    try {
      const counter = await program.account.globalCounter.fetch(globalCounterPda);
      if (counter) {
        return {
          test: 'Initialize Estate',
          program: 'ESTATE',
          status: 'warning',
          message: 'Already initialized',
          details: { counter }
        };
      }
    } catch (e) {
      // Not initialized, continue
    }

    // Initialize
    const tx = await program.methods
      .initializeGlobalCounter()
      .accounts({
        admin: this.provider.wallet.publicKey,
        globalCounter: globalCounterPda,
        systemProgram: SystemProgram.programId
      })
      .rpc();

    return {
      test: 'Initialize Estate',
      program: 'ESTATE',
      status: 'success',
      message: 'Estate program initialized',
      details: { tx, globalCounterPda: globalCounterPda.toBase58() }
    };
  }

  private async initializeAppFactory(programInstance: ProgramInstance): Promise<TestResult> {
    const { program, programId } = programInstance;
    
    // PDAs
    const [appFactoryPda] = PublicKey.findProgramAddressSync([Buffer.from('app_factory')], programId);
    
    // Check if already initialized
    try {
      const appFactory = await program.account.appFactory.fetch(appFactoryPda);
      if (appFactory) {
        return {
          test: 'Initialize App Factory',
          program: 'APP_FACTORY',
          status: 'warning',
          message: 'Already initialized',
          details: { appFactory }
        };
      }
    } catch (e) {
      // Not initialized, continue
    }

    // Platform fee basis points (3% = 300 bps)
    const platformFeeBps = 300;
    
    // Create real tokens/accounts for testing  
    if (!this.tokenUtils) {
      throw new Error('TokenUtils not initialized - admin keypair required');
    }
    const defaiMint = await this.tokenUtils.createMint();
    const treasury = this.provider.wallet.publicKey; // Use admin as treasury
    const masterCollection = await this.tokenUtils.createCollectionMint();
    
    // Initialize
    const tx = await program.methods
      .initializeAppFactory(platformFeeBps)
      .accounts({
        appFactory: appFactoryPda,
        authority: this.provider.wallet.publicKey,
        defaiMint,
        treasury,
        masterCollection,
        systemProgram: SystemProgram.programId
      })
      .rpc();

    return {
      test: 'Initialize App Factory',
      program: 'APP_FACTORY',
      status: 'success',
      message: 'App Factory program initialized',
      details: { tx, appFactoryPda: appFactoryPda.toBase58() }
    };
  }

  /**
   * Fund a wallet with SOL
   */
  async fundWallet(wallet: PublicKey, amount: number = 2): Promise<string> {
    const tx = await this.connection.requestAirdrop(wallet, amount * LAMPORTS_PER_SOL);
    await this.connection.confirmTransaction(tx);
    return tx;
  }

  /**
   * Get wallet balance
   */
  async getBalance(wallet: PublicKey): Promise<number> {
    const balance = await this.connection.getBalance(wallet);
    return balance / LAMPORTS_PER_SOL;
  }

  /**
   * Get program accounts for analysis
   */
  async getProgramAccounts(programKey: string): Promise<any[]> {
    const programInfo = PROGRAMS[programKey as keyof typeof PROGRAMS];
    if (!programInfo) return [];
    
    try {
      const programId = new PublicKey(programInfo.programId);
      const accounts = await this.connection.getProgramAccounts(programId);
      return [...accounts]; // Create a mutable copy
    } catch (error) {
      console.error(`Failed to get accounts for ${programKey}:`, error);
      return [];
    }
  }

  getPrograms(): Map<string, ProgramInstance> {
    return this.programs;
  }
} 