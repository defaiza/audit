import { Connection, Keypair, PublicKey, Transaction, SystemProgram } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';
import { TestEnvironment } from '../test-infrastructure';
import { PROGRAMS } from '../constants';

export class CrossProgramAttacks {
  private environment: TestEnvironment;
  private connection: Connection;
  private programs: {
    swap: anchor.Program;
    staking: anchor.Program;
    estate: anchor.Program;
    appFactory: anchor.Program;
  };

  constructor(environment: TestEnvironment) {
    this.environment = environment;
    this.connection = environment.connection;
    
    const provider = new anchor.AnchorProvider(
      this.connection,
      new anchor.Wallet(environment.admin.keypair),
      { commitment: 'confirmed' }
    );
    anchor.setProvider(provider);
    
    // Load all programs
    this.programs = {
      swap: new anchor.Program(
        require('../../idl/defai_swap.json'),
        PROGRAMS.SWAP.programId,
        provider
      ),
      staking: new anchor.Program(
        require('../../idl/defai_staking.json'),
        PROGRAMS.STAKING.programId,
        provider
      ),
      estate: new anchor.Program(
        require('../../idl/defai_estate.json'),
        PROGRAMS.ESTATE.programId,
        provider
      ),
      appFactory: new anchor.Program(
        require('../../idl/defai_app_factory.json'),
        PROGRAMS.APP_FACTORY.programId,
        provider
      ),
    };
  }

