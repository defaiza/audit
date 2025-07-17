import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction } from "@solana/spl-token";

// Constants
const DECIMALS = 6;
const MULTIPLIER = new BN(10).pow(new BN(DECIMALS));

// Initial funding amount for reward escrow (adjust as needed)
const INITIAL_ESCROW_FUNDING = new BN(1000000).mul(MULTIPLIER); // 1M DEFAI

export async function initializeDefaiStaking() {
  // Setup
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  
  // Load IDL
  const idl = JSON.parse(
    require("fs").readFileSync("target/idl/defai_staking.json", "utf8")
  );
  
  const programId = new PublicKey("CvDs2FSKiNAmtdGmY3LaVcCpqAudK3otmrG3ksmUBzpG"); // Update with your program ID
  const program = new anchor.Program(idl, programId, provider);
  const wallet = provider.wallet;
  
  console.log("Initializing DEFAI Staking Program...");
  console.log("Program ID:", program.programId.toString());
  console.log("Wallet:", wallet.publicKey.toString());
  
  // Token mint (replace with actual DEFAI mint)
  const defaiMint = new PublicKey("11111111111111111111111111111111"); // Replace with actual DEFAI mint
  
  // Derive PDAs
  const [programStatePDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("program-state")],
    program.programId
  );
  
  const [stakeVaultPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("stake-vault"), programStatePDA.toBuffer()],
    program.programId
  );
  
  const [rewardEscrowPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("reward-escrow"), programStatePDA.toBuffer()],
    program.programId
  );
  
  const [escrowVaultPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("escrow-vault"), programStatePDA.toBuffer()],
    program.programId
  );
  
  try {
    // Step 1: Initialize program state
    console.log("\n1. Initializing program state...");
    
    const initTx = await program.methods
      .initializeProgram(defaiMint)
      .accounts({
        programState: programStatePDA,
        stakeVault: stakeVaultPDA,
        authority: wallet.publicKey,
        defaiMint: defaiMint,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .rpc();
    
    console.log("Program state initialized. Tx:", initTx);
    await provider.connection.confirmTransaction(initTx, "confirmed");
    
    // Step 2: Initialize reward escrow
    console.log("\n2. Initializing reward escrow...");
    
    const escrowTx = await program.methods
      .initializeEscrow()
      .accounts({
        programState: programStatePDA,
        rewardEscrow: rewardEscrowPDA,
        escrowTokenAccount: escrowVaultPDA,
        authority: wallet.publicKey,
        defaiMint: defaiMint,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: anchor.web3.SYSVAR_RENT_PUBKEY,
      })
      .rpc();
    
    console.log("Reward escrow initialized. Tx:", escrowTx);
    await provider.connection.confirmTransaction(escrowTx, "confirmed");
    
    // Step 3: Fund reward escrow (optional - requires DEFAI tokens)
    console.log("\n3. Funding reward escrow...");
    
    // Get or create funder's token account
    const funderAta = await getAssociatedTokenAddress(
      defaiMint,
      wallet.publicKey,
      false,
      TOKEN_2022_PROGRAM_ID
    );
    
    // Check if funder has enough balance
    try {
      const funderBalance = await provider.connection.getTokenAccountBalance(funderAta);
      console.log("Funder balance:", funderBalance.value.uiAmount, "DEFAI");
      
      if (funderBalance.value.uiAmount && funderBalance.value.uiAmount > 0) {
        const fundTx = await program.methods
          .fundEscrow(INITIAL_ESCROW_FUNDING)
          .accounts({
            rewardEscrow: rewardEscrowPDA,
            escrowTokenAccount: escrowVaultPDA,
            funderTokenAccount: funderAta,
            funder: wallet.publicKey,
            defaiMint: defaiMint,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
          })
          .rpc();
        
        console.log("Escrow funded with", INITIAL_ESCROW_FUNDING.div(MULTIPLIER).toString(), "DEFAI. Tx:", fundTx);
        await provider.connection.confirmTransaction(fundTx, "confirmed");
      } else {
        console.log("⚠️  Skipping escrow funding - no DEFAI balance");
      }
    } catch (e) {
      console.log("⚠️  Skipping escrow funding - token account not found");
    }
    
    // Fetch and display final state
    const programState = await program.account.programState.fetch(programStatePDA) as any;
    const rewardEscrow = await program.account.rewardEscrow.fetch(rewardEscrowPDA) as any;
    
    console.log("\n✅ DEFAI Staking initialization complete!");
    console.log("\nProgram State:");
    console.log("- Authority:", programState.authority.toString());
    console.log("- DEFAI Mint:", programState.defaiMint.toString());
    console.log("- Total Staked:", programState.totalStaked.toString());
    console.log("- Total Users:", programState.totalUsers.toString());
    console.log("- Paused:", programState.paused);
    
    console.log("\nReward Escrow:");
    console.log("- Total Balance:", rewardEscrow.totalBalance.div(MULTIPLIER).toString(), "DEFAI");
    console.log("- Total Distributed:", rewardEscrow.totalDistributed.div(MULTIPLIER).toString(), "DEFAI");
    
    console.log("\nProgram addresses:");
    console.log("- Program State PDA:", programStatePDA.toString());
    console.log("- Stake Vault PDA:", stakeVaultPDA.toString());
    console.log("- Reward Escrow PDA:", rewardEscrowPDA.toString());
    console.log("- Escrow Vault PDA:", escrowVaultPDA.toString());
    
    console.log("\n⚠️  IMPORTANT: Replace the following before running:");
    console.log("1. Update defaiMint with actual DEFAI token mint address");
    console.log("2. Ensure you have DEFAI tokens to fund the escrow");
    console.log("3. Adjust INITIAL_ESCROW_FUNDING based on expected rewards");
    
  } catch (error) {
    console.error("Error initializing DEFAI Staking:", error);
    throw error;
  }
}

// Run initialization if called directly
if (require.main === module) {
  initializeDefaiStaking().catch(console.error);
} 