import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram, Keypair } from "@solana/web3.js";
import { createMint, getMint, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";

// Platform configuration
const PLATFORM_CONFIG = {
  platformFeeBps: 2000,  // 20% platform fee
  treasuryWallet: null as PublicKey | null,  // Will use wallet.publicKey if null
};

// Example app configuration (for demonstration)
const EXAMPLE_APP = {
  price: new BN(100).mul(new BN(10).pow(new BN(6))),     // 100 DEFAI
  maxSupply: new BN(1000),                               // 1000 licenses
  metadataUri: "ipfs://QmExampleAppMetadata",            // Replace with actual IPFS URI
  name: "Example DeFAI App",
  symbol: "EXAPP",
};

export async function initializeDefaiAppFactory() {
  // Setup
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  
  // Load IDL
  const idl = JSON.parse(
    require("fs").readFileSync("target/idl/defai_app_factory.json", "utf8")
  );
  
  const programId = new PublicKey("4HsYtGADv25mPs1CqicceHK1BuaLhBD66ZFjZ8jnJZr3"); // Update with your program ID
  const program = new anchor.Program(idl, programId, provider);
  const wallet = provider.wallet;
  
  console.log("Initializing DEFAI App Factory Program...");
  console.log("Program ID:", program.programId.toString());
  console.log("Wallet:", wallet.publicKey.toString());
  
  // Token mints (replace with actual addresses)
  const defaiMint = new PublicKey("11111111111111111111111111111111"); // Replace with actual DEFAI mint
  const masterCollectionMint = new PublicKey("11111111111111111111111111111111"); // Replace with "DEFAI APPs" collection mint
  const treasuryWallet = PLATFORM_CONFIG.treasuryWallet || wallet.publicKey;
  
  // Derive PDAs
  const [appFactoryPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("app_factory")],
    program.programId
  );
  
  try {
    // Step 1: Initialize app factory
    console.log("\n1. Initializing app factory...");
    
    try {
      const initTx = await program.methods
        .initializeAppFactory(PLATFORM_CONFIG.platformFeeBps)
        .accounts({
          appFactory: appFactoryPDA,
          authority: wallet.publicKey,
          defaiMint: defaiMint,
          treasury: treasuryWallet,
          masterCollection: masterCollectionMint,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      
      console.log("App factory initialized. Tx:", initTx);
      await provider.connection.confirmTransaction(initTx, "confirmed");
    } catch (e) {
      console.log("App factory may already be initialized");
    }
    
    // Fetch app factory state
    const appFactory = await program.account.appFactory.fetch(appFactoryPDA) as any;
    
    console.log("\n✅ DEFAI App Factory initialization complete!");
    console.log("\nApp Factory Details:");
    console.log("- Authority:", appFactory.authority.toString());
    console.log("- DEFAI Mint:", appFactory.defaiMint.toString());
    console.log("- Treasury:", appFactory.treasury.toString());
    console.log("- Master Collection:", appFactory.masterCollection.toString());
    console.log("- Platform Fee:", appFactory.platformFeeBps / 100, "%");
    console.log("- Total Apps:", appFactory.totalApps.toString());
    
    console.log("\nProgram addresses:");
    console.log("- App Factory PDA:", appFactoryPDA.toString());
    
    // Step 2: Create example app (optional)
    console.log("\n2. Creating example app registration...");
    console.log("⚠️  This requires creating an SFT mint first. Skipping for now.");
    
    console.log("\n📝 To register an app:");
    console.log("1. Create an SFT mint for your app");
    console.log("2. Call registerApp() with:");
    console.log("   - Price in DEFAI (with 6 decimals)");
    console.log("   - Max supply of licenses");
    console.log("   - Metadata URI (IPFS recommended)");
    console.log("3. Users can then purchase access with purchaseAppAccessV2()");
    
    console.log("\n⚠️  IMPORTANT: Replace the following before running:");
    console.log("1. Update defaiMint with actual DEFAI token mint");
    console.log("2. Update masterCollectionMint with actual collection mint");
    console.log("3. Optionally set a different treasury wallet");
    console.log("4. Create SFT mints for each app before registering");
    
    // Example: How to register an app (commented out - requires SFT mint)
    /*
    const appId = appFactory.totalApps;
    const sftMint = Keypair.generate(); // In reality, create this properly
    
    const [appRegistrationPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("app_registration"), appId.toArrayLike(Buffer, "le", 8)],
      program.programId
    );
    
    const registerTx = await program.methods
      .registerApp(
        EXAMPLE_APP.price,
        EXAMPLE_APP.maxSupply,
        EXAMPLE_APP.metadataUri
      )
      .accounts({
        appFactory: appFactoryPDA,
        appRegistration: appRegistrationPDA,
        sftMint: sftMint.publicKey,
        creator: wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    */
    
  } catch (error) {
    console.error("Error initializing DEFAI App Factory:", error);
    throw error;
  }
}

// Helper function to create app registration after factory init
export async function registerApp(
  program: anchor.Program,
  sftMint: PublicKey,
  price: BN,
  maxSupply: BN,
  metadataUri: string
) {
  const provider = anchor.AnchorProvider.env();
  const wallet = provider.wallet;
  
  const [appFactoryPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("app_factory")],
    program.programId
  );
  
  // Get current app count
  const appFactory = await program.account.appFactory.fetch(appFactoryPDA) as any;
  const appId = appFactory.totalApps;
  
  const [appRegistrationPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("app_registration"), appId.toArrayLike(Buffer, "le", 8)],
    program.programId
  );
  
  const registerTx = await program.methods
    .registerApp(price, maxSupply, metadataUri)
    .accounts({
      appFactory: appFactoryPDA,
      appRegistration: appRegistrationPDA,
      sftMint: sftMint,
      creator: wallet.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
  
  console.log("App registered successfully!");
  console.log("- App ID:", appId.toString());
  console.log("- SFT Mint:", sftMint.toString());
  console.log("- Price:", price.div(new BN(10).pow(new BN(6))).toString(), "DEFAI");
  console.log("- Max Supply:", maxSupply.toString());
  console.log("- Tx:", registerTx);
  
  return { appId, appRegistrationPDA, tx: registerTx };
}

// Run initialization if called directly
if (require.main === module) {
  initializeDefaiAppFactory().catch(console.error);
} 