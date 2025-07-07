import { Connection, Keypair, PublicKey, Transaction, SystemProgram } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';
import { TestEnvironment } from '../test-infrastructure';
import { PROGRAMS } from '../constants';

export class AppFactoryAttacks {
  private environment: TestEnvironment;
  private connection: Connection;
  private program: anchor.Program;

  constructor(environment: TestEnvironment) {
    this.environment = environment;
    this.connection = environment.connection;
    
    // Load app factory program
    const provider = new anchor.AnchorProvider(
      this.connection,
      new anchor.Wallet(environment.admin.keypair),
      { commitment: 'confirmed' }
    );
    anchor.setProvider(provider);
    
    // Create program instance from IDL
    const idl = require('../../idl/defai_app_factory.json');
    this.program = new anchor.Program(idl, PROGRAMS.APP_FACTORY.programId, provider);
  }

  async maliciousDeploymentAttack(): Promise<{
    success: boolean;
    impact: string;
    computeUnits: number;
    details: any;
  }> {
    console.log('🎯 Testing malicious deployment attack...');
    
    const startTime = Date.now();
    let totalComputeUnits = 0;
    
    try {
      const results = [];
      
      // Try to deploy app with malicious metadata
      try {
        const appId = new anchor.BN(Date.now());
        const [appPda] = PublicKey.findProgramAddressSync(
          [
            Buffer.from('app'),
            this.environment.attacker.publicKey.toBuffer(),
            appId.toArrayLike(Buffer, 'le', 8)
          ],
          this.program.programId
        );

        const maliciousMetadata = {
          name: 'Legitimate App',
          description: '<script>alert("XSS")</script>',
          url: 'https://malicious-site.com',
          price: new anchor.BN(1000000), // High price
          category: 'PHISHING',
        };

        const deployTx = await this.program.methods
          .registerApp(
            appId,
            maliciousMetadata.name,
            maliciousMetadata.description,
            maliciousMetadata.url,
            maliciousMetadata.price
          )
          .accounts({
            creator: this.environment.attacker.publicKey,
            app: appPda,
            systemProgram: SystemProgram.programId,
            tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
            rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          })
          .signers([this.environment.attacker.keypair])
          .rpc();
          
        results.push({ action: 'deploy_malicious_app', success: true, tx: deployTx });
      } catch (e: any) {
        results.push({ action: 'deploy_malicious_app', success: false, error: e.message });
      }

      // Try to deploy app impersonating another creator
      try {
        const fakeAppId = new anchor.BN(Date.now() + 1);
        const [fakeAppPda] = PublicKey.findProgramAddressSync(
          [
            Buffer.from('app'),
            this.environment.victim.publicKey.toBuffer(), // Victim's key
            fakeAppId.toArrayLike(Buffer, 'le', 8)
          ],
          this.program.programId
        );

        const impersonateTx = await this.program.methods
          .registerApp(
            fakeAppId,
            'Victims App',
            'Impersonated app',
            'https://fake.com',
            new anchor.BN(0)
          )
          .accounts({
            creator: this.environment.attacker.publicKey, // Attacker signing
            app: fakeAppPda,
            systemProgram: SystemProgram.programId,
            tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
            rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          })
          .signers([this.environment.attacker.keypair])
          .rpc();
          
        results.push({ action: 'impersonate_creator', success: true, tx: impersonateTx });
      } catch (e: any) {
        results.push({ action: 'impersonate_creator', success: false, error: e.message });
      }

      // Try to deploy with overflow price
      try {
        const overflowAppId = new anchor.BN(Date.now() + 2);
        const maxU64 = new anchor.BN('18446744073709551615'); // 2^64 - 1
        
        const overflowTx = await this.program.methods
          .registerApp(
            overflowAppId,
            'Overflow App',
            'Price overflow attempt',
            'https://overflow.com',
            maxU64
          )
          .accounts({
            creator: this.environment.attacker.publicKey,
            app: Keypair.generate().publicKey,
            systemProgram: SystemProgram.programId,
            tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
            rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          })
          .signers([this.environment.attacker.keypair])
          .rpc();
          
        results.push({ action: 'overflow_price', success: true, tx: overflowTx });
      } catch (e: any) {
        results.push({ action: 'overflow_price', success: false, error: e.message });
      }

      const executionTime = Date.now() - startTime;
      const computeUnits = totalComputeUnits || 50000;

      const successfulDeployments = results.filter(r => r.success).length;
      
      return {
        success: successfulDeployments > 0,
        impact: successfulDeployments > 0 ? 'HIGH - Malicious apps can be deployed' : 'NONE - App validation working',
        computeUnits,
        details: {
          results,
          vulnerability: successfulDeployments > 0 ? 'Insufficient app metadata validation' : 'Proper app registration checks',
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
          type: 'malicious_deployment',
          executionTimeMs: executionTime,
        },
      };
    }
  }