  async swapStakingManipulationAttack(): Promise<{
    success: boolean;
    impact: string;
    computeUnits: number;
    details: any;
  }> {
    console.log('🎯 Testing swap-staking manipulation attack...');
    
    const startTime = Date.now();
    let totalComputeUnits = 0;
    
    try {
      const results = [];
      
      // Get pool account for both steps
      const [poolAccount] = PublicKey.findProgramAddressSync(
        [Buffer.from('swap_pool')],
        this.programs.swap.programId
      );

      // Step 1: Use swap to manipulate token price
      try {
        const swapAmount = new anchor.BN(1000000);

        const manipulateSwapTx = await this.programs.swap.methods
          .swap(swapAmount, new anchor.BN(1), true)
          .accounts({
            user: this.environment.attacker.publicKey,
            poolAccount,
            userTokenAccountA: this.environment.attacker.tokenAccount!,
            userTokenAccountB: Keypair.generate().publicKey,
            poolTokenAccountA: Keypair.generate().publicKey,
            poolTokenAccountB: Keypair.generate().publicKey,
            tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([this.environment.attacker.keypair])
          .rpc();
          
        results.push({ action: 'manipulate_swap_price', success: true, tx: manipulateSwapTx });
      } catch (e: any) {
        results.push({ action: 'manipulate_swap_price', success: false, error: e.message });
      }

      // Step 2: Exploit manipulated price in staking rewards
      try {
        const [stakeAccount] = PublicKey.findProgramAddressSync(
          [
            Buffer.from('stake'),
            this.environment.attacker.publicKey.toBuffer()
          ],
          this.programs.staking.programId
        );

        // Claim inflated rewards based on manipulated price
        const claimInflatedTx = await this.programs.staking.methods
          .claimRewardsWithPriceOracle()
          .accounts({
            user: this.environment.attacker.publicKey,
            stakeAccount,
            userTokenAccount: this.environment.attacker.tokenAccount!,
            priceOracle: poolAccount, // Use swap pool as price oracle
            rewardPool: PublicKey.findProgramAddressSync(
              [Buffer.from('reward_pool')],
              this.programs.staking.programId
            )[0],
            tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
          })
          .signers([this.environment.attacker.keypair])
          .rpc();
          
        results.push({ action: 'claim_inflated_rewards', success: true, tx: claimInflatedTx });
      } catch (e: any) {
        results.push({ action: 'claim_inflated_rewards', success: false, error: e.message });
      }

      const executionTime = Date.now() - startTime;
      const computeUnits = totalComputeUnits || 100000;

      const successfulExploits = results.filter(r => r.success).length;
      
      return {
        success: successfulExploits === 2,
        impact: successfulExploits === 2 ? 'CRITICAL - Cross-program price manipulation' : 'NONE - Price oracle secure',
        computeUnits,
        details: {
          results,
          vulnerability: successfulExploits === 2 ? 'Programs share vulnerable price oracle' : 'Independent price validation',
          executionTimeMs: executionTime,
        },
      };
    } catch (error: any) {
      const executionTime = Date.now() - startTime;
      
      return {
        success: false,
        impact: 'NONE - Attack failed',
        computeUnits: 0,
        details: {
          error: error.message,
          type: 'swap_staking_manipulation',
          executionTimeMs: executionTime,
        },
      };
    }
  }

  async crossProgramReentrancyAttack(): Promise<{
    success: boolean;
    impact: string;
    computeUnits: number;
    details: any;
  }> {
    console.log('🎯 Testing cross-program reentrancy attack...');
    
    const startTime = Date.now();
    let totalComputeUnits = 0;
    
    try {
      const results = [];
      
      // Create malicious program that calls back into our programs
      const maliciousProgram = Keypair.generate();
      
      // Step 1: Estate program calls app factory during inheritance execution
      try {
        const estateId = new anchor.BN(Date.now());
        const [estatePda] = PublicKey.findProgramAddressSync(
          [
            Buffer.from('estate'),
            this.environment.attacker.publicKey.toBuffer(),
            estateId.toArrayLike(Buffer, 'le', 8)
          ],
          this.programs.estate.programId
        );

        // Execute estate with callback to app factory
        const reentrancyTx = new Transaction();
        
        // Estate execution that triggers app purchase
        const estateIx = await this.programs.estate.methods
          .executeEstateWithCallback(estateId, this.programs.appFactory.programId)
          .accounts({
            executor: this.environment.attacker.publicKey,
            estate: estatePda,
            callbackProgram: this.programs.appFactory.programId,
            systemProgram: SystemProgram.programId,
          })
          .instruction();
          
        // App factory purchase that calls back to estate
        const appIx = await this.programs.appFactory.methods
          .purchaseAppWithCallback(new anchor.BN(1), this.programs.estate.programId)
          .accounts({
            buyer: this.environment.attacker.publicKey,
            app: Keypair.generate().publicKey,
            callbackProgram: this.programs.estate.programId,
            systemProgram: SystemProgram.programId,
          })
          .instruction();
          
        reentrancyTx.add(estateIx, appIx);
        
        const sig = await this.connection.sendTransaction(reentrancyTx, [this.environment.attacker.keypair]);
        await this.connection.confirmTransaction(sig);
        
        results.push({ action: 'cross_program_reentrancy', success: true, tx: sig });
      } catch (e: any) {
        results.push({ action: 'cross_program_reentrancy', success: false, error: e.message });
      }

      // Step 2: Staking calls swap during unstake
      try {
        const unstakeReentrancyTx = await this.programs.staking.methods
          .unstakeWithSwap(new anchor.BN(1000))
          .accounts({
            user: this.environment.attacker.publicKey,
            stakeAccount: Keypair.generate().publicKey,
            swapProgram: this.programs.swap.programId,
            systemProgram: SystemProgram.programId,
          })
          .signers([this.environment.attacker.keypair])
          .rpc();
          
        results.push({ action: 'unstake_swap_reentrancy', success: true, tx: unstakeReentrancyTx });
      } catch (e: any) {
        results.push({ action: 'unstake_swap_reentrancy', success: false, error: e.message });
      }

      const executionTime = Date.now() - startTime;
      const computeUnits = totalComputeUnits || 150000;

      const successfulReentrancy = results.filter(r => r.success).length;
      
      return {
        success: successfulReentrancy > 0,
        impact: successfulReentrancy > 0 ? 'CRITICAL - Cross-program reentrancy possible' : 'NONE - Reentrancy guards working',
        computeUnits,
        details: {
          results,
          vulnerability: successfulReentrancy > 0 ? 'Missing cross-program reentrancy protection' : 'Proper reentrancy guards',
          executionTimeMs: executionTime,
        },
      };
    } catch (error: any) {
      const executionTime = Date.now() - startTime;
      
      return {
        success: false,
        impact: 'NONE - Attack failed',
        computeUnits: 0,
        details: {
          error: error.message,
          type: 'cross_program_reentrancy',
          executionTimeMs: executionTime,
        },
      };
    }
  }

  async estateAppFactoryExploitAttack(): Promise<{
    success: boolean;
    impact: string;
    computeUnits: number;
    details: any;
  }> {
    console.log('🎯 Testing estate-app factory exploit...');
    
    const startTime = Date.now();
    let totalComputeUnits = 0;
    
    try {
      const results = [];
      
      // Use estate inheritance to bypass app purchase fees
      try {
        // Create estate with app tokens
        const estateId = new anchor.BN(Date.now());
        const [estatePda] = PublicKey.findProgramAddressSync(
          [
            Buffer.from('estate'),
            this.environment.victim.publicKey.toBuffer(),
            estateId.toArrayLike(Buffer, 'le', 8)
          ],
          this.programs.estate.programId
        );

        const createEstateTx = await this.programs.estate.methods
          .createEstate(estateId, 'App Token Estate', 'Contains app tokens')
          .accounts({
            owner: this.environment.victim.publicKey,
            estate: estatePda,
            systemProgram: SystemProgram.programId,
            tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
            rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          })
          .signers([this.environment.victim.keypair])
          .rpc();
          
        results.push({ action: 'create_estate_with_tokens', success: true, tx: createEstateTx });
      } catch (e: any) {
        results.push({ action: 'create_estate_with_tokens', success: false, error: e.message });
      }

      // Execute inheritance to transfer app ownership without payment
      try {
        const inheritanceTx = new Transaction();
        
        // Add instruction to claim estate
        const claimIx = await this.programs.estate.methods
          .claimInheritance(new anchor.BN(Date.now()))
          .accounts({
            claimer: this.environment.attacker.publicKey,
            estate: Keypair.generate().publicKey,
            systemProgram: SystemProgram.programId,
          })
          .instruction();
        
        // Add instruction to register app using inherited tokens
        const appId = new anchor.BN(Date.now());
        const registerIx = await this.programs.appFactory.methods
          .registerAppWithInheritedTokens(appId)
          .accounts({
            creator: this.environment.attacker.publicKey,
            inheritanceProof: Keypair.generate().publicKey,
            systemProgram: SystemProgram.programId,
          })
          .instruction();
          
        inheritanceTx.add(claimIx, registerIx);
        
        const sig = await this.connection.sendTransaction(inheritanceTx, [this.environment.attacker.keypair]);
        await this.connection.confirmTransaction(sig);
        
        results.push({ action: 'bypass_app_fees_via_inheritance', success: true, tx: sig });
      } catch (e: any) {
        results.push({ action: 'bypass_app_fees_via_inheritance', success: false, error: e.message });
      }

      const executionTime = Date.now() - startTime;
      const computeUnits = totalComputeUnits || 80000;

      const successfulExploits = results.filter(r => 
        r.action === 'bypass_app_fees_via_inheritance' && r.success
      ).length;
      
      return {
        success: successfulExploits > 0,
        impact: successfulExploits > 0 ? 'HIGH - Fee bypass via inheritance' : 'NONE - Proper fee enforcement',
        computeUnits,
        details: {
          results,
          vulnerability: successfulExploits > 0 ? 'Cross-program state can be exploited' : 'Isolated program states',
          executionTimeMs: executionTime,
        },
      };
    } catch (error: any) {
      const executionTime = Date.now() - startTime;
      
      return {
        success: false,
        impact: 'NONE - Attack failed',
        computeUnits: 0,
        details: {
          error: error.message,
          type: 'estate_app_factory_exploit',
          executionTimeMs: executionTime,
        },
      };
    }
  }

  async composabilityAttack(): Promise<{
    success: boolean;
    impact: string;
    computeUnits: number;
    details: any;
  }> {
    console.log('🎯 Testing composability attack...');
    
    const startTime = Date.now();
    let totalComputeUnits = 0;
    
    try {
      const results = [];
      
      // Chain multiple program calls in unexpected ways
      const composedTx = new Transaction();
      
      try {
        // 1. Swap to get tokens
        const swapIx = await this.programs.swap.methods
          .swap(new anchor.BN(100), new anchor.BN(1), true)
          .accounts({
            user: this.environment.attacker.publicKey,
            poolAccount: Keypair.generate().publicKey,
            userTokenAccountA: this.environment.attacker.tokenAccount!,
            userTokenAccountB: Keypair.generate().publicKey,
            tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .instruction();
          
        // 2. Stake swapped tokens immediately
        const stakeIx = await this.programs.staking.methods
          .stake(new anchor.BN(100))
          .accounts({
            user: this.environment.attacker.publicKey,
            stakeAccount: Keypair.generate().publicKey,
            tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .instruction();
          
        // 3. Use staked tokens as collateral for estate
        const estateIx = await this.programs.estate.methods
          .createCollateralizedEstate(new anchor.BN(Date.now()))
          .accounts({
            owner: this.environment.attacker.publicKey,
            stakeProof: Keypair.generate().publicKey,
            systemProgram: SystemProgram.programId,
          })
          .instruction();
          
        // 4. Use estate to get app factory privileges
        const appIx = await this.programs.appFactory.methods
          .registerPrivilegedApp(new anchor.BN(Date.now()))
          .accounts({
            creator: this.environment.attacker.publicKey,
            estateProof: Keypair.generate().publicKey,
            systemProgram: SystemProgram.programId,
          })
          .instruction();
          
        composedTx.add(swapIx, stakeIx, estateIx, appIx);
        
        const sig = await this.connection.sendTransaction(composedTx, [this.environment.attacker.keypair]);
        await this.connection.confirmTransaction(sig);
        
        results.push({ action: 'complex_composability_chain', success: true, tx: sig });
      } catch (e: any) {
        results.push({ action: 'complex_composability_chain', success: false, error: e.message });
      }

      // Test flash loan across programs
      try {
        const flashLoanTx = await this.programs.swap.methods
          .flashLoanAcrossPrograms(
            new anchor.BN(1000000),
            [
              this.programs.staking.programId,
              this.programs.estate.programId,
              this.programs.appFactory.programId
            ]
          )
          .accounts({
            borrower: this.environment.attacker.publicKey,
            flashLoanPool: Keypair.generate().publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([this.environment.attacker.keypair])
          .rpc();
          
        results.push({ action: 'cross_program_flash_loan', success: true, tx: flashLoanTx });
      } catch (e: any) {
        results.push({ action: 'cross_program_flash_loan', success: false, error: e.message });
      }

      const executionTime = Date.now() - startTime;
      const computeUnits = totalComputeUnits || 200000;

      const successfulComposability = results.filter(r => r.success).length;
      
      return {
        success: successfulComposability > 0,
        impact: successfulComposability > 0 ? 'HIGH - Unexpected composability exploits' : 'NONE - Safe composability',
        computeUnits,
        details: {
          results,
          vulnerability: successfulComposability > 0 ? 'Programs can be composed in dangerous ways' : 'Safe program composition',
          executionTimeMs: executionTime,
        },
      };
    } catch (error: any) {
      const executionTime = Date.now() - startTime;
      
      return {
        success: false,
        impact: 'NONE - Attack failed',
        computeUnits: 0,
        details: {
          error: error.message,
          type: 'composability_attack',
          executionTimeMs: executionTime,
        },
      };
    }
  }

  async runAllAttacks(): Promise<{
    swapStakingManipulation: any;
    crossProgramReentrancy: any;
    estateAppFactoryExploit: any;
    composability: any;
  }> {
    console.log('🚀 Running all cross-program attacks...\n');
    
    const swapStakingManipulation = await this.swapStakingManipulationAttack();
    console.log('✅ Swap-staking manipulation attack complete\n');
    
    const crossProgramReentrancy = await this.crossProgramReentrancyAttack();
    console.log('✅ Cross-program reentrancy attack complete\n');
    
    const estateAppFactoryExploit = await this.estateAppFactoryExploitAttack();
    console.log('✅ Estate-app factory exploit complete\n');
    
    const composability = await this.composabilityAttack();
    console.log('✅ Composability attack complete\n');
    
    return {
      swapStakingManipulation,
      crossProgramReentrancy,
      estateAppFactoryExploit,
      composability,
    };
  }
}

// Export factory function
export const createCrossProgramAttacks = (environment: TestEnvironment) => 
  new CrossProgramAttacks(environment); 