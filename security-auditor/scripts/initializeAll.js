// initializeAll.js
// Complete end-to-end deployment and setup script that:
// 1. Generates program keypairs if needed
// 2. Builds and deploys programs
// 3. Mints all tokens & NFTs, uploads metadata
// 4. Initializes programs with proper mint addresses
// 5. Configures frontend with all deployed addresses
//
// Usage:  node scripts/initializeAll.js  (with optional env PROGRAM_ID=<programId>)
//
// This script is idempotent for local testing – it writes wallets to ./wallet.json, ./treasury.json.
// It always creates new mints on every run.
// 
// IMPORTANT: The script mints 5B DEFAI REWARDS tokens directly to the escrow PDA for redemptions.
//
// V5 COMPATIBILITY NOTES:
// - BonusStateV4 PDAs are created dynamically during swaps (no upfront initialization needed)
// - UserTaxState PDAs are created on-demand when users initialize their personal tax rate
// - The script sets up all core infrastructure: tokens, NFTs, program config, escrow, etc.

import { Connection, Keypair, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL, sendAndConfirmTransaction } from "@solana/web3.js";
import {
  createMint,
  mintTo,
  getOrCreateAssociatedTokenAccount,
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  AuthorityType,
  createInitializeMetadataPointerInstruction,
  createInitializeMintInstruction,
  getMintLen,
  setAuthority,
  transferChecked,
  ExtensionType,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddress,
  createMintToInstruction,
  getMint,
} from "@solana/spl-token";
import { execSync } from "child_process";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import { base58 } from "@metaplex-foundation/umi/serializers";
import { toWeb3JsKeypair } from "@metaplex-foundation/umi-web3js-adapters";
import { web3JsRpc } from "@metaplex-foundation/umi-rpc-web3js";
import {
  createNft,
  mplTokenMetadata,
  fetchDigitalAsset,
  createV1,
  updateV1,
  fetchMetadata,
  findMetadataPda,
  TokenStandard,
} from "@metaplex-foundation/mpl-token-metadata";
import { mplHybrid } from "@metaplex-foundation/mpl-hybrid";
import {
  createTree,
  mintToCollectionV1,
  mplBubblegum,
} from "@metaplex-foundation/mpl-bubblegum";
import { dasApi } from "@metaplex-foundation/digital-asset-standard-api";
import { 
  createGenericFile,
  generateSigner,
  signerIdentity,
  createSignerFromKeypair,
  some,
  none,
  publicKey as umiPublicKey,
} from "@metaplex-foundation/umi";
import { promises as fs } from "fs";
import fsSync from "fs";
import path from "path";
import { fileURLToPath } from "url";
import BN from "bn.js";
import * as anchor from "@coral-xyz/anchor";
import FormData from "form-data";
import fetch from "node-fetch";
import dotenv from "dotenv";
import os from "os";

// Get __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env and .env.local in parent directory
dotenv.config({ path: path.join(__dirname, '..', '.env') });
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

/* ------------------------------ config -------------------------------- */
// IMPORTANT: Update this when deploying a new program
const DEFAULT_PROGRAM_ID = "5pmceM9vG9gpLCM8W7wTC92m8GsXnZEpE7wmbbHpFUeT";
const DEFAULT_RPC_URL = "https://api.devnet.solana.com";
const DEFAULT_WALLET_PATH = path.join(os.homedir(), ".config/solana/id.json");
const connection = new Connection(DEFAULT_RPC_URL, "confirmed");

// Program configuration
const PROGRAMS = {
  defai_swap: {
    name: "defai_swap",
    path: "programs/defai_swap",
    keypairPath: "scripts/program-keypairs/defai_swap-keypair.json",
  },
  defai_staking: {
    name: "defai_staking", 
    path: "programs/defai_staking",
    keypairPath: "scripts/program-keypairs/defai_staking-keypair.json",
  },
  defai_estate: {
    name: "defai_estate",
    path: "programs/defai_estate", 
    keypairPath: "scripts/program-keypairs/defai_estate-keypair.json",
  },
  defai_app_factory: {
    name: "defai_app_factory",
    path: "programs/defai_app_factory",
    keypairPath: "scripts/program-keypairs/defai_app_factory-keypair.json",
  },
};

// env vars for Storacha
const STOR_KEY = process.env.STORACHA_PRIVATE_KEY || "";
const STOR_SPACE = process.env.STORACHA_SPACE || "";

const SUPPLIES = {
  OG: 1000n,
  TRAIN: 2000n,
  BOAT: 1000n,
  PLANE: 500n,
  ROCKET: 300n,
};

const ROCKET_TREASURY_KEEP = 100n; // out of 300 total

// Will be populated once tier SFT mints are created so the frontend can reference
const GENERATED_TIER_MINTS = [];

/* -------------------------- helper functions -------------------------- */

const WALLETS_DIR = path.join(__dirname, "../wallets");
if (!fsSync.existsSync(WALLETS_DIR)) {
  fsSync.mkdirSync(WALLETS_DIR, { recursive: true });
}

const USER_WALLET_PATH = path.join(WALLETS_DIR, "wallet.json");
const TREASURY_WALLET_PATH = path.join(WALLETS_DIR, "treasury.json");
const ESCROW_WALLET_PATH = path.join(WALLETS_DIR, "escrow.json");
const ASSETS_DIR = path.join(__dirname, "../assets");
const IMG_DIR = path.join(ASSETS_DIR, "images");
const META_DIR = path.join(ASSETS_DIR, "metadata");
const PRELAUNCH_WALLET_PATH = path.join(WALLETS_DIR, "prelaunch.json");
const OG_WALLET_PATH = path.join(WALLETS_DIR, "og.json");
const EARLY_WALLET_PATH = path.join(WALLETS_DIR, "early.json");
const TEAM_WALLET_PATH = path.join(WALLETS_DIR, "team.json");
const ADVISOR_WALLET_PATH = path.join(WALLETS_DIR, "advisor.json");
const LIQUIDITY_WALLET_PATH = path.join(WALLETS_DIR, "liquidity.json");
const COMMUNITY_WALLET_PATH = path.join(WALLETS_DIR, "community.json");
const MARKETING_WALLET_PATH = path.join(WALLETS_DIR, "marketing.json");
const DIST_CSV = path.join(ASSETS_DIR, "distribution.csv"); // optional CSV config

// Persisted mint keypairs
const REWARDS_MINT_PATH = path.join(WALLETS_DIR, "rewards_mint.json");
const COLLECTION_MINT_PATH = path.join(WALLETS_DIR, "collection_mint.json");
const TIER_MINT_PATHS = [
  path.join(WALLETS_DIR, "tier_og_mint.json"),
  path.join(WALLETS_DIR, "tier_train_mint.json"),
  path.join(WALLETS_DIR, "tier_boat_mint.json"),
  path.join(WALLETS_DIR, "tier_plane_mint.json"),
  path.join(WALLETS_DIR, "tier_rocket_mint.json"),
];

// Updated 5-tier price schedule (uDEFAI, i.e. DEFAI * 1e6)
const TIER_PRICES = [
  1_000_000_000,      // OG 1,000 DEFAI
  10_000_000_000,     // Train 10,000 DEFAI
  500_000_000_000,    // Boat 500,000 DEFAI
  1_000_000_000_000,  // Plane 1,000,000 DEFAI
  5_000_000_000_000,  // Rocket 5,000,000 DEFAI
];