  async purchaseBypassAttack(): Promise<{
    success: boolean;
    impact: string;
    computeUnits: number;
    details: any;
  }> {
    console.log('🎯 Testing purchase bypass attack...');
    
    const startTime = Date.now();
    let totalComputeUnits = 0;
    
    try {
      const results = [];
      
      // First create a legitimate app
      const appId = new anchor.BN(Date.now() + 100);
      const appPrice = new anchor.BN(1000000); // 1 token
      
      const [appPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from('app'),
          this.environment.victim.publicKey.toBuffer(),
          appId.toArrayLike(Buffer, 'le', 8)
        ],
        this.program.programId
      );

      try {
        const createAppTx = await this.program.methods
          .registerApp(
            appId,
            'Premium App',
            'Expensive app',
            'https://premium.com',
            appPrice
          )
          .accounts({
            creator: this.environment.victim.publicKey,
            app: appPda,
            systemProgram: SystemProgram.programId,
            tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
            rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          })
          .signers([this.environment.victim.keypair])
          .rpc();
          
        results.push({ action: 'create_premium_app', success: true, tx: createAppTx });
      } catch (e: any) {
        results.push({ action: 'create_premium_app', success: false, error: e.message });
      }

      // Try to purchase without payment
      try {
        const [purchasePda] = PublicKey.findProgramAddressSync(
          [
            Buffer.from('purchase'),
            this.environment.attacker.publicKey.toBuffer(),
            appPda.toBuffer()
          ],
          this.program.programId
        );

        const bypassTx = await this.program.methods
          .purchaseApp(appId)
          .accounts({
            buyer: this.environment.attacker.publicKey,
            app: appPda,
            purchase: purchasePda,
            buyerTokenAccount: this.environment.attacker.tokenAccount!,
            creatorTokenAccount: this.environment.victim.tokenAccount!,
            systemProgram: SystemProgram.programId,
            tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
          })
          .signers([this.environment.attacker.keypair])
          .preInstructions([
            // Try to bypass payment by not having enough balance
          ])
          .rpc();
          
        results.push({ action: 'bypass_payment', success: true, tx: bypassTx });
      } catch (e: any) {
        results.push({ action: 'bypass_payment', success: false, error: e.message });
      }

      // Try to purchase with underflow amount
      try {
        const underflowAmount = new anchor.BN(-1);
        
        const underflowTx = await this.program.methods
          .purchaseAppWithAmount(appId, underflowAmount)
          .accounts({
            buyer: this.environment.attacker.publicKey,
            app: appPda,
            purchase: Keypair.generate().publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([this.environment.attacker.keypair])
          .rpc();
          
        results.push({ action: 'underflow_payment', success: true, tx: underflowTx });
      } catch (e: any) {
        results.push({ action: 'underflow_payment', success: false, error: e.message });
      }

      // Try to create fake purchase record
      try {
        const fakePurchaseTx = await this.program.methods
          .recordPurchase(appId, this.environment.attacker.publicKey)
          .accounts({
            authority: this.environment.attacker.publicKey, // Not authorized
            app: appPda,
            systemProgram: SystemProgram.programId,
          })
          .signers([this.environment.attacker.keypair])
          .rpc();
          
        results.push({ action: 'fake_purchase_record', success: true, tx: fakePurchaseTx });
      } catch (e: any) {
        results.push({ action: 'fake_purchase_record', success: false, error: e.message });
      }

      const executionTime = Date.now() - startTime;
      const computeUnits = totalComputeUnits || 50000;

      const successfulBypasses = results.filter(r => 
        r.action !== 'create_premium_app' && r.success
      ).length;
      
      return {
        success: successfulBypasses > 0,
        impact: successfulBypasses > 0 ? 'CRITICAL - Purchase validation bypassed' : 'NONE - Purchase validation secure',
        computeUnits,
        details: {
          results,
          vulnerability: successfulBypasses > 0 ? 'Purchase flow can be circumvented' : 'Proper payment validation',
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
          type: 'purchase_bypass',
          executionTimeMs: executionTime,
        },
      };
    }
  }

  async monetizationManipulationAttack(): Promise<{
    success: boolean;
    impact: string;
    computeUnits: number;
    details: any;
  }> {
    console.log('🎯 Testing monetization manipulation attack...');
    
    const startTime = Date.now();
    let totalComputeUnits = 0;
    
    try {
      const results = [];
      const appId = new anchor.BN(Date.now() + 200);
      
      // Try to manipulate usage tracking
      try {
        const [appPda] = PublicKey.findProgramAddressSync(
          [
            Buffer.from('app'),
            this.environment.victim.publicKey.toBuffer(),
            appId.toArrayLike(Buffer, 'le', 8)
          ],
          this.program.programId
        );

        // Attempt to inflate usage count
        const inflateUsageTx = await this.program.methods
          .trackUsage(appId, new anchor.BN(1000000))
          .accounts({
            user: this.environment.attacker.publicKey,
            app: appPda,
            systemProgram: SystemProgram.programId,
          })
          .signers([this.environment.attacker.keypair])
          .rpc();
          
        results.push({ action: 'inflate_usage', success: true, tx: inflateUsageTx });
      } catch (e: any) {
        results.push({ action: 'inflate_usage', success: false, error: e.message });
      }

      // Try to withdraw creator fees without authorization
      try {
        const withdrawTx = await this.program.methods
          .withdrawCreatorFees(appId)
          .accounts({
            creator: this.environment.attacker.publicKey, // Not the creator
            app: Keypair.generate().publicKey,
            creatorTokenAccount: this.environment.attacker.tokenAccount!,
            feeVault: Keypair.generate().publicKey,
            tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
          })
          .signers([this.environment.attacker.keypair])
          .rpc();
          
        results.push({ action: 'unauthorized_withdrawal', success: true, tx: withdrawTx });
      } catch (e: any) {
        results.push({ action: 'unauthorized_withdrawal', success: false, error: e.message });
      }

      // Try to modify app pricing after deployment
      try {
        const newPrice = new anchor.BN(0); // Make it free
        
        const modifyPriceTx = await this.program.methods
          .updateAppPrice(appId, newPrice)
          .accounts({
            creator: this.environment.attacker.publicKey, // Not the creator
            app: Keypair.generate().publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([this.environment.attacker.keypair])
          .rpc();
          
        results.push({ action: 'modify_price', success: true, tx: modifyPriceTx });
      } catch (e: any) {
        results.push({ action: 'modify_price', success: false, error: e.message });
      }

      // Try to manipulate revenue sharing
      try {
        const manipulateRevenueTx = await this.program.methods
          .setRevenueShare(appId, new anchor.BN(100)) // 100% to attacker
          .accounts({
            authority: this.environment.attacker.publicKey,
            app: Keypair.generate().publicKey,
            systemProgram: SystemProgram.programId,
          })
          .signers([this.environment.attacker.keypair])
          .rpc();
          
        results.push({ action: 'manipulate_revenue', success: true, tx: manipulateRevenueTx });
      } catch (e: any) {
        results.push({ action: 'manipulate_revenue', success: false, error: e.message });
      }

      const executionTime = Date.now() - startTime;
      const computeUnits = totalComputeUnits || 50000;

      const successfulManipulations = results.filter(r => r.success).length;
      
      return {
        success: successfulManipulations > 0,
        impact: successfulManipulations > 0 ? 'HIGH - Monetization can be manipulated' : 'NONE - Monetization secure',
        computeUnits,
        details: {
          results,
          vulnerability: successfulManipulations > 0 ? 'Weak monetization controls' : 'Proper monetization security',
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
          type: 'monetization_manipulation',
          executionTimeMs: executionTime,
        },
      };
    }
  }

  async sftMintingAttack(): Promise<{
    success: boolean;
    impact: string;
    computeUnits: number;
    details: any;
  }> {
    console.log('🎯 Testing SFT minting attack...');
    
    const startTime = Date.now();
    let totalComputeUnits = 0;
    
    try {
      const results = [];
      
      // Try to mint unauthorized SFTs
      try {
        const appId = new anchor.BN(Date.now() + 300);
        const sftMint = Keypair.generate();
        
        const mintSftTx = await this.program.methods
          .mintAppSft(appId, new anchor.BN(1000)) // Mint 1000 SFTs
          .accounts({
            minter: this.environment.attacker.publicKey,
            app: Keypair.generate().publicKey,
            sftMint: sftMint.publicKey,
            minterTokenAccount: this.environment.attacker.tokenAccount!,
            systemProgram: SystemProgram.programId,
            tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
            rent: anchor.web3.SYSVAR_RENT_PUBKEY,
          })
          .signers([this.environment.attacker.keypair, sftMint])
          .rpc();
          
        results.push({ action: 'unauthorized_sft_mint', success: true, tx: mintSftTx });
      } catch (e: any) {
        results.push({ action: 'unauthorized_sft_mint', success: false, error: e.message });
      }

      // Try to burn someone else's SFTs
      try {
        const burnTx = await this.program.methods
          .burnSft(new anchor.BN(100))
          .accounts({
            owner: this.environment.attacker.publicKey,
            victimTokenAccount: this.environment.victim.tokenAccount!,
            sftMint: Keypair.generate().publicKey,
            tokenProgram: anchor.utils.token.TOKEN_PROGRAM_ID,
          })
          .signers([this.environment.attacker.keypair])
          .rpc();
          
        results.push({ action: 'burn_others_sft', success: true, tx: burnTx });
      } catch (e: any) {
        results.push({ action: 'burn_others_sft', success: false, error: e.message });
      }

      const executionTime = Date.now() - startTime;
      const computeUnits = totalComputeUnits || 50000;

      const successfulAttacks = results.filter(r => r.success).length;
      
      return {
        success: successfulAttacks > 0,
        impact: successfulAttacks > 0 ? 'CRITICAL - SFT system compromised' : 'NONE - SFT minting secure',
        computeUnits,
        details: {
          results,
          vulnerability: successfulAttacks > 0 ? 'SFT minting lacks authorization' : 'Proper SFT access control',
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
          type: 'sft_minting',
          executionTimeMs: executionTime,
        },
      };
    }
  }

  async runAllAttacks(): Promise<{
    maliciousDeployment: any;
    purchaseBypass: any;
    monetizationManipulation: any;
    sftMinting: any;
  }> {
    console.log('🚀 Running all app factory attacks...\n');
    
    const maliciousDeployment = await this.maliciousDeploymentAttack();
    console.log('✅ Malicious deployment attack complete\n');
    
    const purchaseBypass = await this.purchaseBypassAttack();
    console.log('✅ Purchase bypass attack complete\n');
    
    const monetizationManipulation = await this.monetizationManipulationAttack();
    console.log('✅ Monetization manipulation attack complete\n');
    
    const sftMinting = await this.sftMintingAttack();
    console.log('✅ SFT minting attack complete\n');
    
    return {
      maliciousDeployment,
      purchaseBypass,
      monetizationManipulation,
      sftMinting,
    };
  }
}

// Export factory function
export const createAppFactoryAttacks = (environment: TestEnvironment) => 
  new AppFactoryAttacks(environment); 