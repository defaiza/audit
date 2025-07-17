import { Connection, Keypair, PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';
import { 
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createInitializeMintInstruction,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddress,
  getMint,
  createMintToInstruction
} from '@solana/spl-token';

export interface TokenConfig {
  decimals?: number;
  mintAuthority?: PublicKey;
  freezeAuthority?: PublicKey | null;
}

export class TokenUtils {
  constructor(
    private connection: Connection,
    private payer: Keypair
  ) {}

  /**
   * Create a new SPL token mint
   */
  async createMint(config: TokenConfig = {}): Promise<PublicKey> {
    const {
      decimals = 9,
      mintAuthority = this.payer.publicKey,
      freezeAuthority = null
    } = config;

    // Generate new mint keypair
    const mint = Keypair.generate();
    
    // Calculate rent exemption
    const mintRent = await this.connection.getMinimumBalanceForRentExemption(82);
    
    // Build transaction
    const tx = new Transaction();
    
    // Create mint account
    tx.add(
      SystemProgram.createAccount({
        fromPubkey: this.payer.publicKey,
        newAccountPubkey: mint.publicKey,
        lamports: mintRent,
        space: 82,
        programId: TOKEN_PROGRAM_ID
      })
    );
    
    // Initialize mint
    tx.add(
      createInitializeMintInstruction(
        mint.publicKey,
        decimals,
        mintAuthority,
        freezeAuthority,
        TOKEN_PROGRAM_ID
      )
    );
    
    // Send transaction
    const signature = await this.connection.sendTransaction(tx, [this.payer, mint]);
    await this.connection.confirmTransaction(signature);
    
    return mint.publicKey;
  }

  /**
   * Create an associated token account
   */
  async createTokenAccount(
    mint: PublicKey,
    owner: PublicKey
  ): Promise<PublicKey> {
    const ata = await getAssociatedTokenAddress(
      mint,
      owner,
      false,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    
    // Check if account already exists
    const accountInfo = await this.connection.getAccountInfo(ata);
    if (accountInfo !== null) {
      return ata;
    }
    
    // Create ATA instruction
    const tx = new Transaction();
    tx.add(
      createAssociatedTokenAccountInstruction(
        this.payer.publicKey,
        ata,
        owner,
        mint,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      )
    );
    
    // Send transaction
    const signature = await this.connection.sendTransaction(tx, [this.payer]);
    await this.connection.confirmTransaction(signature);
    
    return ata;
  }

  /**
   * Mint tokens to an account
   */
  async mintTo(
    mint: PublicKey,
    destination: PublicKey,
    amount: number | bigint,
    mintAuthority: Keypair = this.payer
  ): Promise<string> {
    const tx = new Transaction();
    
    tx.add(
      createMintToInstruction(
        mint,
        destination,
        mintAuthority.publicKey,
        amount,
        [],
        TOKEN_PROGRAM_ID
      )
    );
    
    const signature = await this.connection.sendTransaction(tx, [this.payer, mintAuthority]);
    await this.connection.confirmTransaction(signature);
    
    return signature;
  }

  /**
   * Create mint and fund an account in one go
   */
  async createAndFundToken(
    owner: PublicKey,
    amount: number | bigint,
    decimals: number = 9
  ): Promise<{
    mint: PublicKey;
    tokenAccount: PublicKey;
    signature: string;
  }> {
    // Create mint
    const mint = await this.createMint({ decimals });
    
    // Create token account
    const tokenAccount = await this.createTokenAccount(mint, owner);
    
    // Mint tokens
    const signature = await this.mintTo(mint, tokenAccount, amount);
    
    return { mint, tokenAccount, signature };
  }

  /**
   * Create a dummy NFT collection mint
   */
  async createCollectionMint(): Promise<PublicKey> {
    return this.createMint({
      decimals: 0,
      freezeAuthority: this.payer.publicKey
    });
  }

  /**
   * Get token balance
   */
  async getTokenBalance(tokenAccount: PublicKey): Promise<bigint> {
    const info = await this.connection.getTokenAccountBalance(tokenAccount);
    return BigInt(info.value.amount);
  }
} 