function loadOrGenerate(kpPath, label) {
  if (fsSync.existsSync(kpPath)) {
    const sk = Uint8Array.from(JSON.parse(fsSync.readFileSync(kpPath, "utf8")));
    console.log(`${label} wallet loaded`);
    return Keypair.fromSecretKey(sk);
  }
  const kp = Keypair.generate();
  fsSync.writeFileSync(kpPath, JSON.stringify(Array.from(kp.secretKey)));
  console.log(`${label} wallet generated: ${kp.publicKey.toBase58()}`);
  return kp;
}

async function airdropIfNeeded(kp) {
  const bal = await connection.getBalance(kp.publicKey);
  if (bal < 1e9) {
    try {
      const sig = await connection.requestAirdrop(kp.publicKey, 2e9);
      await connection.confirmTransaction(sig, "confirmed");
      console.log(`Airdropped 2 SOL to ${kp.publicKey.toBase58()}`);
    } catch (err) {
      console.warn(
        `Airdrop failed for ${kp.publicKey.toBase58()}. You may need to fund manually.`
      );
    }
  }
}

function readJson(filePath) {
  return JSON.parse(fsSync.readFileSync(filePath, "utf8"));
}

// Persist mint keypairs so addresses are stable across runs
function saveKeypairIfNew(kp, filePath) {
  if (!fsSync.existsSync(filePath)) {
    fsSync.writeFileSync(filePath, JSON.stringify(Array.from(kp.secretKey)));
  }
}

function writeFrontendEnv(vars) {
  const frontendEnvPath = path.join(__dirname, "../frontend/.env.local");
  let existing = {};
  if (fsSync.existsSync(frontendEnvPath)) {
    const lines = fsSync.readFileSync(frontendEnvPath, "utf8").split(/\r?\n/);
    for (const l of lines) {
      const idx = l.indexOf("=");
      if (idx !== -1) existing[l.slice(0, idx)] = l.slice(idx + 1);
    }
  }
  const merged = { ...existing, ...vars };
  const contents = Object.entries(merged)
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
  fsSync.writeFileSync(frontendEnvPath, contents);
  console.log("Front-end .env.local updated");

  // Write tier mint addresses for the frontend so it can map tiers → mints without manual edits
  try {
    const tierJsonPath = path.join(__dirname, "../frontend/src/constants/tierMints.json");
    fsSync.mkdirSync(path.dirname(tierJsonPath), { recursive: true });
    fsSync.writeFileSync(tierJsonPath, JSON.stringify(GENERATED_TIER_MINTS, null, 2));
    console.log("tierMints.json written for frontend");
  } catch (err) {
    console.warn("Failed to write tierMints.json", err);
  }
}

async function accountExists(pubkey) {
  return (await connection.getAccountInfo(pubkey)) !== null;
}

// Helper: check if a mint still has a non-null mint authority
async function hasMintAuthority(mintPubkey) {
  try {
    const mintInfo = await getMint(
      connection,
      mintPubkey,
      "confirmed",
      TOKEN_2022_PROGRAM_ID
    );
    return mintInfo.mintAuthority !== null;
  } catch (e) {
    console.warn("Failed to fetch mint info for", mintPubkey.toBase58());
    return false;
  }
}

// Helper: handle Signer/Keypair objects from UMI or web3 – returns a base58 string
function getPubKeyString(obj) {
  if (!obj) return "";
  if (typeof obj === "string") return obj;
  if (obj instanceof PublicKey) return obj.toBase58();
  if (obj.publicKey) {
    if (typeof obj.publicKey === "string") return obj.publicKey;
    if (obj.publicKey.toBase58) return obj.publicKey.toBase58();
  }
  return obj.toString();
}

/* -------------------------- program deployment helpers -------------------------- */

// Generate or load program keypair
function loadOrGenerateProgramKeypair(keypairPath, programName) {
  const fullPath = path.join(__dirname, "..", keypairPath);
  const dir = path.dirname(fullPath);
  
  // Create directory if it doesn't exist
  if (!fsSync.existsSync(dir)) {
    fsSync.mkdirSync(dir, { recursive: true });
  }
  
  if (fsSync.existsSync(fullPath)) {
    console.log(`📄 Loading existing ${programName} keypair from ${keypairPath}`);
    const keypairData = JSON.parse(fsSync.readFileSync(fullPath, "utf8"));
    const keypair = Keypair.fromSecretKey(new Uint8Array(keypairData));
    console.log(`   Program ID: ${keypair.publicKey.toBase58()}`);
    return keypair;
  }
  
  console.log(`🔑 Generating new ${programName} keypair...`);
  try {
    execSync(`solana-keygen new --outfile ${fullPath} --force --no-bip39-passphrase`, {
      stdio: "inherit"
    });
    const keypairData = JSON.parse(fsSync.readFileSync(fullPath, "utf8"));
    const keypair = Keypair.fromSecretKey(new Uint8Array(keypairData));
    console.log(`   Generated Program ID: ${keypair.publicKey.toBase58()}`);
    return keypair;
  } catch (err) {
    console.error(`Failed to generate keypair for ${programName}:`, err);
    throw err;
  }
}

// Update Anchor.toml with program IDs
function updateAnchorToml(programIds) {
  const anchorTomlPath = path.join(__dirname, "..", "Anchor.toml");
  let anchorToml = fsSync.readFileSync(anchorTomlPath, "utf8");
  
  // Update program IDs for both devnet and localnet
  for (const [programName, programId] of Object.entries(programIds)) {
    const regex = new RegExp(`${programName}\\s*=\\s*"[^"]*"`, "g");
    anchorToml = anchorToml.replace(regex, `${programName} = "${programId}"`);
  }
  
  fsSync.writeFileSync(anchorTomlPath, anchorToml);
  console.log("✅ Updated Anchor.toml with new program IDs");
}

// Build programs
async function buildPrograms() {
  console.log("\n🔨 Building programs...");
  try {
    execSync("anchor build", {
      cwd: path.join(__dirname, ".."),
      stdio: "inherit"
    });
    console.log("✅ Programs built successfully");
  } catch (err) {
    console.error("❌ Failed to build programs:", err);
    throw err;
  }
}

// Deploy a single program
async function deployProgram(programName, keypairPath, skipDeploy = false) {
  if (skipDeploy) {
    console.log(`⏭️  Skipping deployment of ${programName} (using existing deployment)`);
    return;
  }
  
  console.log(`\n🚀 Deploying ${programName}...`);
  const fullKeypairPath = path.join(__dirname, "..", keypairPath);
  const programPath = path.join(__dirname, "..", "target", "deploy", `${programName}.so`);
  
  if (!fsSync.existsSync(programPath)) {
    throw new Error(`Program binary not found at ${programPath}. Run 'anchor build' first.`);
  }
  
  try {
    execSync(
      `solana program deploy ${programPath} --program-id ${fullKeypairPath} --url ${DEFAULT_RPC_URL}`,
      {
        cwd: path.join(__dirname, ".."),
        stdio: "inherit"
      }
    );
    console.log(`✅ ${programName} deployed successfully`);
  } catch (err) {
    console.error(`❌ Failed to deploy ${programName}:`, err);
    throw err;
  }
}

// Check if program is already deployed
async function isProgramDeployed(programId) {
  try {
    const accountInfo = await connection.getAccountInfo(programId);
    return accountInfo !== null && accountInfo.executable;
  } catch (err) {
    return false;
  }
}

