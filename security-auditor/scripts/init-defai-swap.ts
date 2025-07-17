import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { PublicKey, Keypair, SystemProgram, SYSVAR_RECENT_BLOCKHASHES_PUBKEY } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction } from "@solana/spl-token";

// Constants
const DECIMALS = 6;
const MULTIPLIER = 10 ** DECIMALS;

// Tier configuration
const TIER_CONFIG = {
  names: ["OG", "Train", "Boat", "Plane", "Rocket"],
  symbols: ["OG", "TRN", "BOT", "PLN", "RKT"],
  prices: [0, 10000 * MULTIPLIER, 20000 * MULTIPLIER, 30000 * MULTIPLIER, 50000 * MULTIPLIER],
  supplies: [1000, 2000, 1500, 1000, 500],
  uriPrefixes: [
    "ipfs://QmOG...",
    "ipfs://QmTrain...",
    "ipfs://QmBoat...",
    "ipfs://QmPlane...",
    "ipfs://QmRocket..."
  ]
};

// Example merkle roots (replace with actual values)
const OG_TIER_0_MERKLE_ROOT = Array(32).fill(0); // Replace with actual merkle root for MAY20DeFAIHOLDERS.csv
const AIRDROP_MERKLE_ROOT = Array(32).fill(0);    // Replace with actual merkle root for 10_1AIR-Sheet1.csv

