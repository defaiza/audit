#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ADMIN_KEYPAIR_PATH = path.join(__dirname, '..', 'admin-keypair.json');

// Fixed program keypairs that match our desired IDs
const PROGRAM_KEYPAIRS = {
  defai_swap: {
    id: '3WeYbjGoiTQ6qZ8s9Ek6sUZCy2FzG7b9NbGfbVCtHS2n',
    keypair: path.join(__dirname, '..', 'target/deploy/defai_swap-keypair.json')
  },
  defai_staking: {
    id: '3sKj7jgDkiT3hroWho3YZSWAfcmpXXucNKipN4vC3EFM',
    keypair: path.join(__dirname, '..', 'target/deploy/defai_staking-keypair.json')
  },
  defai_estate: {
    id: '2zkarMr8w1k6t1jjcZvmcfVPoFnKy3b1kbxEZH6aATJi',
    keypair: path.join(__dirname, '..', 'target/deploy/defai_estate-keypair.json')
  },
  defai_app_factory: {
    id: 'Ckp11QQpgdP8poYAPVdVjaA5yqfk9Kc4Bd3zmKfzhFAZ',
    keypair: path.join(__dirname, '..', 'target/deploy/defai_app_factory-keypair.json')
  }
};

async function redeployClean() {
  console.log('🧹 Clean redeploy with fixed program IDs...\n');
  
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
  
  // Recreate the program keypairs with desired IDs
  console.log('🔑 Creating program keypairs...');
  
  // First backup existing keypairs
  for (const [name, config] of Object.entries(PROGRAM_KEYPAIRS)) {
    if (fs.existsSync(config.keypair)) {
      fs.renameSync(config.keypair, config.keypair + '.backup');
    }
  }
  
  // Create new keypairs
  execSync(`solana-keygen new --outfile ${PROGRAM_KEYPAIRS.defai_swap.keypair} --no-bip39-passphrase --force`, { stdio: 'inherit' });
  execSync(`solana-keygen new --outfile ${PROGRAM_KEYPAIRS.defai_staking.keypair} --no-bip39-passphrase --force`, { stdio: 'inherit' });
  execSync(`solana-keygen new --outfile ${PROGRAM_KEYPAIRS.defai_estate.keypair} --no-bip39-passphrase --force`, { stdio: 'inherit' });
  execSync(`solana-keygen new --outfile ${PROGRAM_KEYPAIRS.defai_app_factory.keypair} --no-bip39-passphrase --force`, { stdio: 'inherit' });
  
  // Build programs
  console.log('\n🔨 Building programs...');
  execSync('anchor build', { stdio: 'inherit' });
  
  // Deploy programs
  console.log('\n🚀 Deploying programs...');
  try {
    execSync('anchor deploy', { stdio: 'inherit' });
    console.log('✅ All programs deployed successfully!');
  } catch (error) {
    console.error('❌ Deployment failed:', error.message);
  }
  
  // Get actual deployed IDs
  console.log('\n📋 Deployed Program IDs:');
  for (const [name, config] of Object.entries(PROGRAM_KEYPAIRS)) {
    try {
      const pubkey = execSync(`solana-keygen pubkey ${config.keypair}`, { encoding: 'utf-8' }).trim();
      console.log(`${name}: ${pubkey}`);
    } catch (e) {
      console.log(`${name}: Failed to get pubkey`);
    }
  }
  
  console.log('\n✨ Deployment complete!');
  console.log('Admin wallet:', execSync('solana address', { encoding: 'utf-8' }).trim());
  console.log('\n⚠️  Remember to update the program IDs in constants.ts and simple-initialize.ts!');
}

redeployClean().catch(console.error);