/* -------------------------- pre-flight checks ------------------------ */
async function preflight() {
  console.log("== Pre-flight checks ==");
  const cluster = DEFAULT_RPC_URL.includes("mainnet") ? "mainnet" : DEFAULT_RPC_URL.includes("devnet") ? "devnet" : DEFAULT_RPC_URL;
  console.log("Cluster:", cluster);
  if (cluster === "mainnet" && process.env.CONFIRM_MAINNET !== "YES") {
    throw new Error("Running on mainnet requires CONFIRM_MAINNET=YES env var");
  }
}

/* ------------------ distribution CSV helper ------------------------- */
function loadDistribution() {
  if (!fsSync.existsSync(DIST_CSV)) return null;
  const lines = fsSync.readFileSync(DIST_CSV, "utf8").split(/\r?\n/).filter(Boolean);
  const map = {};
  for (const l of lines) {
    const [label, amountStr] = l.split(",").map((s) => s.trim());
    if (!label || !amountStr) continue;
    map[label.toLowerCase()] = BigInt(amountStr);
  }
  return map;
}

/* ------------------ helper: verify on-chain metadata URI --------------- */
async function verifyMetadataUri(umi, mintSigner, expectedUri) {
  try {
    const meta = await fetchMetadata(umi, mintSigner.publicKey);
    if (meta.uri !== expectedUri) {
      console.log(
        `Metadata URI mismatch for ${mintSigner.publicKey}. Updating on-chain metadata…`
      );
      await updateV1(umi, {
        mint: mintSigner,
        authority: umi.identity,
        uri: expectedUri,
      }).sendAndConfirm(umi);
      console.log("✔ Metadata URI updated");
    } else {
      console.log(`✔ Metadata URI verified for ${mintSigner.publicKey}`);
    }
  } catch (err) {
    console.warn("❗ Could not verify/update metadata for", mintSigner.publicKey.toString(), err?.message || err);
  }
}