export async function initializeDefaiSwap() {
  // Setup
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  
  // Use the IDL from the target directory
  const idl = JSON.parse(
    require("fs").readFileSync("target/idl/defai_swap.json", "utf8")
  );
  
  const programId = new PublicKey("877w653ayrjqM6fT5yjCuPuTABo8h7N6ffF3es1HRrxm"); // Update with your program ID
  const program = new anchor.Program(idl, programId, provider);
  const wallet = provider.wallet;
  
  console.log("Initializing DEFAI Swap Program...");
  console.log("Program ID:", program.programId.toString());
  console.log("Wallet:", wallet.publicKey.toString());
  
  // Derive PDAs
  const [configPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    program.programId
  );
  
  const [escrowPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("escrow")],
    program.programId
  );
  
  const [taxStatePDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("tax_state")],
    program.programId
  );
  
  const [collectionConfigPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("collection_config")],
    program.programId
  );
  
  // Token mints (replace with actual addresses)
  const oldDefaiMint = new PublicKey("11111111111111111111111111111111"); // Replace with OLD DEFAI mint
  const newDefaiMint = new PublicKey("11111111111111111111111111111111"); // Replace with NEW DEFAI mint
  const collectionMint = new PublicKey("11111111111111111111111111111111"); // Replace with collection mint
  const treasuryWallet = wallet.publicKey; // Or use a separate treasury wallet
  
  try {
    // Step 1: Initialize main config
    console.log("\n1. Initializing main config...");
    
    const initTx = await program.methods
      .initialize(TIER_CONFIG.prices.slice(1)) // Exclude tier 0 (OG) price
      .accounts({
        admin: wallet.publicKey,
        oldMint: oldDefaiMint,
        newMint: newDefaiMint,
        collection: collectionMint,
        treasury: treasuryWallet,
        config: configPDA,
        escrow: escrowPDA,
        taxState: taxStatePDA,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    
    console.log("Main config initialized. Tx:", initTx);
    
    // Wait for confirmation
    await provider.connection.confirmTransaction(initTx, "confirmed");
    
    // Step 2: Initialize collection config
    console.log("\n2. Initializing collection config...");
    
    const collectionTx = await program.methods
      .initializeCollection(
        TIER_CONFIG.names,
        TIER_CONFIG.symbols,
        TIER_CONFIG.prices as [number, number, number, number, number],
        TIER_CONFIG.supplies as [number, number, number, number, number],
        TIER_CONFIG.uriPrefixes,
        OG_TIER_0_MERKLE_ROOT as any,
        AIRDROP_MERKLE_ROOT as any
      )
      .accounts({
        authority: wallet.publicKey,
        collectionMint: collectionMint,
        treasury: treasuryWallet,
        defaiMint: newDefaiMint,
        oldDefaiMint: oldDefaiMint,
        collectionConfig: collectionConfigPDA,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    
    console.log("Collection config initialized. Tx:", collectionTx);
    
    // Wait for confirmation
    await provider.connection.confirmTransaction(collectionTx, "confirmed");
    
    // Step 3: Create escrow token accounts
    console.log("\n3. Setting up escrow token accounts...");
    
    const escrowOldAta = await getAssociatedTokenAddress(
      oldDefaiMint,
      escrowPDA,
      true
    );
    
    const escrowNewAta = await getAssociatedTokenAddress(
      newDefaiMint,
      escrowPDA,
      true,
      TOKEN_2022_PROGRAM_ID
    );
    
    // Create escrow ATAs if they don't exist
    const escrowAtaTx = new anchor.web3.Transaction();
    
    // Check if old token ATA exists
    const oldAtaInfo = await provider.connection.getAccountInfo(escrowOldAta);
    if (!oldAtaInfo) {
      escrowAtaTx.add(
        createAssociatedTokenAccountInstruction(
          wallet.publicKey,
          escrowOldAta,
          escrowPDA,
          oldDefaiMint
        )
      );
    }
    
    // Check if new token ATA exists
    const newAtaInfo = await provider.connection.getAccountInfo(escrowNewAta);
    if (!newAtaInfo) {
      escrowAtaTx.add(
        createAssociatedTokenAccountInstruction(
          wallet.publicKey,
          escrowNewAta,
          escrowPDA,
          newDefaiMint,
          TOKEN_2022_PROGRAM_ID
        )
      );
    }
    
    if (escrowAtaTx.instructions.length > 0) {
      const escrowAtaTxSig = await provider.sendAndConfirm(escrowAtaTx);
      console.log("Escrow ATAs created. Tx:", escrowAtaTxSig);
    }
    
    // Step 4: Initialize user tax state (example for wallet)
    console.log("\n4. Initializing user tax state...");
    
    const [userTaxPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("user_tax"), wallet.publicKey.toBuffer()],
      program.programId
    );
    
    try {
      const userTaxTx = await program.methods
        .initializeUserTax()
        .accounts({
          user: wallet.publicKey,
          userTaxState: userTaxPDA,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      
      console.log("User tax state initialized. Tx:", userTaxTx);
    } catch (e) {
      console.log("User tax state may already exist");
    }
    
    console.log("\n✅ DEFAI Swap initialization complete!");
    console.log("\nProgram addresses:");
    console.log("- Config PDA:", configPDA.toString());
    console.log("- Escrow PDA:", escrowPDA.toString());
    console.log("- Tax State PDA:", taxStatePDA.toString());
    console.log("- Collection Config PDA:", collectionConfigPDA.toString());
    console.log("- Escrow OLD ATA:", escrowOldAta.toString());
    console.log("- Escrow NEW ATA:", escrowNewAta.toString());
    
    console.log("\n⚠️  IMPORTANT: Replace the following before running:");
    console.log("1. Update oldDefaiMint with actual OLD DEFAI token mint");
    console.log("2. Update newDefaiMint with actual NEW DEFAI token mint");
    console.log("3. Update collectionMint with actual NFT collection mint");
    console.log("4. Update OG_TIER_0_MERKLE_ROOT with actual merkle root from MAY20DeFAIHOLDERS.csv");
    console.log("5. Update AIRDROP_MERKLE_ROOT with actual merkle root from 10_1AIR-Sheet1.csv");
    console.log("6. Update treasuryWallet if using separate treasury");
    
  } catch (error) {
    console.error("Error initializing DEFAI Swap:", error);
    throw error;
  }
}

// Run initialization if called directly
if (require.main === module) {
  initializeDefaiSwap().catch(console.error);
} 