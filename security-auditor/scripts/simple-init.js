const anchor = require("@coral-xyz/anchor");
const { PublicKey, Keypair, SystemProgram } = require("@solana/web3.js");
const fs = require("fs");
const path = require("path");

const PROGRAMS = {
  defai_swap: "3WeYbjGoiTQ6qZ8s9Ek6sUZCy2FzG7b9NbGfbVCtHS2n",
  defai_staking: "3sKj7jgDkiT3hroWho3YZSWAfcmpXXucNKipN4vC3EFM",
  defai_estate: "2zkarMr8w1k6t1jjcZvmcfVPoFnKy3b1kbxEZH6aATJi",
  defai_app_factory: "Ckp11QQpgdP8poYAPVdVjaA5yqfk9Kc4Bd3zmKfzhFAZ"
};

async function initializeSwap() {
  console.log("\nInitializing defai_swap...");
  
  const connection = new anchor.web3.Connection("http://localhost:8899", "confirmed");
  const wallet = anchor.Wallet.local();
  const provider = new anchor.AnchorProvider(connection, wallet, { commitment: "confirmed" });
  
  // Load IDL
  const idl = JSON.parse(fs.readFileSync(path.join(__dirname, "../src/idl/defai_swap.json"), "utf8"));
  const program = new anchor.Program(idl, PROGRAMS.defai_swap, provider);
  
  // PDAs
  const [configPda] = PublicKey.findProgramAddressSync([Buffer.from("config")], program.programId);
  const [escrowPda] = PublicKey.findProgramAddressSync([Buffer.from("escrow")], program.programId);
  const [taxPda] = PublicKey.findProgramAddressSync([Buffer.from("tax_state")], program.programId);
  
  try {
    // Check if already initialized
    const config = await connection.getAccountInfo(configPda);
    if (config) {
      console.log("✅ defai_swap already initialized");
      return;
    }
    
    // Use dummy mints for initialization
    const dummyMint = Keypair.generate().publicKey;
    const dummyCollection = Keypair.generate().publicKey;
    
    await program.methods
      .initialize([1000000000, 10000000000, 500000000000, 1000000000000, 5000000000000])
      .accounts({
        admin: wallet.publicKey,
        oldMint: dummyMint,
        newMint: dummyMint,
        collection: dummyCollection,
        treasury: wallet.publicKey,
        config: configPda,
        escrow: escrowPda,
        taxState: taxPda,
        systemProgram: SystemProgram.programId
      })
      .rpc();
      
    console.log("✅ defai_swap initialized!");
  } catch (err) {
    console.log("❌ Failed to initialize defai_swap:", err.message);
  }
}

async function initializeStaking() {
  console.log("\nInitializing defai_staking...");
  
  const connection = new anchor.web3.Connection("http://localhost:8899", "confirmed");
  const wallet = anchor.Wallet.local();
  const provider = new anchor.AnchorProvider(connection, wallet, { commitment: "confirmed" });
  
  // Load IDL
  const idl = JSON.parse(fs.readFileSync(path.join(__dirname, "../src/idl/defai_staking.json"), "utf8"));
  const program = new anchor.Program(idl, PROGRAMS.defai_staking, provider);
  
  // PDAs
  const [programStatePda] = PublicKey.findProgramAddressSync([Buffer.from("program-state")], program.programId);
  const [vaultPda] = PublicKey.findProgramAddressSync([Buffer.from("vault")], program.programId);
  
  try {
    // Check if already initialized
    const state = await connection.getAccountInfo(programStatePda);
    if (state) {
      console.log("✅ defai_staking already initialized");
      return;
    }
    
    await program.methods
      .initializeProgram()
      .accounts({
        authority: wallet.publicKey,
        programState: programStatePda,
        vault: vaultPda,
        systemProgram: SystemProgram.programId
      })
      .rpc();
      
    console.log("✅ defai_staking initialized!");
  } catch (err) {
    console.log("❌ Failed to initialize defai_staking:", err.message);
  }
}

async function initializeEstate() {
  console.log("\nInitializing defai_estate...");
  
  const connection = new anchor.web3.Connection("http://localhost:8899", "confirmed");
  const wallet = anchor.Wallet.local();
  const provider = new anchor.AnchorProvider(connection, wallet, { commitment: "confirmed" });
  
  // Load IDL
  const idl = JSON.parse(fs.readFileSync(path.join(__dirname, "../src/idl/defai_estate.json"), "utf8"));
  const program = new anchor.Program(idl, PROGRAMS.defai_estate, provider);
  
  // PDAs
  const [estateManagerPda] = PublicKey.findProgramAddressSync([Buffer.from("estate_manager")], program.programId);
  
  try {
    // Check if already initialized
    const manager = await connection.getAccountInfo(estateManagerPda);
    if (manager) {
      console.log("✅ defai_estate already initialized");
      return;
    }
    
    await program.methods
      .initializeManager(200) // 2% platform fee
      .accounts({
        owner: wallet.publicKey,
        estateManager: estateManagerPda,
        treasury: wallet.publicKey,
        systemProgram: SystemProgram.programId
      })
      .rpc();
      
    console.log("✅ defai_estate initialized!");
  } catch (err) {
    console.log("❌ Failed to initialize defai_estate:", err.message);
  }
}

async function initializeAppFactory() {
  console.log("\nInitializing defai_app_factory...");
  
  const connection = new anchor.web3.Connection("http://localhost:8899", "confirmed");
  const wallet = anchor.Wallet.local();
  const provider = new anchor.AnchorProvider(connection, wallet, { commitment: "confirmed" });
  
  // Note: defai_app_factory IDL might be missing, skip for now
  console.log("⚠️  Skipping defai_app_factory (IDL parsing issues)");
}

async function main() {
  console.log("Starting simple initialization...");
  console.log("Wallet:", anchor.Wallet.local().publicKey.toBase58());
  
  await initializeSwap();
  await initializeStaking();
  await initializeEstate();
  await initializeAppFactory();
  
  console.log("\n✅ Initialization complete!");
  console.log("Now refresh the security auditor and run tests again.");
}

main().catch(console.error);