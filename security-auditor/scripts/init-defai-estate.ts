import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram, Keypair } from "@solana/web3.js";
import * as crypto from "crypto";

// Example estate configuration
const ESTATE_CONFIG = {
  inactivityPeriod: 365 * 24 * 60 * 60,  // 1 year
  gracePeriod: 30 * 24 * 60 * 60,        // 30 days
  ownerEmail: "owner@example.com",       // Replace with actual email
};

// Example beneficiaries
const BENEFICIARIES = [
  {
    address: "11111111111111111111111111111111", // Replace with actual beneficiary address
    email: "beneficiary1@example.com",
    sharePercentage: 50,
  },
  {
    address: "22222222222222222222222222222222", // Replace with actual beneficiary address  
    email: "beneficiary2@example.com",
    sharePercentage: 50,
  },
];

function hashEmail(email: string): number[] {
  const hash = crypto.createHash('sha256').update(email).digest();
  return Array.from(hash);
}

export async function initializeDefaiEstate() {
  // Setup
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  
  // Load IDL
  const idl = JSON.parse(
    require("fs").readFileSync("target/idl/defai_estate.json", "utf8")
  );
  
  const programId = new PublicKey("DYXXvied9wwpDaE1NcVS56BfeQ4ZxXozft7FCLNVUG41"); // Update with your program ID
  const program = new anchor.Program(idl, programId, provider);
  const wallet = provider.wallet;
  
  console.log("Initializing DEFAI Estate Program...");
  console.log("Program ID:", program.programId.toString());
  console.log("Wallet:", wallet.publicKey.toString());
  
  // Derive PDAs
  const [globalCounterPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("counter")],
    program.programId
  );
  
  try {
    // Step 1: Initialize global counter (one-time)
    console.log("\n1. Initializing global counter...");
    
    try {
      const initCounterTx = await program.methods
        .initializeGlobalCounter()
        .accounts({
          globalCounter: globalCounterPDA,
          authority: wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      
      console.log("Global counter initialized. Tx:", initCounterTx);
      await provider.connection.confirmTransaction(initCounterTx, "confirmed");
    } catch (e) {
      console.log("Global counter may already be initialized");
    }
    
    // Get current estate count
    const globalCounter = await program.account.globalCounter.fetch(globalCounterPDA) as any;
    const estateNumber = globalCounter.count;
    
    // Step 2: Create estate
    console.log("\n2. Creating estate...");
    
    // Generate estate mint (unique identifier)
    const estateMint = Keypair.generate();
    
    // Derive estate PDA
    const [estatePDA] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("estate"),
        wallet.publicKey.toBuffer(),
        new BN(estateNumber).toArrayLike(Buffer, "le", 8)
      ],
      program.programId
    );
    
    // Hash owner email
    const ownerEmailHash = hashEmail(ESTATE_CONFIG.ownerEmail);
    
    const createEstateTx = await program.methods
      .createEstate(
        new BN(ESTATE_CONFIG.inactivityPeriod),
        new BN(ESTATE_CONFIG.gracePeriod),
        ownerEmailHash as any
      )
      .accounts({
        owner: wallet.publicKey,
        estate: estatePDA,
        globalCounter: globalCounterPDA,
        estateMint: estateMint.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    
    console.log("Estate created. Tx:", createEstateTx);
    await provider.connection.confirmTransaction(createEstateTx, "confirmed");
    
    // Step 3: Update beneficiaries
    console.log("\n3. Setting up beneficiaries...");
    
    // Prepare beneficiary data
    const beneficiaryData = BENEFICIARIES.map(b => ({
      address: new PublicKey(b.address),
      emailHash: hashEmail(b.email),
      sharePercentage: b.sharePercentage,
      claimed: false,
      notificationSent: false,
    }));
    
    const updateBeneficiariesTx = await program.methods
      .updateBeneficiaries(beneficiaryData)
      .accounts({
        owner: wallet.publicKey,
        estate: estatePDA,
      })
      .rpc();
    
    console.log("Beneficiaries updated. Tx:", updateBeneficiariesTx);
    await provider.connection.confirmTransaction(updateBeneficiariesTx, "confirmed");
    
    // Fetch and display estate details
    const estate = await program.account.estate.fetch(estatePDA) as any;
    
    console.log("\n✅ DEFAI Estate initialization complete!");
    console.log("\nEstate Details:");
    console.log("- Estate Number:", estate.estateNumber.toString());
    console.log("- Estate ID:", estate.estateId.toString());
    console.log("- Owner:", estate.owner.toString());
    console.log("- Inactivity Period:", estate.inactivityPeriod.toNumber() / (24 * 60 * 60), "days");
    console.log("- Grace Period:", estate.gracePeriod.toNumber() / (24 * 60 * 60), "days");
    console.log("- Last Active:", new Date(estate.lastActive.toNumber() * 1000).toISOString());
    console.log("- Is Locked:", estate.isLocked);
    console.log("- Is Claimable:", estate.isClaimable);
    
    console.log("\nBeneficiaries:");
    estate.beneficiaries.forEach((b: any, i: number) => {
      console.log(`  ${i + 1}. ${b.address.toString()} - ${b.sharePercentage}%`);
    });
    
    console.log("\nProgram addresses:");
    console.log("- Global Counter PDA:", globalCounterPDA.toString());
    console.log("- Estate PDA:", estatePDA.toString());
    console.log("- Estate Mint:", estateMint.publicKey.toString());
    
    console.log("\n📝 Next Steps:");
    console.log("1. Regular check-ins: Call checkIn() to reset the inactivity timer");
    console.log("2. Add RWAs: Use createRwa() to track real-world assets");
    console.log("3. Enable trading: Use enableTrading() for AI-powered trading features");
    console.log("4. Create multi-sig: Use initializeMultisig() for enhanced security");
    
    console.log("\n⚠️  IMPORTANT:");
    console.log("1. Update beneficiary addresses with actual wallet addresses");
    console.log("2. Update email addresses for proper notifications");
    console.log("3. Ensure beneficiary shares sum to 100%");
    console.log("4. Remember to check in regularly to prevent unwanted inheritance triggers");
    console.log("5. The estate will become claimable after", 
      (ESTATE_CONFIG.inactivityPeriod + ESTATE_CONFIG.gracePeriod) / (24 * 60 * 60), 
      "days of inactivity");
    
  } catch (error) {
    console.error("Error initializing DEFAI Estate:", error);
    throw error;
  }
}

// Run initialization if called directly
if (require.main === module) {
  initializeDefaiEstate().catch(console.error);
} 