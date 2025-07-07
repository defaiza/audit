#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ADMIN_KEYPAIR_PATH = path.join(__dirname, '..', 'admin-keypair.json');

async function freshDeploy() {
  console.log('🚀 Fresh deployment with new admin wallet...\n');
  
  // Set Solana config to use admin keypair
  console.log('📝 Setting Solana config to use admin keypair...');
  execSync(`solana config set --keypair ${ADMIN_KEYPAIR_PATH}`, { stdio: 'inherit' });
  
  // Check balance
  console.log('\n💰 Checking balance...');
  const balance = execSync('solana balance', { encoding: 'utf-8' });
  console.log(`Balance: ${balance}`);
  
  if (parseFloat(balance) < 10) {
    console.log('⚠️  Low balance detected. Requesting airdrop...');
    try {
      execSync('solana airdrop 10', { stdio: 'inherit' });
      console.log('✅ Airdrop successful!\n');
    } catch (e) {
      console.log('⚠️  Airdrop failed. Make sure you have enough SOL.\n');
    }
  }
  
  // Clean build
  console.log('🧹 Cleaning previous build...');
  execSync('cargo clean', { stdio: 'inherit' });
  
  // Build programs
  console.log('\n🔨 Building programs...');
  execSync('anchor build', { stdio: 'inherit' });
  
  // Deploy each program individually to get new program IDs
  console.log('\n🚀 Deploying programs...');
  
  const programs = [
    'defai_swap',
    'defai_staking', 
    'defai_estate',
    'defai_app_factory'
  ];
  
  const deployedPrograms = {};
  
  for (const program of programs) {
    console.log(`\n📦 Deploying ${program}...`);
    try {
      // Generate new keypair for each program
      const keypairPath = `./target/deploy/${program}-keypair.json`;
      execSync(`solana-keygen new --outfile ${keypairPath} --no-bip39-passphrase --force`, { stdio: 'pipe' });
      
      // Get the public key
      const pubkey = execSync(`solana-keygen pubkey ${keypairPath}`, { encoding: 'utf-8' }).trim();
      
      // Deploy the program
      const programPath = `./target/deploy/${program}.so`;
      execSync(`solana program deploy ${programPath} --program-id ${keypairPath}`, { stdio: 'inherit' });
      
      console.log(`✅ ${program} deployed at: ${pubkey}`);
      deployedPrograms[program] = pubkey;
      
    } catch (error) {
      console.error(`❌ Failed to deploy ${program}:`, error.message);
    }
  }
  
  // Update Anchor.toml with new program IDs
  console.log('\n📝 Updating Anchor.toml...');
  const anchorToml = fs.readFileSync('./Anchor.toml', 'utf8');
  let updatedToml = anchorToml;
  
  if (deployedPrograms.defai_swap) {
    updatedToml = updatedToml.replace(/defai_swap = ".*"/, `defai_swap = "${deployedPrograms.defai_swap}"`);
  }
  if (deployedPrograms.defai_staking) {
    updatedToml = updatedToml.replace(/defai_staking = ".*"/, `defai_staking = "${deployedPrograms.defai_staking}"`);
  }
  if (deployedPrograms.defai_estate) {
    updatedToml = updatedToml.replace(/defai_estate = ".*"/, `defai_estate = "${deployedPrograms.defai_estate}"`);
  }
  if (deployedPrograms.defai_app_factory) {
    updatedToml = updatedToml.replace(/defai_app_factory = ".*"/, `defai_app_factory = "${deployedPrograms.defai_app_factory}"`);
  }
  
  fs.writeFileSync('./Anchor.toml', updatedToml);
  
  console.log('\n✨ Deployment complete!');
  console.log('Admin wallet:', execSync('solana address', { encoding: 'utf-8' }).trim());
  console.log('\n📋 New Program IDs:');
  console.log(JSON.stringify(deployedPrograms, null, 2));
  
  console.log('\n⚠️  IMPORTANT: Update these files with the new program IDs:');
  console.log('  - src/utils/constants.ts');
  console.log('  - src/utils/simple-initialize.ts');
  console.log('  - LOCAL_TESTING_GUIDE.md');
  console.log('  - README.md');
  
  // Save program IDs to a file for easy reference
  fs.writeFileSync('./deployed-programs.json', JSON.stringify(deployedPrograms, null, 2));
  console.log('\n💾 Program IDs saved to deployed-programs.json');
}

freshDeploy().catch(console.error);