/* ------------------------------- main --------------------------------- */
async function main() {
  await preflight();
  
  // Phase 0: Program Deployment
  console.log("\n== Phase 0: Program Deployment ==");
  
  // Check if we should deploy programs or use existing ones
  const SKIP_PROGRAM_DEPLOY = process.env.SKIP_PROGRAM_DEPLOY === 'true';
  const DEPLOY_ONLY = process.env.DEPLOY_ONLY === 'true';
  
  let programIds = {};
  let selectedProgramId = null;
  
  if (!SKIP_PROGRAM_DEPLOY) {
    console.log("🔧 Setting up program keypairs and deployment...");
    
    // Generate or load program keypairs
    const programKeypairs = {};
    for (const [key, config] of Object.entries(PROGRAMS)) {
      const keypair = loadOrGenerateProgramKeypair(config.keypairPath, config.name);
      programKeypairs[key] = keypair;
      programIds[config.name] = keypair.publicKey.toBase58();
    }
    
    // Update Anchor.toml with program IDs
    updateAnchorToml(programIds);
    
    // Build programs
    await buildPrograms();
    
    // Deploy programs
    for (const [key, config] of Object.entries(PROGRAMS)) {
      const programId = programKeypairs[key].publicKey;
      const isDeployed = await isProgramDeployed(programId);
      
      if (isDeployed) {
        console.log(`✅ ${config.name} already deployed at ${programId.toBase58()}`);
      } else {
        await deployProgram(config.name, config.keypairPath);
      }
    }
    
    // Use defai_swap as the main program ID for initialization
    selectedProgramId = programKeypairs.defai_swap.publicKey;
    console.log("\n✅ All programs deployed successfully!");
    
    if (DEPLOY_ONLY) {
      console.log("\n🛑 DEPLOY_ONLY mode - stopping after program deployment");
      console.log("\nDeployed Program IDs:");
      for (const [name, id] of Object.entries(programIds)) {
        console.log(`  ${name}: ${id}`);
      }
      process.exit(0);
    }
  } else {
    console.log("⏭️  Skipping program deployment (SKIP_PROGRAM_DEPLOY=true)");
    // Use the program ID from env or default
    selectedProgramId = new PublicKey(process.env.PROGRAM_ID || DEFAULT_PROGRAM_ID);
  }
  
  // Override with env PROGRAM_ID if provided
  const PROGRAM_ID = process.env.PROGRAM_ID ? new PublicKey(process.env.PROGRAM_ID) : selectedProgramId;
  console.log("🚨 USING PROGRAM ID:", PROGRAM_ID.toBase58());
  
  // Track deployment state - use program ID specific file
  const deploymentStatePath = path.join(__dirname, `../deployment-state-${PROGRAM_ID.toBase58()}.json`);
  let deploymentState = {};
  
  // Load existing deployment state if it exists
  if (fsSync.existsSync(deploymentStatePath)) {
    deploymentState = JSON.parse(fsSync.readFileSync(deploymentStatePath, 'utf8'));
    console.log("🔄 Found existing deployment state, resuming from last checkpoint...");
  }
  
  // Save program IDs in deployment state
  if (!SKIP_PROGRAM_DEPLOY && Object.keys(programIds).length > 0) {
    deploymentState.programIds = programIds;
  }
  
  // Helper to save deployment state
  function saveDeploymentState() {
    fsSync.writeFileSync(deploymentStatePath, JSON.stringify(deploymentState, null, 2));
  }
  
  // Helper to check if a phase is complete
  function isPhaseComplete(phaseName) {
    return deploymentState[phaseName] === true;
  }
  /* -------- wallets & umi -------- */
  const user = loadOrGenerate(USER_WALLET_PATH, "User");
  const treasury = loadOrGenerate(TREASURY_WALLET_PATH, "Treasury");
  const escrow = loadOrGenerate(ESCROW_WALLET_PATH, "Escrow");

  const marketing = loadOrGenerate(MARKETING_WALLET_PATH, "Marketing");
  const community = loadOrGenerate(COMMUNITY_WALLET_PATH, "Community");
  const liquidity = loadOrGenerate(LIQUIDITY_WALLET_PATH, "Liquidity");
  const advisor = loadOrGenerate(ADVISOR_WALLET_PATH, "Advisor");
  const team = loadOrGenerate(TEAM_WALLET_PATH, "Team");
  const early = loadOrGenerate(EARLY_WALLET_PATH, "Early");
  const og = loadOrGenerate(OG_WALLET_PATH, "OG");
  const prelaunch = loadOrGenerate(PRELAUNCH_WALLET_PATH, "PreLaunch");

  const distributionWallets = {
    marketing,
    community,
    treasury,
    liquidity,
    advisor,
    team,
    early,
    og,
    prelaunch,
  };

  // await Promise.all(Object.values(distributionWallets).map(airdropIfNeeded)); // Skip airdrops - wallets already funded

  const umi = createUmi(DEFAULT_RPC_URL)
    .use(mplTokenMetadata())
    .use(mplHybrid());

  const umiSigner = createSignerFromKeypair(umi, {
    secretKey: user.secretKey,
    publicKey: user.publicKey.toBase58(),
  });
  umi.use(signerIdentity(umiSigner));

  /* -------- Derive all PDAs early so we can use them throughout -------- */
  const [escrowPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("escrow")],
    PROGRAM_ID
  );
  const [configPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    PROGRAM_ID
  );
  const [taxPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("tax_state")],
    PROGRAM_ID
  );
  const [whitelistPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("whitelist")],
    PROGRAM_ID
  );
  const [statsPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("stats")],
    PROGRAM_ID
  );
  const [collectionConfigPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("collection_config")],
    PROGRAM_ID
  );
  
  console.log("🔑 PDAs for Program", PROGRAM_ID.toBase58());
  console.log("  Escrow PDA:", escrowPda.toBase58());
  console.log("  Config PDA:", configPda.toBase58());
  console.log("  Tax State PDA:", taxPda.toBase58());
  console.log("  Whitelist PDA:", whitelistPda.toBase58());
  console.log("  Stats PDA:", statsPda.toBase58());
  console.log("  Collection Config PDA:", collectionConfigPda.toBase58());

  


  const DEFAI_SUPPLY = 1_000_000_000; // 1 billion
  const REWARDS_SUPPLY = 100_000_000_000; // 100 billion
  
  const walletDir = path.join(__dirname, "..", "wallets");

  // Pinata IPFS upload helper
  async function uploadToIPFS(file) {
    const pinataJWT = process.env.NEXT_PUBLIC_PINATA_JWT;
    if (!pinataJWT) {
      throw new Error("NEXT_PUBLIC_PINATA_JWT environment variable is not set");
    }

    const formData = new FormData();
    formData.append('file', file.buffer, {
      filename: file.fileName,
      contentType: file.contentType || 'application/octet-stream'
    });

    const response = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${pinataJWT}`
      },
      body: formData
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to upload to Pinata: ${response.statusText} - ${errorText}`);
    }

    const result = await response.json();
    console.log(`Uploaded to Pinata: ${file.fileName} -> ${result.IpfsHash}`);
    return `https://gateway.pinata.cloud/ipfs/${result.IpfsHash}`;
  }

  async function safeUploadFiles(files) {
    console.log(`Uploading ${files.length} files to IPFS...`);
    const uris = [];
    
    for (const file of files) {
      try {
        const uri = await uploadToIPFS(file);
        console.log(`✓ Uploaded ${file.fileName} -> ${uri}`);
        uris.push(uri);
      } catch (error) {
        console.error(`Failed to upload ${file.fileName}:`, error);
        throw error;
      }
    }
    
    return uris;
  }

  async function safeUploadJson(jsonObjs) {
    const files = jsonObjs.map((obj, i) => createGenericFile(
      Buffer.from(JSON.stringify(obj)),
      `${i}.json`,
      { tags: [{ name: "Content-Type", value: "application/json" }] }
    ));
    return await safeUploadFiles(files);
  }

  console.log("\n== Phase 1: Uploading assets ==");

  let nftImgUris, nftVideoUris, nftMetaUris, defaiLogoUri;
  
  if (!isPhaseComplete('phase1_upload_assets')) {
  /* --- upload NFT images AND videos (0-4) --- */
  const nftImgs = ["0.png", "1.png", "2.png", "3.png", "4.png"];
  const nftVideos = ["0.mp4", "1.mp4", "2.mp4", "3.mp4", "4.mp4"];
  
  // Check all files exist
  nftImgs.forEach((f) => {
    if (!fsSync.existsSync(path.join(IMG_DIR, f)))
      throw new Error(`Missing image ${f}`);
  });
  nftVideos.forEach((f) => {
    if (!fsSync.existsSync(path.join(IMG_DIR, f)))
      throw new Error(`Missing video ${f}`);
  });
  
  // Upload images first
  const nftImgFiles = nftImgs.map((f) =>
    createGenericFile(fsSync.readFileSync(path.join(IMG_DIR, f)), f, {
      tags: [{ name: "Content-Type", value: "image/png" }],
    })
  );
    nftImgUris = await safeUploadFiles(nftImgFiles);
  console.log("Uploaded NFT images");
  
  // Upload videos
  const nftVideoFiles = nftVideos.map((f) =>
    createGenericFile(fsSync.readFileSync(path.join(IMG_DIR, f)), f, {
      tags: [{ name: "Content-Type", value: "video/mp4" }],
    })
  );
    nftVideoUris = await safeUploadFiles(nftVideoFiles);
  console.log("Uploaded NFT videos");

  /* --- upload NFT metadata JSON & patch image URIs --- */
  const nftMetaObjs = ["0.json", "1.json", "2.json", "3.json", "4.json"].map((f, i) => {
    const objPath = path.join(META_DIR, f);
    const obj = readJson(objPath);
    obj.image = nftImgUris[i];  // Static PNG image
    obj.animation_url = nftVideoUris[i];  // Animated MP4 video
    
    // Update properties.files to include both image and video
    if (!obj.properties) obj.properties = {};
    if (!obj.properties.files) obj.properties.files = [];
    
    obj.properties.files = [
      {
        uri: nftImgUris[i],
        type: "image/png"
      },
      {
        uri: nftVideoUris[i],
        type: "video/mp4"
      }
    ];
    
    // persist patched json so devs can inspect locally
    fsSync.writeFileSync(objPath, JSON.stringify(obj, null, 2));
    return obj;
  });
    nftMetaUris = await safeUploadJson(nftMetaObjs);
  console.log("Uploaded NFT metadata");

  /* --- upload logos --- */
  const defaiLogoPath = path.join(IMG_DIR, "defailogo.png");
  if (!fsSync.existsSync(defaiLogoPath)) throw new Error("Missing defailogo.png");
  const defaiLogoFile = createGenericFile(
    fsSync.readFileSync(defaiLogoPath),
    "defailogo.png",
    { tags: [{ name: "Content-Type", value: "image/png" }] }
  );
    [defaiLogoUri] = await safeUploadFiles([defaiLogoFile]);
  console.log("Uploaded DEFAI REWARDS logo");
    
    // Save state
    deploymentState.phase1_upload_assets = true;
    deploymentState.nftImgUris = nftImgUris;
    deploymentState.nftVideoUris = nftVideoUris;
    deploymentState.nftMetaUris = nftMetaUris;
    deploymentState.defaiLogoUri = defaiLogoUri;
    saveDeploymentState();
    console.log("✅ Phase 1 complete - saved checkpoint");
  } else {
    // Load from saved state
    nftImgUris = deploymentState.nftImgUris;
    nftVideoUris = deploymentState.nftVideoUris;
    nftMetaUris = deploymentState.nftMetaUris;
    defaiLogoUri = deploymentState.defaiLogoUri;
    console.log("✅ Phase 1 already complete - using saved URIs");
  }

  /* ---------------- phase 2 : legacy DEFAI SPL token ----------------- */
  console.log("\n== Phase 2: Setting up legacy DEFAI SPL token ==");
  
  let legacyMint, legacyMetaUri;
  const DECIMALS = 6;
  
  if (!isPhaseComplete('phase2_legacy_token')) {
  // Check if we have existing mints from deploy-summary.json
  let existingDeployment = null;
  const deploySummaryPath = path.join(__dirname, "../deploy-summary.json");
  if (fsSync.existsSync(deploySummaryPath)) {
    try {
      existingDeployment = JSON.parse(fsSync.readFileSync(deploySummaryPath, "utf8"));
      console.log("Found existing deployment, will reuse mints if valid");
    } catch (e) {
      console.log("Could not read deploy-summary.json, creating fresh mints");
    }
  }
  
  // Use existing legacy mint or create new one
  const LEGACY_SUPPLY = 1_000_000_000n; // 1B
  
  if (existingDeployment?.legacyMint && await accountExists(new PublicKey(existingDeployment.legacyMint))) {
    console.log("Using existing legacy DEFAI mint:", existingDeployment.legacyMint);
    // Load existing mint (we won't have the keypair, but that's ok for transfers)
    legacyMint = { publicKey: new PublicKey(existingDeployment.legacyMint) };
  } else {
    console.log("Creating new legacy DEFAI mint");
    legacyMint = Keypair.generate();
    const legacyExists = await accountExists(legacyMint.publicKey);
    if (!legacyExists) {
      await createMint(
        connection,
        user,
        user.publicKey,
        user.publicKey,
        DECIMALS,
        legacyMint
      );
      console.log("Legacy DEFAI mint:", legacyMint.publicKey.toBase58());

      const legacyTreasuryAta = await getOrCreateAssociatedTokenAccount(
        connection,
        user,
        legacyMint.publicKey,
        treasury.publicKey
      );
      await mintTo(
        connection,
        user,
        legacyMint.publicKey,
        legacyTreasuryAta.address,
        user,
        LEGACY_SUPPLY * 10n ** BigInt(DECIMALS)
      );
      console.log(`Minted ${LEGACY_SUPPLY} DEFAI to treasury`);
    } else {
      console.log("Legacy DEFAI mint already exists, skipping creation");
    }
  }

  /* write metadata for legacy token (seller fee 0) */
  const legacyMetaJson = {
    name: "DEFAI",
    symbol: "DEFAI",
    decimals: DECIMALS,
    image: defaiLogoUri,
    description: "Legacy DEFAI token (SPL standard)",
  };
    legacyMetaUri = await safeUploadJson([legacyMetaJson]);
    
    // Save state
    deploymentState.phase2_legacy_token = true;
    deploymentState.legacyMint = legacyMint.publicKey.toBase58();
    deploymentState.legacyMetaUri = legacyMetaUri;
    saveDeploymentState();
    console.log("✅ Phase 2 complete - saved checkpoint");
  } else {
    // Load from saved state
    legacyMint = { publicKey: new PublicKey(deploymentState.legacyMint) };
    legacyMetaUri = deploymentState.legacyMetaUri;
    console.log("✅ Phase 2 already complete - using saved legacy mint");
  }

  if (!isPhaseComplete('phase2_legacy_metadata')) {
  // Only handle metadata if we have the keypair (new mint)
  if (legacyMint.secretKey) {
    const legacyMintSigner = createSignerFromKeypair(umi, {
      publicKey: legacyMint.publicKey.toBase58(),
      secretKey: legacyMint.secretKey,
    });

    // Skip metadata creation if it already exists to make the script idempotent
    const METADATA_PROGRAM_ID = new PublicKey(
      "metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s"
    );
    const [legacyMetadataPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("metadata"),
        METADATA_PROGRAM_ID.toBuffer(),
        legacyMint.publicKey.toBuffer(),
      ],
      METADATA_PROGRAM_ID
    );
    const legacyMetadataExists = await accountExists(legacyMetadataPda);

    if (!legacyMetadataExists) {
      // Skip metadata creation on localnet since Metaplex programs aren't deployed
      if (DEFAULT_RPC_URL.includes("localhost") || DEFAULT_RPC_URL.includes("127.0.0.1")) {
        console.log("Skipping metadata creation on localnet (Metaplex programs not deployed)");
      } else {
        await createV1(umi, {
          mint: legacyMintSigner,
          authority: umiSigner,
          payer: umiSigner,
          updateAuthority: umiSigner.publicKey,
          name: "DEFAI",
          symbol: "DEFAI",
          uri: legacyMetaUri,
          sellerFeeBasisPoints: 0,
          tokenStandard: TokenStandard.FungibleAsset,
          decimals: some(DECIMALS),
          collectionDetails: none(),
          splTokenProgram: umiPublicKey(TOKEN_PROGRAM_ID.toBase58()),
        }).sendAndConfirm(umi);
        console.log("Legacy DEFAI metadata created");
      }
    } else {
      console.log("Legacy DEFAI metadata already exists, skipping creation");
    }
    }
    
    deploymentState.phase2_legacy_metadata = true;
    saveDeploymentState();
    console.log("✅ Phase 2 metadata complete");
  } else {
    console.log("✅ Phase 2 metadata already complete");
  }

  /* ---------------- phase 3 : DEFAI REWARDS (Token-2022) ------------- */
  console.log("\n== Phase 3: Setting up DEFAI REWARDS Token-2022 ==");
  
  let rewardsMint, collectionKp, collectionMint, rewardsMetaUri;
  
  if (!isPhaseComplete('phase3_rewards_token')) {
  // ------------------ REWARDS mint (always fresh) -----------------
  console.log("Generating fresh DEFAI REWARDS mint...");
    rewardsMint = Keypair.generate();
  fsSync.writeFileSync(REWARDS_MINT_PATH, JSON.stringify(Array.from(rewardsMint.secretKey)));
  console.log("Fresh DEFAI REWARDS mint:", rewardsMint.publicKey.toBase58());

  // ------------------ Collection mint (always fresh) -------------
  console.log("Generating fresh collection mint...");
    collectionKp = Keypair.generate();
  fsSync.writeFileSync(COLLECTION_MINT_PATH, JSON.stringify(Array.from(collectionKp.secretKey)));
  console.log("Fresh collection mint:", collectionKp.publicKey.toBase58());
  
    collectionMint = createSignerFromKeypair(umi, {
    publicKey: collectionKp.publicKey.toBase58(),
    secretKey: collectionKp.secretKey,
  });

  // Always create rewards mint
  const mintLen = getMintLen([ExtensionType.MetadataPointer]);
  const lamports = await connection.getMinimumBalanceForRentExemption(mintLen);

  const [rewardsMetaPda] = findMetadataPda(umi, {
    mint: rewardsMint.publicKey,
  });

  const createMintTx = new Transaction().add(
    SystemProgram.createAccount({
      fromPubkey: user.publicKey,
      newAccountPubkey: rewardsMint.publicKey,
      space: mintLen,
      lamports,
      programId: TOKEN_2022_PROGRAM_ID,
    }),
    createInitializeMetadataPointerInstruction(
      rewardsMint.publicKey,
      undefined,
      new PublicKey(rewardsMetaPda),
      TOKEN_2022_PROGRAM_ID
    ),
    createInitializeMintInstruction(
      rewardsMint.publicKey,
      DECIMALS,
      user.publicKey,
      user.publicKey,
      TOKEN_2022_PROGRAM_ID
    )
  );
  await sendAndConfirmTransaction(connection, createMintTx, [user, rewardsMint]);
  console.log("Created DEFAI REWARDS mint:", rewardsMint.publicKey.toBase58());

  // Add a delay to allow the network to catch up before we use the mint
  console.log("Waiting for 5 seconds for mint to be confirmed on-chain...");
  await new Promise(resolve => setTimeout(resolve, 5000));

  // metadata json
  const rewardsMetaJson = {
    name: "DEFAI REWARDS",
    symbol: "DEFAI",
    decimals: DECIMALS,
    image: defaiLogoUri,
    description: "Rewards token for the DEFAI programme",
  };
  const rewardsMetaUri = await safeUploadJson([rewardsMetaJson]);

  // Always create metadata for fresh mint
  const rewardsMintSigner = createSignerFromKeypair(umi, {
    publicKey: rewardsMint.publicKey.toBase58(),
    secretKey: rewardsMint.secretKey,
  });

  // Skip metadata creation on localnet since Metaplex programs aren't deployed
  if (DEFAULT_RPC_URL.includes("localhost") || DEFAULT_RPC_URL.includes("127.0.0.1")) {
    console.log("Skipping DEFAI REWARDS metadata creation on localnet");
  } else {
    await createV1(umi, {
      mint: rewardsMintSigner,
      authority: umiSigner,
      payer: umiSigner,
      updateAuthority: umiSigner.publicKey,
      name: "DEFAI REWARDS",
      symbol: "DEFAI",
      uri: rewardsMetaUri,
      sellerFeeBasisPoints: 500, // 5%
      tokenStandard: TokenStandard.FungibleAsset,
      decimals: some(DECIMALS),
      collectionDetails: none(),
      collection: { key: collectionMint.publicKey, verified: false },
      splTokenProgram: umiPublicKey(TOKEN_2022_PROGRAM_ID.toBase58()),
    }).sendAndConfirm(umi);

    // verify metadata
    await verifyMetadataUri(umi, rewardsMintSigner, rewardsMetaUri);
  }

  // Mint supplies
  const TOTAL_REWARDS_SUPPLY = 100_000_000_000n; // 100B total supply for reference
  const TO_ESCROW = 5_000_000_000n; // liquidity for swaps

  const DISTRIBUTION = loadDistribution() ?? {
    marketing: 1_500_000_000n,
    community: 44_000_000_000n,
    treasury: 20_000_000_000n,
    liquidity: 5_000_000_000n,
    advisor: 5_000_000_000n,
    team: 8_000_000_000n,
    early: 10_000_000_000n,
    og: 1_000_000_000n,
    prelaunch: 500_000_000n,
  };



  // Create escrow PDA account for DEFAI REWARDS
  const escrowPdaRewardsAta = await getOrCreateAssociatedTokenAccount(
    connection,
    user,
    rewardsMint.publicKey,
    escrowPda,
    true,
    "confirmed",
    undefined,
    TOKEN_2022_PROGRAM_ID
  );
  console.log("Created DEFAI REWARDS ATA for escrow PDA:", escrowPdaRewardsAta.address.toBase58());

  // Create treasury ATA for DEFAI REWARDS to receive tax payments
  const treasuryRewardsAta = await getOrCreateAssociatedTokenAccount(
    connection,
    user,
    rewardsMint.publicKey,
    treasury.publicKey,
    false, // treasury is not a PDA
    "confirmed",
    undefined,
    TOKEN_2022_PROGRAM_ID
  );
  console.log("Created DEFAI REWARDS ATA for treasury:", treasuryRewardsAta.address.toBase58());

  // Mint a massive amount of DEFAI REWARDS to the escrow PDA directly
  await mintTo(
    connection,
    user,
    rewardsMint.publicKey,
    escrowPdaRewardsAta.address,
    user,
    TO_ESCROW * 10n ** BigInt(DECIMALS),
    [],
    undefined,
    TOKEN_2022_PROGRAM_ID
  );
  console.log(`Minted ${TO_ESCROW} DEFAI REWARDS directly to escrow PDA`);

  // Mint allocations to distribution wallets
  for (const [label, amount] of Object.entries(DISTRIBUTION)) {
    const walletKp = distributionWallets[label];
    const ata = await getOrCreateAssociatedTokenAccount(
      connection,
      user,
      rewardsMint.publicKey,
      walletKp.publicKey,
      false,
      "confirmed",
      undefined,
      TOKEN_2022_PROGRAM_ID
    );
    await mintTo(
      connection,
      user,
      rewardsMint.publicKey,
      ata.address,
      user,
      amount * 10n ** BigInt(DECIMALS),
      [],
      undefined,
      TOKEN_2022_PROGRAM_ID
    );
    console.log(`Minted ${amount} DEFAI REWARDS to ${label} wallet`);
  }
  console.log("Minted DEFAI REWARDS to all distribution wallets");

    // Save state
    deploymentState.phase3_rewards_token = true;
    deploymentState.rewardsMint = rewardsMint.publicKey.toBase58();
    deploymentState.collectionMint = collectionKp.publicKey.toBase58();
    deploymentState.rewardsMetaUri = rewardsMetaUri;
    saveDeploymentState();
    console.log("✅ Phase 3 complete - saved checkpoint");
  } else {
    // Load from saved state
    const savedRewardsMintSecretKey = JSON.parse(fsSync.readFileSync(REWARDS_MINT_PATH, 'utf8'));
    rewardsMint = Keypair.fromSecretKey(new Uint8Array(savedRewardsMintSecretKey));
    
    const savedCollectionMintSecretKey = JSON.parse(fsSync.readFileSync(COLLECTION_MINT_PATH, 'utf8'));
    collectionKp = Keypair.fromSecretKey(new Uint8Array(savedCollectionMintSecretKey));
    
    collectionMint = createSignerFromKeypair(umi, {
      publicKey: collectionKp.publicKey.toBase58(),
      secretKey: collectionKp.secretKey,
    });
    
    rewardsMetaUri = deploymentState.rewardsMetaUri;
    console.log("✅ Phase 3 already complete - using saved rewards mint");
  }

  /* ---------------- create DEFAI SUMMER collection NFT ---------------- */
  console.log("\n== Phase 4: Setting up DEFAI SUMMER collection NFT ==");
  
  if (!isPhaseComplete('phase4_collection_nft')) {
  // Skip metadata creation on localnet since Metaplex programs aren't deployed
  if (DEFAULT_RPC_URL.includes("localhost") || DEFAULT_RPC_URL.includes("127.0.0.1")) {
    console.log("Skipping collection NFT metadata creation on localnet");
  } else {
    await createV1(umi, {
      mint: collectionMint,
      authority: umiSigner,
      payer: umiSigner,
      name: "DEFAI SUMMER",
      symbol: "AIR",
      uri: "",
      sellerFeeBasisPoints: 1000, // 10%
      isCollection: true,
    }).sendAndConfirm(umi);
    console.log("Collection NFT minted:", collectionMint.publicKey.toString());
  }

    deploymentState.phase4_collection_nft = true;
    saveDeploymentState();
    console.log("✅ Phase 4 complete - saved checkpoint");
  } else {
    console.log("✅ Phase 4 already complete - collection NFT created");
  }

  /* ---------------- phase 5 : NFT Collection Setup (V6 Update) ------------- */
  console.log("\n== Phase 5: NFT Collection Setup (V6 pNFT) ==");
  console.log("ℹ️  V6 creates unique pNFT mints per swap - no pre-created tier mints needed");
  console.log("✅ V6 will create unique pNFT mints during each swap");
  console.log("   No tier mints to pre-create!");
  console.log("   Using collection NFT created in phase 4");

  /* ---------------- phase 6 : Initialize V6 Program ------------- */
  console.log("\n== Phase 6: Initializing V6 Program ==");

  // Anchor setup
  const wallet = new anchor.Wallet(user);
  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
  const idlPath = path.join(__dirname, "../target/idl/defai_swap.json");
  const idl = JSON.parse(fsSync.readFileSync(idlPath, "utf8"));
  const program = new anchor.Program(idl, PROGRAM_ID, provider);



  // Updated V6 tier prices with correct values
  const V6_TIER_PRICES = [
    new BN(1_000_000_000),      // Tier 0: 1,000 DEFAI
    new BN(10_000_000_000),     // Tier 1: 10,000 DEFAI
    new BN(500_000_000_000),    // Tier 2: 500,000 DEFAI
    new BN(1_000_000_000_000),  // Tier 3: 1,000,000 DEFAI
    new BN(5_000_000_000_000),  // Tier 4: 5,000,000 DEFAI
  ];

  if (!isPhaseComplete('phase6_program_init')) {
    const cfgExists = await accountExists(configPda);
    if (cfgExists) {
      console.log("Config PDA already exists – updating prices...");
      try {
        await program.methods
          .updatePrices(V6_TIER_PRICES)
          .accounts({ 
            admin: user.publicKey, 
            config: configPda 
          })
          .signers([user])
          .rpc();
        console.log("✅ Prices updated to V6 values");
      } catch (err) {
        console.log("Price update failed (may already be correct):", err.message);
      }
    } else {
      console.log("Initializing V6 program config...");
      await program.methods
        .initialize(V6_TIER_PRICES)
        .accounts({
          admin: user.publicKey,
          oldMint: legacyMint.publicKey,
          newMint: rewardsMint.publicKey,
          collection: collectionMint.publicKey,
          treasury: treasury.publicKey,
          config: configPda,
          escrow: escrowPda,
          taxState: taxPda,
          systemProgram: SystemProgram.programId
        })
        .signers([user])
        .rpc();
      console.log("✅ V6 program config initialized");
    }
    
    deploymentState.phase6_program_init = true;
    saveDeploymentState();
    console.log("✅ Phase 6 program init complete");
  } else {
    console.log("✅ Phase 6 program init already complete");
  }

  // Initialize collection config with correct supply limits
  const V6_TIER_SUPPLIES = [1000, 1000, 750, 500, 250]; // Actual supply limits per tier
  
  if (!isPhaseComplete('phase6_collection_config')) {
    const collectionCfgExists = await accountExists(collectionConfigPda);
    if (!collectionCfgExists) {
      console.log("Initializing collection config...");
      console.log("📊 Tier Supply Limits:");
      console.log("   OG: 1,000 NFTs");
      console.log("   Train: 1,000 NFTs");
      console.log("   Boat: 750 NFTs");
      console.log("   Plane: 500 NFTs");
      console.log("   Rocket: 250 NFTs");
      console.log("   Total: 3,500 NFTs");
      
      await program.methods
        .initializeCollection(
          ["OG Holder", "Train Conductor", "Boat Captain", "Plane Pilot", "Rocket Commander"],
          ["OG", "TRAIN", "BOAT", "PLANE", "ROCKET"],
          V6_TIER_PRICES,
          V6_TIER_SUPPLIES, // Correct supply limits
          nftMetaUris // Use the uploaded metadata URIs
        )
        .accounts({
          authority: user.publicKey,
          collectionMint: collectionMint.publicKey,
          treasury: treasury.publicKey,
          defaiMint: rewardsMint.publicKey,
          oldDefaiMint: legacyMint.publicKey,
          collectionConfig: collectionConfigPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([user])
        .rpc();
      console.log("✅ Collection config initialized with supply limits");
    } else {
      console.log("Collection config already exists - checking supply limits...");
      try {
        const collectionConfig = await program.account.collectionConfig.fetch(collectionConfigPda);
        console.log("📊 Current Tier Supplies:");
        const tierNames = ["OG", "Train", "Boat", "Plane", "Rocket"];
        collectionConfig.tierSupplies.forEach((supply, i) => {
          const minted = collectionConfig.tierMinted[i] || 0;
          console.log(`   ${tierNames[i]}: ${minted}/${supply} minted`);
        });
      } catch (err) {
        console.log("Could not fetch collection config");
      }
    }
    
    deploymentState.phase6_collection_config = true;
    saveDeploymentState();
    console.log("✅ Phase 6 collection config complete");
  } else {
    console.log("✅ Phase 6 collection config already complete");
  }

  /* ---------------- phase 7 : Fund Escrow for Redemptions ------------- */
  console.log("\n== Phase 7: Funding Escrow for V6 Redemptions ==");
  
  if (!isPhaseComplete('phase7_fund_escrow')) {
    // Create escrow DEFAI ATA if needed
    const escrowDefaiAta = await getAssociatedTokenAddress(
      rewardsMint.publicKey, 
        escrowPda,
        true,
        TOKEN_2022_PROGRAM_ID
    );
    
    const ataInfo = await connection.getAccountInfo(escrowDefaiAta);
    if (!ataInfo) {
      console.log("Creating escrow DEFAI ATA...");
      const createAtaIx = createAssociatedTokenAccountInstruction(
        user.publicKey,
        escrowDefaiAta,
        escrowPda,
        rewardsMint.publicKey,
      TOKEN_2022_PROGRAM_ID
    );
      
      const tx = new Transaction().add(createAtaIx);
      await sendAndConfirmTransaction(connection, tx, [user]);
      console.log("✅ Escrow DEFAI ATA created");
    }

    // Fund escrow with DEFAI for redemptions (100M tokens)
    const ESCROW_FUND_AMOUNT = 100_000_000n * 10n ** BigInt(DECIMALS); // 100M DEFAI
    
    // Check if we need to fund
    const escrowBalance = await connection.getTokenAccountBalance(escrowDefaiAta);
    const currentBalance = BigInt(escrowBalance.value.amount);
    
    if (currentBalance < ESCROW_FUND_AMOUNT) {
      console.log(`Funding escrow with ${ESCROW_FUND_AMOUNT / 10n ** BigInt(DECIMALS)} DEFAI...`);
      
      // Find source of funds - use team wallet which has DEFAI
      const teamDefaiAta = await getAssociatedTokenAddress(
        rewardsMint.publicKey,
        team.publicKey,
        false,
        TOKEN_2022_PROGRAM_ID
      );
      
      await transferChecked(
        connection,
        user,
        teamDefaiAta,
        rewardsMint.publicKey,
        escrowDefaiAta,
        team.publicKey,
        ESCROW_FUND_AMOUNT - currentBalance,
        DECIMALS,
        [team],
        undefined,
        TOKEN_2022_PROGRAM_ID
      );
      console.log("✅ Escrow funded with DEFAI for redemptions");
    } else {
      console.log("✅ Escrow already has sufficient DEFAI");
    }
    
    deploymentState.phase7_fund_escrow = true;
    saveDeploymentState();
    console.log("✅ Phase 7 complete - escrow funded");
      } else {
    console.log("✅ Phase 7 already complete - escrow funded");
  }

  /* ---------------- test wallet allocation (devnet only) ------------- */
  if (!process.env.CONFIRM_MAINNET) {
    const TEST_WALLET = new PublicKey("ABHVsoEg22fo69mxu12VAEseVdpfRR9uW9jyVoZ9v1di");
    console.log("\n== Funding test wallet", TEST_WALLET.toBase58());

    let legacyAmount = 100_000_000n * 10n ** BigInt(DECIMALS); // Default 100M
    
    // Send 100M legacy DEFAI if available
    try {
    const treasuryLegacyAta = (
      await getOrCreateAssociatedTokenAccount(
        connection,
        user,
        legacyMint.publicKey,
          treasury.publicKey
      )
    ).address;
      
      const treasuryLegacyBalance = await connection.getTokenAccountBalance(treasuryLegacyAta);
      console.log(`Treasury legacy DEFAI balance: ${treasuryLegacyBalance.value.uiAmount}`);
      
      if (treasuryLegacyBalance.value.uiAmount > 0) {
    const testLegacyAta = (
      await getOrCreateAssociatedTokenAccount(
        connection,
        user,
        legacyMint.publicKey,
        TEST_WALLET
      )
    ).address;
        
        legacyAmount = BigInt(Math.min(100_000_000, treasuryLegacyBalance.value.uiAmount)) * 10n ** BigInt(DECIMALS);
    await transferChecked(
      connection,
      user,
      treasuryLegacyAta,
      legacyMint.publicKey,
      testLegacyAta,
      treasury.publicKey,
          legacyAmount,
      DECIMALS,
      [treasury]
    );
        console.log(`✅ Sent ${legacyAmount / 10n ** BigInt(DECIMALS)} legacy DEFAI to test wallet`);
      } else {
        console.log(`⚠️  No legacy DEFAI in treasury to send`);
      }
    } catch (err) {
      console.log(`⚠️  Could not send legacy DEFAI: ${err.message}`);
    }

    // Send 100M new DEFAI
    const teamRewardsAta = (
      await getOrCreateAssociatedTokenAccount(
        connection,
        user,
        rewardsMint.publicKey,
        team.publicKey,
        false,
        "confirmed",
        undefined,
        TOKEN_2022_PROGRAM_ID
      )
    ).address;
    
    const testRewardsAta = (
      await getOrCreateAssociatedTokenAccount(
        connection,
        user,
        rewardsMint.publicKey,
        TEST_WALLET,
        true,
        "confirmed",
        undefined,
        TOKEN_2022_PROGRAM_ID
      )
    ).address;
    
    await transferChecked(
      connection,
      user,
      teamRewardsAta,
      rewardsMint.publicKey,
      testRewardsAta,
      team.publicKey,
      legacyAmount,
      DECIMALS,
      [team],
      undefined,
      TOKEN_2022_PROGRAM_ID
    );
    console.log(`✅ Sent 100M new DEFAI to test wallet`);
  }

  /* ---------------- Phase 8: Finalize - Revoke Mint Authority ---------------- */
  console.log("\n== Phase 8: Finalizing - Revoking Mint Authority ==");
  
  if (!isPhaseComplete('phase8_finalize')) {
    console.log("⚠️  About to revoke mint authority - this is IRREVERSIBLE!");
    console.log("   Make sure all tokens have been minted correctly.");
    
    if (process.env.SKIP_MINT_REVOKE === 'true') {
      console.log("⚠️  SKIP_MINT_REVOKE is set - keeping mint authority for testing");
    } else {
      // Check if we still have mint authority
      const hasMintAuth = await hasMintAuthority(rewardsMint.publicKey);
      if (hasMintAuth) {
        console.log("Revoking mint & freeze authority for DEFAI REWARDS...");
        
        // Revoke mint authority
        await setAuthority(
          connection,
          user,
          rewardsMint.publicKey,
          user,
          AuthorityType.MintTokens,
          null,
          [],
          undefined,
          TOKEN_2022_PROGRAM_ID
        );
        console.log("✅ Mint authority revoked");
        
        // Revoke freeze authority
        await setAuthority(
          connection,
          user,
          rewardsMint.publicKey,
          user,
          AuthorityType.FreezeAccount,
          null,
          [],
          undefined,
          TOKEN_2022_PROGRAM_ID
        );
        console.log("✅ Freeze authority revoked");
      } else {
        console.log("✅ Mint authority already revoked");
      }
    }
    
    deploymentState.phase8_finalize = true;
    saveDeploymentState();
    console.log("✅ Phase 8 complete - deployment finalized");
  } else {
    console.log("✅ Phase 8 already complete - mint authority revoked");
  }

  /* ---------------- summary ---------------- */
  console.log("\n== V6 Deployment Summary ==");
  console.log("Program ID:", PROGRAM_ID.toBase58());
  console.log("Admin:", user.publicKey.toBase58());
  console.log("Treasury:", treasury.publicKey.toBase58());
  console.log("\n-- Token Mints --");
  console.log("Legacy DEFAI (OLD):", legacyMint.publicKey.toBase58());
  console.log("DEFAI Token-2022 (NEW):", rewardsMint.publicKey.toBase58());
  console.log("Collection NFT:", getPubKeyString(collectionMint.publicKey));
  console.log("\n-- PDAs --");
  console.log("Config:", configPda.toBase58());
  console.log("Escrow:", escrowPda.toBase58());
  console.log("Collection Config:", collectionConfigPda.toBase58());
  console.log("\n-- V6 Features --");
  console.log("✅ Unique pNFT mints per swap");
  console.log("✅ Proper Token-2022 integration");
  console.log("✅ Fixed redemption logic");
  console.log("✅ Per-user tax rates");
  console.log("✅ Vesting with cliff period");

  /* ---------------- write front-end env ---------------- */
  const envVars = {
    // Program and RPC
    NEXT_PUBLIC_RPC_URL: DEFAULT_RPC_URL,
    NEXT_PUBLIC_PROGRAM_ID: PROGRAM_ID.toBase58(),
    
    // Token Mints
    NEXT_PUBLIC_LEGACY_MINT: getPubKeyString(legacyMint.publicKey ?? legacyMint),
    NEXT_PUBLIC_REWARDS_MINT: getPubKeyString(rewardsMint.publicKey ?? rewardsMint),
    NEXT_PUBLIC_COLLECTION_MINT: getPubKeyString(collectionMint.publicKey),
    
    // V6 doesn't use pre-created tier mints
    NEXT_PUBLIC_V6_MODE: "true",
    
    // PDAs
    NEXT_PUBLIC_VAULT_PDA: escrowPda.toBase58(),
    NEXT_PUBLIC_CONFIG_PDA: configPda.toBase58(),
    NEXT_PUBLIC_TAX_STATE_PDA: taxPda.toBase58(),
    
    // Wallets
    NEXT_PUBLIC_TREASURY: treasury.publicKey.toBase58(),
    NEXT_PUBLIC_ADMIN: user.publicKey.toBase58(),
  };
  
  // Add all program IDs if available
  if (deploymentState.programIds) {
    envVars.NEXT_PUBLIC_DEFAI_SWAP_PROGRAM_ID = deploymentState.programIds.defai_swap || PROGRAM_ID.toBase58();
    envVars.NEXT_PUBLIC_DEFAI_STAKING_PROGRAM_ID = deploymentState.programIds.defai_staking || "";
    envVars.NEXT_PUBLIC_DEFAI_ESTATE_PROGRAM_ID = deploymentState.programIds.defai_estate || "";
    envVars.NEXT_PUBLIC_DEFAI_APP_FACTORY_PROGRAM_ID = deploymentState.programIds.defai_app_factory || "";
  }
  
  writeFrontendEnv(envVars);

  /* ---------------- deployment summary ---------------- */
  const summary = {
    timestamp: new Date().toISOString(),
    cluster: DEFAULT_RPC_URL,
    programId: PROGRAM_ID.toBase58(),
    version: "V6",
    rewardsMint: getPubKeyString(rewardsMint.publicKey),
    legacyMint: getPubKeyString(legacyMint.publicKey),
    collectionMint: getPubKeyString(collectionMint.publicKey),
    vaultPda: escrowPda.toBase58(),
    configPda: configPda.toBase58(),
    treasury: treasury.publicKey.toBase58(),
    features: {
      uniquePNFTs: true,
      token2022: true,
      perUserTax: true,
      vesting: true
    }
  };
  
  // Add all program IDs to summary
  if (deploymentState.programIds) {
    summary.allProgramIds = deploymentState.programIds;
  }
  
  fsSync.writeFileSync(path.join(__dirname, "../deploy-summary.json"), JSON.stringify(summary, null, 2));
  console.log("✅ deploy-summary.json written");

  console.log("\n\n🎉 V6 initialization complete!");
  console.log("✅ The platform is ready for V6 pNFT operations");
  console.log("✅ Test wallet funded with 100M OLD + 100M NEW DEFAI");
  
  // Show all deployed programs
  if (deploymentState.programIds) {
    console.log("\n📋 Deployed Program IDs:");
    for (const [name, id] of Object.entries(deploymentState.programIds)) {
      console.log(`   ${name}: ${id}`);
    }
  }
  
  console.log("\nNext steps:");
  console.log("1. Start the frontend: cd frontend && npm run dev");
  console.log("2. Test swapping at /swap");
  console.log("3. Test redemption at /redeem");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
