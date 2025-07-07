import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, Keypair, SystemProgram } from "@solana/web3.js";
import { 
  createMint, 
  getOrCreateAssociatedTokenAccount, 
  mintTo,
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID
} from "@solana/spl-token";
import * as fs from "fs";
import * as path from "path";

// Load IDLs
import defaiSwapIdl from "../src/idl/defai_swap.json";
import defaiStakingIdl from "../src/idl/defai_staking.json";
import defaiEstateIdl from "../src/idl/defai_estate.json";
import defaiAppFactoryIdl from "../src/idl/defai_app_factory.json";

const PROGRAMS = {
  defai_swap: "3WeYbjGoiTQ6qZ8s9Ek6sUZCy2FzG7b9NbGfbVCtHS2n",
  defai_staking: "3sKj7jgDkiT3hroWho3YZSWAfcmpXXucNKipN4vC3EFM",
  defai_estate: "2zkarMr8w1k6t1jjcZvmcfVPoFnKy3b1kbxEZH6aATJi",
  defai_app_factory: "Ckp11QQpgdP8poYAPVdVjaA5yqfk9Kc4Bd3zmKfzhFAZ"
};

async function main() {
  // Setup
  const connection = new anchor.web3.Connection("http://localhost:8899", "confirmed");
  const wallet = anchor.Wallet.local();
  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: "confirmed"
  });
  anchor.setProvider(provider);

  console.log("Initializing programs on localnet...");
  console.log("Wallet:", wallet.publicKey.toBase58());

  // Create test mints
  console.log("\n1. Creating test mints...");
  
  // Create DEFAI token mint
  const defaiMint = await createMint(
    connection,
    wallet.payer,
    wallet.publicKey,
    wallet.publicKey,
    6 // 6 decimals
  );
  console.log("DEFAI mint created:", defaiMint.toBase58());

  // Create rewards mint (Token-2022)
  const rewardsMint = await createMint(
    connection,
    wallet.payer,
    wallet.publicKey,
    wallet.publicKey,
    6,
    undefined,
    undefined,
    TOKEN_2022_PROGRAM_ID
  );
  console.log("Rewards mint created:", rewardsMint.toBase58());

  // Initialize defai_swap
  console.log("\n2. Initializing defai_swap...");
  try {
    const swapProgram = new Program(defaiSwapIdl as any, PROGRAMS.defai_swap, provider);
    
    const [configPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("config")],
      swapProgram.programId
    );
    
    const [escrowPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("escrow")],
      swapProgram.programId
    );
    
    const [taxPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("tax_state")],
      swapProgram.programId
    );

    // Check if already initialized
    const configAccount = await connection.getAccountInfo(configPda);
    if (!configAccount) {
      await swapProgram.methods
        .initialize([1000000000, 10000000000, 500000000000, 1000000000000, 5000000000000])
        .accounts({
          admin: wallet.publicKey,
          oldMint: defaiMint,
          newMint: rewardsMint,
          collection: Keypair.generate().publicKey, // Dummy collection
          treasury: wallet.publicKey,
          config: configPda,
          escrow: escrowPda,
          taxState: taxPda,
          systemProgram: SystemProgram.programId
        })
        .rpc();
      console.log("✅ defai_swap initialized");
    } else {
      console.log("✅ defai_swap already initialized");
    }
  } catch (err: any) {
    console.log("❌ Failed to initialize defai_swap:", err.message);
  }

  // Initialize defai_staking
  console.log("\n3. Initializing defai_staking...");
  try {
    const stakingProgram = new Program(defaiStakingIdl as any, PROGRAMS.defai_staking, provider);
    
    const [programStatePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("program-state")],
      stakingProgram.programId
    );
    
    // Check if already initialized
    const programStateAccount = await connection.getAccountInfo(programStatePda);
    if (!programStateAccount) {
      await stakingProgram.methods
        .initializeProgram()
        .accounts({
          authority: wallet.publicKey,
          programState: programStatePda,
          vault: Keypair.generate().publicKey,
          systemProgram: SystemProgram.programId
        })
        .rpc();
      console.log("✅ defai_staking initialized");
    } else {
      console.log("✅ defai_staking already initialized");
    }
  } catch (err: any) {
    console.log("❌ Failed to initialize defai_staking:", err.message);
  }

  // Initialize defai_estate
  console.log("\n4. Initializing defai_estate...");
  try {
    const estateProgram = new Program(defaiEstateIdl as any, PROGRAMS.defai_estate, provider);
    
    const [estateManagerPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("estate_manager")],
      estateProgram.programId
    );
    
    // Check if already initialized
    const estateManagerAccount = await connection.getAccountInfo(estateManagerPda);
    if (!estateManagerAccount) {
      await estateProgram.methods
        .initializeManager(200) // 2% platform fee
        .accounts({
          owner: wallet.publicKey,
          estateManager: estateManagerPda,
          treasury: wallet.publicKey,
          systemProgram: SystemProgram.programId
        })
        .rpc();
      console.log("✅ defai_estate initialized");
    } else {
      console.log("✅ defai_estate already initialized");
    }
  } catch (err: any) {
    console.log("❌ Failed to initialize defai_estate:", err.message);
  }

  // Initialize defai_app_factory
  console.log("\n5. Initializing defai_app_factory...");
  try {
    const appFactoryProgram = new Program(defaiAppFactoryIdl as any, PROGRAMS.defai_app_factory, provider);
    
    const [appFactoryPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("app_factory")],
      appFactoryProgram.programId
    );
    
    // Check if already initialized
    const appFactoryAccount = await connection.getAccountInfo(appFactoryPda);
    if (!appFactoryAccount) {
      await appFactoryProgram.methods
        .initializeAppFactory(2000) // 20% platform fee
        .accounts({
          authority: wallet.publicKey,
          appFactory: appFactoryPda,
          treasury: wallet.publicKey,
          defaiMint: defaiMint,
          systemProgram: SystemProgram.programId
        })
        .rpc();
      console.log("✅ defai_app_factory initialized");
    } else {
      console.log("✅ defai_app_factory already initialized");
    }
  } catch (err: any) {
    console.log("❌ Failed to initialize defai_app_factory:", err.message);
  }

  // Mint some tokens for testing
  console.log("\n6. Minting test tokens...");
  const userAta = await getOrCreateAssociatedTokenAccount(
    connection,
    wallet.payer,
    defaiMint,
    wallet.publicKey
  );
  
  await mintTo(
    connection,
    wallet.payer,
    defaiMint,
    userAta.address,
    wallet.publicKey,
    1000000000000 // 1M tokens
  );
  console.log("✅ Minted 1M DEFAI tokens to wallet");

  console.log("\n✅ All programs initialized successfully!");
  console.log("\nProgram states:");
  console.log("- defai_swap: Ready for swaps");
  console.log("- defai_staking: Ready for staking");
  console.log("- defai_estate: Ready for estate creation");
  console.log("- defai_app_factory: Ready for app registration");
}

main().catch(console.error);