const anchor = require("@coral-xyz/anchor");
const { PublicKey, Keypair, SystemProgram, Transaction, sendAndConfirmTransaction } = require("@solana/web3.js");
const { 
  createMint, 
  getOrCreateAssociatedTokenAccount, 
  mintTo,
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  createInitializeMintInstruction,
  getMintLen,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddress
} = require("@solana/spl-token");

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

  console.log("Initializing programs on localnet...");
  console.log("Wallet:", wallet.publicKey.toBase58());

  // Initialize defai_swap
  console.log("\n1. Checking defai_swap...");
  try {
    const swapProgramId = new PublicKey(PROGRAMS.defai_swap);
    const [configPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("config")],
      swapProgramId
    );
    
    const configAccount = await connection.getAccountInfo(configPda);
    if (!configAccount) {
      console.log("❌ defai_swap needs initialization (config PDA not found)");
      console.log("   Run the full initialization script to set up the program");
    } else {
      console.log("✅ defai_swap config found at:", configPda.toBase58());
    }
  } catch (err) {
    console.log("❌ Failed to check defai_swap:", err.message);
  }

  // Check defai_staking
  console.log("\n2. Checking defai_staking...");
  try {
    const stakingProgramId = new PublicKey(PROGRAMS.defai_staking);
    const [programStatePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("program-state")],
      stakingProgramId
    );
    
    const programStateAccount = await connection.getAccountInfo(programStatePda);
    if (!programStateAccount) {
      console.log("❌ defai_staking needs initialization (program-state PDA not found)");
    } else {
      console.log("✅ defai_staking program state found at:", programStatePda.toBase58());
    }
  } catch (err) {
    console.log("❌ Failed to check defai_staking:", err.message);
  }

  // Check defai_estate
  console.log("\n3. Checking defai_estate...");
  try {
    const estateProgramId = new PublicKey(PROGRAMS.defai_estate);
    const [estateManagerPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("estate_manager")],
      estateProgramId
    );
    
    const estateManagerAccount = await connection.getAccountInfo(estateManagerPda);
    if (!estateManagerAccount) {
      console.log("❌ defai_estate needs initialization (estate_manager PDA not found)");
    } else {
      console.log("✅ defai_estate manager found at:", estateManagerPda.toBase58());
    }
  } catch (err) {
    console.log("❌ Failed to check defai_estate:", err.message);
  }

  // Check defai_app_factory
  console.log("\n4. Checking defai_app_factory...");
  try {
    const appFactoryProgramId = new PublicKey(PROGRAMS.defai_app_factory);
    const [appFactoryPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("app_factory")],
      appFactoryProgramId
    );
    
    const appFactoryAccount = await connection.getAccountInfo(appFactoryPda);
    if (!appFactoryAccount) {
      console.log("❌ defai_app_factory needs initialization (app_factory PDA not found)");
    } else {
      console.log("✅ defai_app_factory found at:", appFactoryPda.toBase58());
    }
  } catch (err) {
    console.log("❌ Failed to check defai_app_factory:", err.message);
  }

  console.log("\n📋 Summary:");
  console.log("To run tests successfully, the programs need to be initialized.");
  console.log("The initialization requires creating token mints and setting up program accounts.");
  console.log("\nNext steps:");
  console.log("1. Use the existing initializeAll.js script for full setup");
  console.log("2. Or create minimal test accounts for each program");
}

main().catch(console.error);